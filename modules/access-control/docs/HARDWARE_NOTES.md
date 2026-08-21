# Hardware Notes — ZKTeco ZK4500 + C3-100

## 1. ZKTeco ZK4500 USB Fingerprint Reader

- **Model**: ZK4500
- **Type**: Desktop USB optical fingerprint scanner
- **Sensor**: Optical, 500 DPI, 0.3MP CMOS
- **Image Size**: 280 × 360 pixels
- **CPU**: 120MHz DSP
- **Connection**: USB 2.0 (High Speed)
- **LED**: Status indicator (green when active)
- **Dimensions**: 45mm × 80mm × 65mm (W×H×D)
- **Weight**: 0.20 kg
- **Cable**: 150 cm
- **Operating Temp**: 0°C–55°C
- **Humidity**: 20%–80%
- **OS**: Windows (via FingerprintBridge .NET app)
- **SDK**: ZKTeco zkfp / libzkfpcsharp
  - `zkfp2.Init()` — Initialize SDK
  - `zkfp2.OpenDevice(0)` — Open first USB device
  - `zkfp2.AcquireFingerprint()` — Capture template + image
  - `zkfp2.DBMerge()` — Merge 3 templates into 1 registration template
  - `zkfp2.DBAdd()` / `zkfp2.DBIdentify()` — 1:N identification
  - `zkfp2.DBMatch()` — 1:1 verification

## 2. ZKTeco C3-100 IP-based Door Access Control Panel

- **Model**: C3-100 (1-door controller)
- **Communication**: TCP/IP + RS-485
- **Default IP**: 192.168.1.201
- **TCP Port**: 4370 (PULL SDK protocol)
- **Capacity**: 30,000 cards, 100,000 event transactions
- **Wiegand**: 2 reader inputs (W26/W34)
- **Relays**: 1× Form C for lock, 1× Form C for aux output
- **Inputs**: 1 exit button, 1 door sensor
- **Features**: Anti-passback, first-card opening, multi-card opening, duress password, aux linkages
- **Power**: 12V DC (via external PSU or PoE splitter)
- **Dimensions**: 160mm × 106mm (PCB), 360mm × 285mm × 75mm (enclosure)
- **Firmware**: Upgradeable via network

### C3-100 ControlDevice Command (Door Open)

The C3-100 uses the PULL SDK TCP protocol. The door open command:

```
ControlDevice:{door},{address},{action},{duration},{reserved}
```

Parameters:
- `door`: Door number (1 for C3-100)
- `address`: 1 = lock relay, 2 = aux relay
- `action`: 1 = open/activate
- `duration`: 1–254 seconds (255 = indefinite)
- `reserved`: 0

Example: `ControlDevice:1,1,1,5,0` — Open door 1 lock for 5 seconds

### C3-100 Connection String (PULL SDK)

```
protocol=TCP,ipaddress=192.168.1.201,port=4370,timeout=4000,passwd=
```

## Architecture Flow

```
┌─────────────────────┐
│  ZKTeco ZK4500      │  USB fingerprint reader
│  (USB to Windows)   │  Optical sensor, 500 DPI
└─────────┬───────────┘
          │ USB
┌─────────▼───────────┐
│  FingerprintBridge   │  .NET app on Windows
│  (localhost:7001)    │  HTTP REST → zkfp SDK calls
└─────────┬───────────┘
          │ HTTP REST
┌─────────▼───────────┐
│  GymOS Server        │  Node.js
│  Access Control      │  Fingerprint match + membership check
│  Module              │  Attendance logging
└─────────┬───────────┘
          │ TCP (port 4370)
┌─────────▼───────────┐
│  ZKTeco C3-100       │  1-door IP access control panel
│  (192.168.1.201)     │  ControlDevice command → relay
└─────────┬───────────┘
          │ Relay (Form C)
┌─────────▼───────────┐
│  Electric Door Lock  │  Magnetic lock / strike
└─────────────────────┘
```

## Network Setup

1. **ZK4500**: USB to Windows PC — no network config needed
2. **FingerprintBridge**: Runs on same PC, HTTP on port 7001 (or any configured port)
3. **C3-100**: Connect to same LAN as GymOS server
   - Default IP: 192.168.1.201 (change via C3-100 web interface or ZKAccess software)
   - GymOS sends TCP ControlDevice commands directly (no middleware needed)
4. **GymOS**: Must be able to reach both FingerprintBridge (port 7001) and C3-100 (port 4370)
