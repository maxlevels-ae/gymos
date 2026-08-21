# GymOS — ZKTeco C3-100 Access Microservice

A standalone **FastAPI** service that talks pure TCP to a **ZKTeco C3-100**
1‑door access panel (no Windows DLL) and exposes a small REST/SSE API the ERP
consumes: health, remote open, real‑time transaction stream, panel info/config,
an allowlist for offline fallback, and rotating‑token issue/validate.

> **Stack note:** the GymOS ERP in this repo is **Express + sql.js**, *not*
> NestJS/Prisma/Postgres/Redis. This microservice is ERP‑agnostic and correct
> as‑is. The ERP‑side module (BullMQ sync job, CheckIn table, webhook consumer)
> must be written for the ERP you actually run — see "ERP integration" below.

---

## 1. Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Service + panel connectivity, allowlist stats (no auth) |
| GET | `/panel/info` | Serial, IP, firmware, device name |
| POST | `/door/open` | Remote open `{door_no?, seconds?}` (default 5s) |
| POST | `/panel/config` | Set device params `{params:{…}}` (sensor type, lock delay, NC/NO) |
| GET | `/events/stream` | **SSE** real‑time transactions (`card_no, door_no, event_type, time`) |
| GET | `/events/history` | Catch‑up read `?since=<time>` — transactions missed while disconnected |
| POST | `/allowlist/sync` | Full replace of active card numbers (fallback mode) |
| POST | `/decide` | Allow/deny a scan `{mode, value, auto_open}` |
| POST | `/token/validate` | Validate a rotating QR token |
| GET | `/token/issue/{member_id}` | Mint the current token (testing) |

All except `/health` require header **`X-API-Key: <SERVICE_API_KEY>`**.

---

## 2. Setup

```bash
cd services/c3-access
cp .env.example .env          # fill C3_HOST, secrets
python -m venv .venv && . .venv/Scripts/activate   # (Windows: .venv\Scripts\activate)
pip install -r requirements.txt

python discover.py            # find the panel on the LAN
# python discover.py --set-ip 192.168.1.201 --mask 255.255.255.0 --gw 192.168.1.1 --mac <panel-mac>

uvicorn app.main:app --host 0.0.0.0 --port 8081
# or: docker compose up --build
```

Run tests (no panel needed):

```bash
pytest -q
```

---

## 3. Wiring (C3-100 ↔ Sunlux reader ↔ turnstile)

```
 Sunlux QR reader                 C3-100 panel (Reader 1 / Door 1)
 ─────────────────                ───────────────────────────────
   D0  (green)  ───────────────►  WD0   (Wiegand data 0)
   D1  (white)  ───────────────►  WD1   (Wiegand data 1)
   GND (black)  ───────────────►  GND
   +12V(red)    ◄───────────────  +12V  (or external 12V PSU, common GND)

 C3-100 LOCK relay  ─────────────► turnstile / maglock
   COM ─┐
   NC  ─┴─ (fail‑safe maglock: use NC — de‑energize drops the lock)
   NO  ─── (fail‑secure strike: use NO — energize to release)

 Door sensor (optional) ─────────► SEN1 / GND
 Exit button (optional) ─────────► BUT1 / GND
```

- **NC vs NO:** maglocks are usually wired **NC / fail‑safe** (power loss = open,
  for life safety). Electric strikes are usually **NO / fail‑secure**. Set the
  matching **relay mode** and **`Door1Drivertime`** (lock pulse seconds) via
  `POST /panel/config`.
- **Wiegand format** must match between the Sunlux reader and the panel
  (**Wiegand‑26** here). Mismatch = the panel logs the wrong / no card number.

---

## 4. Panel setup steps

1. Power the C3-100, connect Ethernet to the LAN.
2. `python discover.py` → note MAC/IP. Set a **static IP** (`--set-ip`) or via the
   ZKTeco *SearchTool*. Put it in `.env` (`C3_HOST`).
3. `GET /panel/info` → confirm serial/firmware read back.
4. Configure the door:
   ```bash
   curl -XPOST localhost:8081/panel/config -H "X-API-Key: $KEY" \
     -H 'content-type: application/json' \
     -d '{"params":{"Door1SensorType":2,"Door1Drivertime":5}}'
   #   Door1SensorType: 0=None 1=NO 2=NC ;  Door1Drivertime: lock seconds
   ```
   *(Confirm exact param names for your firmware — see the C3 PULL‑SDK doc / the
   zkaccess‑c3 repo; adjust `c3_client.set_params` if they differ.)*
