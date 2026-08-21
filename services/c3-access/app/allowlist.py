"""
In-memory allowlist for FALLBACK validation (mode A / offline).

Kept in sync by the ERP's BullMQ job via POST /allowlist/sync. When the ERP is
unreachable at scan time, the service can still decide allow/deny locally from
the last-synced set of active card numbers.
"""
from __future__ import annotations

import threading
import time
from typing import Optional


class Allowlist:
    def __init__(self) -> None:
        self._cards: dict[int, dict] = {}     # card_no -> {"member_id", "expires_at"}
        self._lock = threading.RLock()
        self.synced_at: float = 0.0

    def replace(self, entries: list[dict]) -> int:
        """Full replace. Each entry: {card_no, member_id, expires_at? epoch}."""
        with self._lock:
            self._cards = {
                int(e["card_no"]): {
                    "member_id": e.get("member_id"),
                    "expires_at": e.get("expires_at"),
                }
                for e in entries
                if e.get("card_no") is not None
            }
            self.synced_at = time.time()
            return len(self._cards)

    def upsert(self, card_no: int, member_id: Optional[int], expires_at: Optional[float]) -> None:
        with self._lock:
            self._cards[int(card_no)] = {"member_id": member_id, "expires_at": expires_at}

    def remove(self, card_no: int) -> None:
        with self._lock:
            self._cards.pop(int(card_no), None)

    def check(self, card_no: int) -> tuple[bool, Optional[int], str]:
        with self._lock:
            e = self._cards.get(int(card_no))
        if not e:
            return False, None, "not_in_allowlist"
        exp = e.get("expires_at")
        if exp is not None and time.time() > float(exp):
            return False, e.get("member_id"), "expired"
        return True, e.get("member_id"), "ok"

    def stats(self) -> dict:
        with self._lock:
            return {"count": len(self._cards), "synced_age_s": round(time.time() - self.synced_at, 1) if self.synced_at else None}


allowlist = Allowlist()
