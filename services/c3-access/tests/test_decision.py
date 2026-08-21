import time

from app.allowlist import Allowlist
from app.decision import decide
from app.tokens import issue_token, validate_token


def _wiegand(al):
    return lambda mode, value, **kw: decide(
        mode=mode, value=value, allowlist_check=al.check, token_validate=validate_token, **kw
    )


def test_wiegand_allowed():
    al = Allowlist()
    al.replace([{"card_no": 12345, "member_id": 42, "expires_at": time.time() + 3600}])
    r = decide(mode="wiegand", value="12345", allowlist_check=al.check, token_validate=validate_token)
    assert r["allowed"] and r["member_id"] == 42 and r["reason"] == "ok"


def test_wiegand_not_in_list():
    al = Allowlist()
    r = decide(mode="wiegand", value="999", allowlist_check=al.check, token_validate=validate_token)
    assert not r["allowed"] and r["reason"] == "not_in_allowlist"


def test_wiegand_expired_membership():
    al = Allowlist()
    al.replace([{"card_no": 5, "member_id": 1, "expires_at": time.time() - 10}])
    r = decide(mode="wiegand", value="5", allowlist_check=al.check, token_validate=validate_token)
    assert not r["allowed"] and r["reason"] == "expired"


def test_wiegand_bad_card():
    al = Allowlist()
    r = decide(mode="wiegand", value="abc", allowlist_check=al.check, token_validate=validate_token)
    assert not r["allowed"] and r["reason"] == "bad_card"


def test_token_allowed():
    al = Allowlist()
    tok = issue_token(77)
    r = decide(mode="token", value=tok, allowlist_check=al.check, token_validate=validate_token)
    assert r["allowed"] and r["member_id"] == 77 and r["reason"] == "ok"


def test_token_denied_forged():
    al = Allowlist()
    r = decide(mode="token", value="77.1.deadbeefdeadbeef", allowlist_check=al.check, token_validate=validate_token)
    assert not r["allowed"] and r["reason"] in ("bad_signature", "expired")