5. Test open: `curl -XPOST localhost:8081/door/open -H "X-API-Key: $KEY"`.
6. Scan a QR at the turnstile and watch `GET /events/stream` for the card number.

---

## 5. QR / Wiegand‑26 constraint (important)

Wiegand‑26 carries **24 data bits** → any value the reader sends the panel must be
**< 16,777,215**. A secure *rotating* HMAC token (256 bits) **cannot** fit in 24
bits. So:

- **Offline / Wiegand mode (A):** the QR encodes the member's **permanent 24‑bit
  card number**; the panel validates against its card list (kept fresh by the
  allowlist sync). No rotation — anti‑share leans on short allowlist TTLs +
  anti‑passback + turnstile presence.
- **Rotating 24‑bit mode (A′) — how a rotating token fits on Wiegand‑26:** the QR
  encodes `code24 = HMAC‑SHA256("wg:<member>.<window>")[:3 bytes]` — the first 24
  bits of the digest, so it is `< 2**24` **by construction**. It rotates every
  window (~30s); the secret stays server‑side (the member app fetches the current
  code). On read the ERP recomputes `code24` for every active member across the
  accepted windows and matches — a hit proves HMAC authenticity, pins the window,
  and identifies the member in one step.
- **Online / backend mode (B) — full token:** the QR encodes the full
  `member.window.sig` string; a reader in HTTP/keyboard‑wedge mode posts it to the
  ERP, which validates HMAC + time window + replay, then calls `/door/open`.

Both `app/tokens.py` (Python) and `modules/access-control/c3-tokens.js` (Node)
implement the **identical** scheme — `issue_token`/`issueToken`, `code24`,
`validate_token`/`validateToken` produce byte‑for‑byte equal output for the same
`(secret, member, window)`. Replay protection in the ERP is an **in‑memory Map
with a per‑entry TTL = the token's remaining lifetime** (no Redis). `TOKEN_SECRET`
**must match** the value the GymOS app uses to mint the QR.

---

## 6. ERP integration (BUILT for this repo — Express + sql.js)

The ERP side lives in **`modules/access-control`** and is wired to the real
Express + sql.js GymOS (no NestJS/Prisma/Postgres/Redis/BullMQ):

- **`migrations/003_check_ins.js`** — `check_ins` table
  (`id, member_id, panel_sn, door_no, card_no, event_type, scanned_at, allowed, reason`)
  + the bridge settings. Persistence (2s flush + SIGINT/SIGTERM + load‑on‑startup)
  is handled by `core/database.js`.
- **`c3-tokens.js`** — Node mirror of `app/tokens.py` (verified byte‑identical).
- **`c3-service.js`** — the bridge (single instance / single process):
  1. **Sync** — `setInterval(~30s)` pushes the active‑member allowlist to
     `POST /allowlist/sync` (offline fallback only).
  2. **Event consumer** — reads `GET /events/stream`; on reconnect first pulls
     `GET /events/history?since=<cursor>` so no scan is lost, cursor persisted in
     `settings`. Each scan: **verify HMAC + TTL + replay FIRST** (token = source of
     truth), then membership (in‑memory Map, 60s TTL); if active → `POST /door/open`;
     always writes a `check_ins` row (serialized through one write queue).
  3. **Replay** — in‑memory Map, per‑entry TTL = token's remaining lifetime.
- **Routes** — `GET /check-ins`, `POST /c3/open`, `GET /c3/status`, plus the
  bridge fields on the Access‑Control settings page (secrets masked, set on PUT only).
- **Token minting** — the member app must issue the QR with the **same
  `TOKEN_SECRET`** and 30s window as `c3-tokens.js` / `app/tokens.py`.

Tests: `pytest -q` (13) here, and `node modules/access-control/c3-tokens.test.js`
(11) on the ERP side.

---

## 7. Troubleshooting

| Symptom | Check |
|---|---|
| `/health` `connected:false` | IP/port in `.env`; ping the panel; comm password; firewall (TCP 4370) |
| Discovery finds nothing | Same L2 segment? VLAN/AP‑isolation blocking UDP broadcast? Panel network LED? |
| Door won't open remotely | `Door1Drivertime` > 0; relay mode vs lock type (NC/NO); 12V present; hear the relay click? |
| Scans show wrong/no card no | Wiegand format mismatch (reader vs panel); WD0/WD1 swapped; common GND missing |
| Session drops repeatedly | Duplicate IP; another app holds the single C3 session; PoE/power dips — watch `reconnects` in `/health` |
| Latency > 500ms | Enable ERP Redis membership cache (TTL 60s); keep the SSE poll (`C3_RTLOG_POLL_MS`) tight; put the service on the same LAN as the panel |
