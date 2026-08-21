import time
import pytest

from app import tokens
from app.tokens import issue_token, validate_token, wiegand26_card, WIEGAND26_MAX


def test_issue_validate_roundtrip():
    t = issue_token(4213)
    ok, member_id, reason = validate_token(t)
    assert ok and member_id == 4213 and reason == "ok"


def test_expired_window():
    now = time.time()
    # token minted (skew+2) windows in the past → outside tolerance
    old = now - tokens.settings.token_window_seconds * (tokens.settings.token_skew_windows + 2)
    t = issue_token(7, now=old)
    ok, _, reason = validate_token(t, now=now)
    assert not ok and reason == "expired"


def test_skew_tolerance():
    now = time.time()
    prev = now - tokens.settings.token_window_seconds  # exactly one window back
    t = issue_token(7, now=prev)
    ok, _, reason = validate_token(t, now=now)
    assert ok and reason == "ok"  # within skew_windows (default 1)


def test_bad_signature():
    t = issue_token(9)
    member, window, _sig = t.split(".")
    forged = f"{member}.{window}.{'0' * 16}"
    ok, _, reason = validate_token(forged)
    assert not ok and reason == "bad_signature"


def test_malformed():
    ok, _, reason = validate_token("not-a-token")
    assert not ok and reason == "malformed"


def test_replay_protection():
    used = set()
    seen = lambda nonce: (nonce in used) or (used.add(nonce) and False)
    t = issue_token(11)
    ok1, _, r1 = validate_token(t, seen=seen)
    ok2, _, r2 = validate_token(t, seen=seen)
    assert ok1 and r1 == "ok"
    assert not ok2 and r2 == "replay"


def test_wiegand26_bounds():
    assert wiegand26_card(1) == 1
    assert wiegand26_card(WIEGAND26_MAX) == WIEGAND26_MAX
    for bad in (0, -5, WIEGAND26_MAX + 1):
        with pytest.raises(ValueError):
            wiegand26_card(bad)
