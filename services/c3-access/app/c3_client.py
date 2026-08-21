"""
Thread-safe wrapper around the pure-TCP ZKTeco C3 protocol client.

The `zkaccess-c3` package is synchronous; we serialize all panel I/O behind a
single lock (the C3 holds one TCP session) and run blocking calls in a thread so
FastAPI's event loop is never blocked. A background watchdog re-establishes the
session with exponential backoff when it drops.

IMPORTANT — verify method names against the installed library version:
    from c3 import C3, controldevice, consts
    panel.connect() / panel.disconnect() / panel.is_connected()
    panel.get_device_info() -> dict-like
    panel.get_device_param([...]) / panel.set_device_param({...})
    panel.get_rt_log() -> list[rtlog record]
    controldevice.ControlDeviceOutput(door_no, consts.ControlOutputAddress.DOOR_OUTPUT, seconds)
If the installed API differs, adjust ONLY this file — the rest of the service
talks to the C3Client interface below, not to the library directly.
"""
from __future__ import annotations

import asyncio
import logging
import threading
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Optional

from .config import settings

log = logging.getLogger("c3")

try:
    from c3 import C3, controldevice, consts  # type: ignore
    _LIB_OK = True
except Exception as exc:  # pragma: no cover - import guard
    C3 = None  # type: ignore
    controldevice = None  # type: ignore
    consts = None  # type: ignore
    _LIB_OK = False
    log.warning("zkaccess-c3 not importable (%s) — client runs in DISCONNECTED stub mode", exc)


@dataclass
class PanelState:
    connected: bool = False
    last_ok: float = 0.0
    last_error: str = ""
    reconnects: int = 0
    info: dict[str, Any] = field(default_factory=dict)


