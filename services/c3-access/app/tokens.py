"""
QR token issuance & validation.

═══════════════════════════════════════════════════════════════════════════════
 WIEGAND-26 CONSTRAINT (read this)
═══════════════════════════════════════════════════════════════════════════════
 Wiegand-26 carries 24 data bits + 2 parity bits, so any value the Sunlux reader
 emits to the C3 over Wiegand-26 must be < 2**24 = 16,777,215. A cryptographic,
 rotating, replay-proof token (HMAC-SHA256 = 256 bits) DOES NOT FIT in 24 bits.

 Therefore there are two distinct modes, and you must pick per lane:

  A) OFFLINE / WIEGAND mode  (reader → Wiegand-26 → C3 validates against its card list)
     - The QR encodes the member's PERMANENT 24-bit card number (`card_no`).
     - No rotation is possible — 24 bits cannot hold a secure rotating secret.
     - Anti-share relies on: short-lived allowlist entries, the C3's anti-passback,
       and turnstile presence. Use `wiegand26_card()` to allocate/validate the number.
     - The BullMQ sync job pushes the active members' `card_no`s to the allowlist.

  B) ONLINE / BACKEND-VALIDATION mode  (reader → ERP validates → /door/open)
     - The QR encodes a full rotating HMAC token (this module's `issue_token`).
     - Not limited by Wiegand — the scanner posts the string to the ERP, which
       validates HMAC + time window + replay nonce, then calls /door/open.
     - This is the secure, rotating path. Prefer it for QR turnstiles.

 The C3-100 + Sunlux-over-Wiegand path is inherently mode A. To get *rotating*
 QR security you run mode B (reader in "HTTP/serial post" or keyboard-wedge to a
 small agent that posts to the ERP), OR accept a static 24-bit card in mode A.
═══════════════════════════════════════════════════════════════════════════════
"""
from __future__ import annotations

import hashlib
import hmac
import time
from typing import Callable, Optional, Tuple

from .config import settings

WIEGAND26_MAX = (1 << 24) - 1  # 16,777,215


# ── Mode A: offline Wiegand card number ──────────────────────────────────────
def wiegand26_card(card_no: int) -> int:
    """Validate a permanent card number fits Wiegand-26 (raises if not)."""
    n = int(card_no)
    if n < 1 or n > WIEGAND26_MAX:
        raise ValueError(f"card_no {n} does not fit Wiegand-26 (1..{WIEGAND26_MAX})")
    return n


# ── Mode B: rotating HMAC token (backend validation) ─────────────────────────
def _window(now: Optional[float] = None) -> int:
    return int((now if now is not None else time.time()) // settings.token_window_seconds)


def _sig(member_id: int, window: int) -> str:
    # Domain-separated ("tok:") — MUST match modules/access-control/c3-tokens.js
    # so a QR minted by the ERP validates identically here and in the bridge.
    msg = f"tok:{member_id}.{window}".encode()
    return hmac.new(settings.token_secret.encode(), msg, hashlib.sha256).hexdigest()[:16]


def issue_token(member_id: int, now: Optional[float] = None) -> str:
    """Mint the current QR string for a member: `<member_id>.<window>.<sig16>`."""
    w = _window(now)
    return f"{member_id}.{w}.{_sig(member_id, w)}"


# ── Mode A (rotating): 24-bit Wiegand code derived from HMAC ──────────────────
# This is how a rotating token "fits" on Wiegand-26: we take the first 3 bytes
# (24 bits) of HMAC-SHA256("wg:<member>.<window>"), so the value is 0..2**24-1 by
# construction. Mirror of c3-tokens.js `code24`. The QR for a Wiegand lane encodes
# this number; the ERP recomputes it per active member/window to identify + verify.
def code24(member_id: int, window: int) -> int:
    msg = f"wg:{member_id}.{window}".encode()
    digest = hmac.new(settings.token_secret.encode(), msg, hashlib.sha256).digest()
    return int.from_bytes(digest[:3], "big") & WIEGAND26_MAX


def validate_token(
    token: str,
    now: Optional[float] = None,
    seen: Optional[Callable[[str], bool]] = None,
) -> Tuple[bool, Optional[int], str]:
    """
    Verify a rotating token. Returns (ok, member_id, reason).

    `seen(nonce) -> True if already used` implements replay protection. On the ERP
    side back it with Redis SETNX (TTL = window * (skew+1)); here it's optional.
    """
    try:
        member_s, window_s, sig = token.strip().split(".")
        member_id, window = int(member_s), int(window_s)
    except (ValueError, AttributeError):
        return False, None, "malformed"

    cur = _window(now)
    if abs(cur - window) > settings.token_skew_windows:
        return False, member_id, "expired"

    if not hmac.compare_digest(sig, _sig(member_id, window)):
        return False, member_id, "bad_signature"

    if seen is not None:
        nonce = f"{member_id}.{window}.{sig}"
        if seen(nonce):
            return False, member_id, "replay"

    return True, member_id, "ok"
