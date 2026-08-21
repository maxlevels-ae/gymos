"""
Pure allow/deny decision logic — no I/O, fully unit-testable.

`mode="wiegand"`  → value is a card number, checked against the local allowlist.
`mode="token"`    → value is a rotating HMAC token, checked with validate_token.
"""
from __future__ import annotations

from typing import Callable, Optional


def decide(
    *,
    mode: str,
    value: str,
    allowlist_check: Callable[[int], tuple[bool, Optional[int], str]],
    token_validate: Callable[..., tuple[bool, Optional[int], str]],
    seen: Optional[Callable[[str], bool]] = None,
) -> dict:
    if mode == "wiegand":
        try:
            card = int(value)
        except (TypeError, ValueError):
            return {"allowed": False, "member_id": None, "card_no": None, "reason": "bad_card"}
        ok, member_id, reason = allowlist_check(card)
        return {"allowed": ok, "member_id": member_id, "card_no": card, "reason": reason}

    # token mode
    ok, member_id, reason = token_validate(value, seen=seen)
    return {"allowed": ok, "member_id": member_id, "card_no": None, "reason": reason}
