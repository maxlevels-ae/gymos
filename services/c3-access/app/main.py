import asyncio
import json
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException
from sse_starlette.sse import EventSourceResponse

from .allowlist import allowlist
from .c3_client import client
from .config import settings
from .decision import decide
from .schemas import AllowlistSyncIn, DecideIn, OpenDoorIn, PanelConfigIn, TokenValidateIn
from .tokens import issue_token, validate_token

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("c3.api")


@asynccontextmanager
async def lifespan(_: FastAPI):
    client.start_watchdog()
    log.info("C3 access service up — panel %s:%s", settings.c3_host, settings.c3_port)
    yield
    client.stop()


app = FastAPI(title="GymOS C3-100 Access Service", version="1.0.0", lifespan=lifespan)


def require_key(x_api_key: str = Header(default="")) -> None:
    if x_api_key != settings.service_api_key:
        raise HTTPException(status_code=401, detail="invalid or missing X-API-Key")


# ── health / info ──────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"service": "ok", "panel": await client.health(), "allowlist": allowlist.stats()}


@app.get("/panel/info", dependencies=[Depends(require_key)])
async def panel_info():
    try:
        return {"ok": True, "info": await client.info()}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))


# ── door control ───────────────────────────────────────────────
@app.post("/door/open", dependencies=[Depends(require_key)])
async def door_open(body: OpenDoorIn):
    try:
        return {"ok": True, **await client.open_door(body.door_no, body.seconds)}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@app.post("/panel/config", dependencies=[Depends(require_key)])
async def panel_config(body: PanelConfigIn):
    try:
        return {"ok": True, **await client.set_params(body.params)}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))


# ── real-time events (SSE) ─────────────────────────────────────
@app.get("/events/stream", dependencies=[Depends(require_key)])
async def events_stream():
    async def gen():
        interval = settings.c3_rtlog_poll_ms / 1000.0
        while True:
            if client.state.connected:
                try:
                    for rec in await client.read_rt_log():
                        yield {"event": "scan", "data": json.dumps(rec, default=str)}
                except Exception as exc:
                    yield {"event": "error", "data": json.dumps({"error": str(exc)})}
            else:
                yield {"event": "status", "data": json.dumps({"connected": False})}
            await asyncio.sleep(interval)
    return EventSourceResponse(gen())


@app.get("/events/history", dependencies=[Depends(require_key)])
async def events_history(since: str = ""):
    """Catch-up read for a reconnecting consumer: transactions with time > since.
    The bridge calls this before reopening the stream so a dropped SSE connection
    never loses a scan (the C3 buffers transactions in its own memory)."""
    try:
        txns = await client.read_history(since)
        return {"since": since, "count": len(txns), "transactions": txns}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))


# ── allowlist (fallback validation) ────────────────────────────
@app.post("/allowlist/sync", dependencies=[Depends(require_key)])
async def allowlist_sync(body: AllowlistSyncIn):
    n = allowlist.replace([e.model_dump() for e in body.entries])
    return {"ok": True, "count": n}


@app.get("/allowlist/stats", dependencies=[Depends(require_key)])
async def allowlist_stats():
    return allowlist.stats()


# ── decision + token helpers ───────────────────────────────────
@app.post("/decide", dependencies=[Depends(require_key)])
async def decide_scan(body: DecideIn):
    result = decide(
        mode=body.mode,
        value=body.value,
        allowlist_check=allowlist.check,
        token_validate=validate_token,
    )
    if result["allowed"] and body.auto_open:
        try:
            await client.open_door()
            result["opened"] = True
        except Exception as exc:
            result["opened"] = False
            result["open_error"] = str(exc)
    return result


@app.post("/token/validate", dependencies=[Depends(require_key)])
async def token_validate(body: TokenValidateIn):
    ok, member_id, reason = validate_token(body.token)
    return {"ok": ok, "member_id": member_id, "reason": reason}


@app.get("/token/issue/{member_id}", dependencies=[Depends(require_key)])
async def token_issue(member_id: int):
    return {"member_id": member_id, "token": issue_token(member_id), "window_seconds": settings.token_window_seconds}