class C3Client:
    def __init__(self) -> None:
        self._panel: Optional["C3"] = None
        self._lock = threading.RLock()          # one session → serialize all panel I/O
        self.state = PanelState()
        self._stop = threading.Event()
        self._wd_thread: Optional[threading.Thread] = None
        # Ring buffer of recently-read transactions so /events/history can serve
        # anything a disconnected consumer missed (the panel also buffers in its
        # own memory; get_rt_log drains it, so we retain a copy here too).
        self._recent: deque = deque(maxlen=2000)

    # ── lifecycle ──────────────────────────────────────────────
    def _do_connect(self) -> None:
        if not _LIB_OK:
            raise RuntimeError("zkaccess-c3 library not installed")
        with self._lock:
            if self._panel is not None:
                try:
                    self._panel.disconnect()
                except Exception:
                    pass
            panel = C3(settings.c3_host)
            ok = panel.connect() if not settings.c3_password else panel.connect(settings.c3_password)
            if not ok:
                raise ConnectionError(f"connect() returned falsy for {settings.c3_host}:{settings.c3_port}")
            self._panel = panel
            self.state.connected = True
            self.state.last_ok = time.time()
            self.state.last_error = ""
            try:
                self.state.info = dict(panel.get_device_info() or {})
            except Exception:
                self.state.info = {}
            log.info("Connected to C3 %s:%s", settings.c3_host, settings.c3_port)

    def _mark_down(self, err: str) -> None:
        with self._lock:
            self.state.connected = False
            self.state.last_error = err
            self._panel = None

    def start_watchdog(self) -> None:
        if self._wd_thread and self._wd_thread.is_alive():
            return
        self._stop.clear()
        self._wd_thread = threading.Thread(target=self._watchdog, name="c3-watchdog", daemon=True)
        self._wd_thread.start()

    def stop(self) -> None:
        self._stop.set()
        with self._lock:
            if self._panel is not None:
                try:
                    self._panel.disconnect()
                except Exception:
                    pass
                self._panel = None
        self.state.connected = False

    def _watchdog(self) -> None:
        backoff = settings.c3_retry_base
        while not self._stop.is_set():
            try:
                if not self.state.connected:
                    self._do_connect()
                    self.state.reconnects += 1
                    backoff = settings.c3_retry_base
                else:
                    # cheap liveness ping
                    with self._lock:
                        if self._panel is not None:
                            self._panel.get_device_info()
                            self.state.last_ok = time.time()
                self._stop.wait(settings.c3_watchdog_interval)
            except Exception as exc:  # session dropped
                self._mark_down(str(exc))
                log.warning("C3 down (%s) — retry in %.0fs", exc, backoff)
                self._stop.wait(backoff)
                backoff = min(backoff * 2, settings.c3_retry_max)

    # ── operations (async-safe) ────────────────────────────────
    async def _call(self, fn, *args):
        return await asyncio.to_thread(self._locked, fn, *args)

    def _locked(self, fn, *args):
        with self._lock:
            if self._panel is None:
                raise ConnectionError("panel not connected")
            try:
                out = fn(self._panel, *args)
                self.state.last_ok = time.time()
                return out
            except Exception as exc:
                self._mark_down(str(exc))
                raise

    async def health(self) -> dict:
        return {
            "connected": self.state.connected,
            "host": settings.c3_host,
            "port": settings.c3_port,
            "last_ok_age_s": round(time.time() - self.state.last_ok, 1) if self.state.last_ok else None,
            "reconnects": self.state.reconnects,
            "last_error": self.state.last_error,
            "library": _LIB_OK,
        }

    async def info(self) -> dict:
        def _f(p):
            data = dict(p.get_device_info() or {})
            try:
                params = p.get_device_param(["~SerialNumber", "IPAddress", "FirmVer", "DeviceName"])
                data.update(params or {})
            except Exception:
                pass
            return data
        return await self._call(_f)

    async def open_door(self, door_no: int | None = None, seconds: int | None = None) -> dict:
        door = int(door_no or settings.c3_door_no)
        dur = int(seconds or settings.c3_open_seconds)

        def _f(p):
            cmd = controldevice.ControlDeviceOutput(door, consts.ControlOutputAddress.DOOR_OUTPUT, dur)
            p.control_device(cmd)
            return {"door": door, "seconds": dur, "sent": True}
        return await self._call(_f)

    async def set_params(self, params: dict[str, Any]) -> dict:
        # e.g. {"Door1SensorType": 2, "Door1Drivertime": 5, "IPAddress": "192.168.1.201"}
        def _f(p):
            p.set_device_param({str(k): str(v) for k, v in params.items()})
            return {"applied": list(params.keys())}
        return await self._call(_f)

    async def read_rt_log(self) -> list[dict]:
        """Poll the panel's real-time transaction buffer. Returns normalized records."""
        def _f(p):
            recs = p.get_rt_log() or []
            out = []
            for r in recs:
                out.append({
                    "card_no": getattr(r, "card_no", getattr(r, "cardno", None)),
                    "door_no": getattr(r, "door_id", getattr(r, "door_number", settings.c3_door_no)),
                    "event_type": getattr(r, "event_type", getattr(r, "verified", None)),
                    "in_out": getattr(r, "in_out_state", None),
                    "time": str(getattr(r, "time_second", getattr(r, "time", ""))),
                    "raw": getattr(r, "__dict__", {}),
                })
            return out
        recs = await self._call(_f)
        for r in recs:
            self._recent.append(r)
        return recs

    async def read_history(self, since: str = "") -> list[dict]:
        """Transactions with time > `since`, for reconnect catch-up (point 4).

        First drains the panel's on-device buffer (get_rt_log) into the ring
        buffer, then returns everything newer than the caller's cursor. Times are
        panel timestamps (lexically sortable 'YYYY-MM-DD HH:MM:SS' / epoch str).
        Called on the bridge's reconnect BEFORE it reopens the live stream, so it
        does not race the streaming poll.
        """
        try:
            await self.read_rt_log()  # refresh: pull anything buffered while away
        except Exception as exc:
            log.warning("read_history refresh failed: %s", exc)
        if not since:
            return list(self._recent)
        return [r for r in self._recent if str(r.get("time", "")) > since]


client = C3Client()
