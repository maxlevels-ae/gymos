# Access Control V2 — GymOS Module

Odoo-style workspace with top header navigation, matching the HR and Accounting modules.

## Hardware

| Device | Model | Connection | Role |
|--------|-------|------------|------|
| Fingerprint Reader | **ZKTeco ZK4500** | USB to Windows PC | Capture, merge, identify fingerprint templates |
| Door Panel | **ZKTeco C3-100** | TCP/IP (port 4370) | 1-door electric lock relay control |
| Bridge App | **FingerprintBridge** (.NET) | HTTP REST (port 7001) | Translates GymOS API calls → ZK4500 SDK calls |

## Architecture

```
[ZKTeco ZK4500 USB Reader]
    ↓ (USB — zkfp SDK)
[Windows PC + FingerprintBridge.exe:7001]
    ↓ (HTTP REST API)
[GymOS Access Control Module (Node.js)]
    ↓ (decision: fingerprint match + membership check)
[ZKTeco C3-100 Panel (TCP:4370)] → [Electric Door Lock Relay]
```

## Workspace Tabs

| Tab | Description |
|-----|-------------|
| Dashboard | Stats cards, recent events, ZK4500 bridge status, system info |
| Identities | CRUD with detail view (info, fingerprints, history sub-tabs) |
| Enrollment | 3-scan workflow: select identity → capture × 3 on ZK4500 → merge |
| Live Verify | One-click: capture → identify → check membership → open C3-100 door |
| Link Members | Search members → auto-create identity → enroll fingerprint |
| Events Log | Filterable access event history with result, score, message |
| Devices | ZK4500 bridge status, C3-100 panel, registered devices |
| Settings | Sub-tabs: ZK4500 Bridge, C3-100 Gate, Rules |

## Enrollment Flow (3-scan merge via ZK4500)

1. Select an identity (or create from member)
2. Press "Capture Scan" — finger on ZK4500 reader → template captured via bridge `/capture`
3. Repeat 2 more times (3 scans total)
4. Press "Merge & Save" → bridge `/merge` combines 3 templates via `zkfp2.DBMerge`
5. Merged template stored in `access_fingerprint_templates` with `is_merged = 1`

## Verification Flow

1. Press "Verify & Open Gate"
2. Bridge `/capture` grabs live fingerprint from ZK4500
3. Bridge `/identify` matches against all enrolled templates via `zkfp2.DBIdentify`
4. If matched and score ≥ threshold:
   - Check member eligibility (active membership, not expired, sessions remaining)
   - Log attendance if enabled
   - Trigger door open on C3-100 (or webhook or mock)
5. Access event recorded regardless of outcome

## Gate Providers

| Provider | How it works |
|----------|-------------|
| `mock` | No actual gate control (testing) |
| `c3-100` | TCP direct to ZKTeco C3-100 panel on port 4370 — sends ControlDevice command to unlock door for N seconds |
| `webhook` | HTTP POST to configured URL with identity/result payload |

## C3-100 Integration Details

- **Default IP**: 192.168.1.201
- **Protocol**: TCP/IP on port 4370 (PULL SDK)
- **Command**: `ControlDevice:door,1,1,duration,0` — opens door lock relay for specified seconds
- **Capacity**: 30,000 cards, 100,000 transaction log
- **Features**: Anti-passback, first-card opening, multi-card opening, duress password
- **Relay**: 1× Form C relay for lock, 1× Form C relay for aux output

## ZK4500 Specifications

- **Sensor**: Optical, 500 DPI
- **Image**: 280 × 360 pixels, 0.3MP CMOS
- **Connection**: USB 2.0
- **LED**: Status indicator
- **SDK**: zkfp / libzkfpcsharp — capture, merge 3 templates, 1:N identify, 1:1 match
- **OS**: Windows (via FingerprintBridge .NET app)

## FingerprintBridge API (localhost:7001)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/device/status` | GET | ZK4500 connection status, image dimensions |
| `/capture` | POST | Acquire fingerprint → base64 template + quality |
| `/merge` | POST | Merge 3 templates into 1 (`zkfp2.DBMerge`) |
| `/identify` | POST | Match probe against candidate list (`zkfp2.DBIdentify`) |
| `/match` | POST | 1:1 match between two templates (`zkfp2.DBMatch`) |

## GymOS API Endpoints

- `GET /api/access-control/status` — Bridge + stats
- `GET /api/access-control/dashboard` — Dashboard data
- `GET /api/access-control/identities` — List identities
- `POST /api/access-control/identities` — Create identity
- `PUT /api/access-control/identities/:id` — Update identity
- `GET /api/access-control/identities/:id/templates` — Templates for identity
- `GET /api/access-control/identities/:id/events` — Events for identity
- `POST /api/access-control/identities/:id/enroll/start` — Start enrollment session
- `POST /api/access-control/enroll/:sessionKey/capture` — Capture one scan
- `POST /api/access-control/enroll/:sessionKey/merge` — Merge 3 scans
- `POST /api/access-control/verify-and-open` — Live verify + gate
- `GET /api/access-control/events` — All events
- `GET /api/access-control/members/search` — Search members for linking
- `POST /api/access-control/members/:id/bootstrap-identity` — Create identity from member
- `GET /api/access-control/devices` — List devices
- `POST /api/access-control/devices` — Add device
- `PUT /api/access-control/devices/:id` — Update device
- `DELETE /api/access-control/devices/:id` — Remove device
- `GET /api/access-control/settings` — Get settings
- `POST /api/access-control/settings` — Save settings
