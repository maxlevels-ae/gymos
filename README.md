# GymOS — Modular Gym Management ERP

A self-hosted gym management platform built on Express and SQLite. Everything beyond the core — members, memberships, attendance, HR, accounting, scheduling — is a **module** that is discovered and loaded at boot, so you can install, disable, or write your own without touching the core.

Ships with an admin web app plus two installable PWAs (members and staff), bilingual English/Arabic content, and a cPanel shared-hosting deployment path.

- **Version:** 1.0.0 · [Release notes](https://github.com/maxlevels-ae/gymos/releases/tag/v1.0.0)
- **Stack:** Node.js 18+ · Express 4 · SQLite (via `sql.js`) · vanilla JS front end
- **License:** [GPL-3.0-or-later](LICENSE) — free and open source

---

## Table of contents

- [Features](#features)
- [Requirements](#requirements)
- [Install](#install)
- [First login](#first-login)
- [Demo data](#demo-data)
- [Configuration](#configuration)
- [What ships in the box](#what-ships-in-the-box)
- [URLs](#urls)
- [Deploy to cPanel shared hosting](#deploy-to-cpanel-shared-hosting)
- [Writing a module](#writing-a-module)
- [Backups](#backups)
- [Troubleshooting](#troubleshooting)
- [License](#license)
- [Custom work and support](#custom-work-and-support)

---

## Features

### Members and memberships
- Member registration with full profiles, lifecycle stages, and profile-completeness scoring
- Per-member QR identity for check-in and door access
- Membership plans covering periods, session packs, trials, and drop-ins
- Subscriptions with renewals, auto-renew, and a smart status engine
- Dedicated freeze management — rules, freeze pricing, payment workflow, and full history
- At-risk flags and retention dashboards
- Emergency contacts and per-member alerts

### Attendance and access control
- QR check-in plus a dedicated front-desk mode
- Live occupancy tracking and attendance heatmaps
- Face-recognition entry via a Wiegand face terminal driving a ZKTeco C3-100 door panel, with a member-card popup on entry
- Rotating-QR access as an alternative to face entry
- Member ↔ Face ID mapping, turnstile log, and debt-based entry policy
- Fingerprint reader support through the bundled Windows bridge

### Scheduling and training
- Class scheduling with capacity management, bookings, and waitlists
- Personal-training appointments and trainer-to-member assignment
- Trainer profiles and specializations
- Exercise library with videos and images, organized by category
- Training programs auto-assigned from member experience level, with progress tracking

### Operations and finance
- Accounting workspace built for gym business operations
- Purchase orders end to end — RFQ, PO confirmation, goods receipt, and vendor bill creation
- Cafeteria POS with enforced till sessions, walk-in default, held-order resume, refund control, and super-admin safeguards
- HR workspace for staff records
- Multi-branch and multi-location support throughout

### Engagement, marketing, and automation
- Rule-based workflow automation — expiry reminders, inactivity nudges, birthdays, weekly reports
- Delivery over WhatsApp, SMS, or in-app notification
- WhatsApp campaigns via Wesender, with templates, contact lists, and a safe processing queue
- Announcements and lifecycle messaging
- QR self-registration queue with two-stage WhatsApp onboarding and admin approval

### Apps
- **Admin back-office** — the full management console
- **Member PWA** — installable app with OTP phone login, QR identity, bookings, membership status, nutrition and meal plans, water and weight tracking, and live gym capacity
- **Employee PWA** — installable app for staff working the floor
- Web push notifications to both PWAs

### Platform
- Modular architecture — 19 modules discovered and loaded at boot, each with its own migrations, routes, permissions, menus, and dashboard widgets
- Runtime module installation by uploading a `.zip` from the admin UI
- Role-based access control with granular per-module permissions
- Event bus for cross-module communication, plus rules, workflow, and notification-template engines
- Bilingual English/Arabic throughout, with RTL support
- Audit logging and a configurable settings system
- Security: JWT auth with refresh tokens, bcrypt hashing, helmet, CORS allowlisting, rate limiting on login and OTP, and Zod request validation
- Zero-dependency database — a single SQLite file, with automatic periodic backups
- Runs on cPanel shared hosting or any Node host

---

## Requirements

| | |
|---|---|
| Node.js | 18 or 20 (LTS). Verified on v20 |
| npm | 9+ (bundled with Node) |
| Database | None to install — SQLite lives in a file at `data/gym.db` |
| OS | Linux, macOS, or Windows |

There is no separate database server, no Docker requirement, and no front-end build step.

---

## Install

### 1. Get the code

```bash
git clone https://github.com/maxlevels-ae/gymos.git
cd gymos
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create your environment file

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Open `.env` and set — at minimum — a real `JWT_SECRET`. Everything else can stay on its defaults for a local run.

Generate a strong secret:

```bash
openssl rand -hex 64
```

```ini
JWT_SECRET=<paste the generated value here>
CORS_ORIGINS=http://localhost:3000
NODE_ENV=development
```

> **Never commit `.env`.** It is gitignored. `.env.example` and `.env.cpanel.example` are the templates to copy from.

### 4. Start it

```bash
npm start
```

You should see:

```
══════════════════════════════════════════════════
  🏋️  GymOS Platform v1.0.0
  🌐  Listening on port 3000
  📦  Modules: 19 loaded
  🔒  Security: helmet, rate-limit, CORS restricted
  ⚡  Performance: compression, WAL, caching
══════════════════════════════════════════════════
```

Open **http://localhost:3000**.

On first boot the platform creates `data/gym.db`, runs all core and module migrations, and creates the default admin account automatically. There is no separate migration command to run.

---

## First login

| Username | Password |
|---|---|
| `admin` | `admin123` |

You are **required to change this password on first login** (`FORCE_ADMIN_PW_CHANGE=true`). Change it before exposing the app to any network.

---

## Demo data

Optional. Loads sample branches, membership plans, members, trainers, and schedules so the dashboards are not empty:

```bash
npm run seed
```

The seeder is idempotent per table — it skips any table that already has rows, so it is safe to re-run. Skip it entirely for a production install.

---

## Configuration

All configuration is environment variables in `.env`. The full annotated list is in `.env.example`; these are the ones that matter most.

### Server

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3000` | Port to listen on (`APP_PORT` is an accepted alias) |
| `NODE_ENV` | `production` | Use `development` locally |
| `TRUST_PROXY` | `true` | Required when behind nginx, Cloudflare, or Passenger |

### Security — set these in production

| Variable | Default | Notes |
|---|---|---|
| `JWT_SECRET` | — | **Required.** 64-byte random hex. Rotating it logs everyone out |
| `JWT_EXPIRES_IN` | `24h` | Admin access-token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Admin refresh-token lifetime |
| `PWA_JWT_EXPIRES_IN` | `12h` | Member/staff PWA access token |
| `PWA_JWT_REFRESH_EXPIRES_IN` | `90d` | PWA refresh token — long, so members stay logged in |
| `CORS_ORIGINS` | — | Comma-separated allowed origins. Set to your real domain |
| `FORCE_ADMIN_PW_CHANGE` | `true` | Forces the password change on first admin login |

### Rate limiting

| Variable | Default | Notes |
|---|---|---|
| `MAX_LOGIN_ATTEMPTS` | `5` | Failed logins allowed per window |
| `LOGIN_WINDOW_MS` | `900000` | Window length — 15 minutes |
| `OTP_MAX_ATTEMPTS` | `3` | Wrong-OTP tries before lockout |
| `OTP_SEND_LIMIT` | `5` | OTP sends allowed per window |

### Storage

| Variable | Default | Notes |
|---|---|---|
| `DB_PATH` | `./data/gym.db` | SQLite file, relative to the app root |
| `DB_BACKUP_DIR` | `./data/backups` | Automatic backup target |
| `DB_SAVE_INTERVAL` | `2000` | Milliseconds between flushes to disk |
| `UPLOADS_PATH` | `./data/uploads` | Member photos, module zips, PWA assets |
| `MODULES_PATH` | `./modules` | Where the loader scans for modules |

### App

| Variable | Default | Notes |
|---|---|---|
| `APP_NAME` | `GymOS` | Shown in the UI and emails |
| `APP_LOCALE` | `en` | `en` or `ar` |
| `APP_DIR` | `ltr` | `ltr`, `rtl`, or `auto` |
| `LOG_LEVEL` | `info` | `error`, `warn`, `info`, `debug` |

---

## What ships in the box

### Core (`core/`)

Bootstrap and boot sequence, a DI container, the module loader and dynamic module router, an event bus for cross-module communication, database and migration runners, plus three engines — rules, workflow, and notification templates. Auth, validation, and error-handling middleware live here too.

### Modules (`modules/`)

Nineteen modules ship in the box:

`access-control` · `accounting` · `attendance` · `automation` · `branches` · `cafeteria` · `engagement` · `hr` · `marketing` · `member-app` · `members` · `membership-freeze` · `memberships` · `purchase` · `qr-registration` · `scheduling` · `sdk-example` · `trainers` · `training`

Each declares its own migrations, routes, permissions, menu entries, dashboard widgets, and quick actions in a `manifest.json`. `sdk-example` is a working reference implementation to copy from.

### Clients

- **Admin** — served from `public/`, the full back-office
- **Member PWA** (`member-pwa/`) — installable app for members: QR identity, bookings, membership status; logs in by phone OTP
- **Employee PWA** (`employee-pwa/`) — installable app for staff on the floor

### Integrations

- **Fingerprint bridge** (`integrations/fingerprint-bridge/`) — Windows helper that connects a fingerprint reader to the attendance module. See its own `README.txt`.

---

## URLs

| Path | What |
|---|---|
| `/` | Admin back-office |
| `/member/` | Member PWA |
| `/employee/` | Employee PWA |
| `/api/` | REST API |
| `/api/health` | Health check — returns JSON, no auth required |
| `/uploads/` | Uploaded files |

Authentication is `POST /api/auth/login` for staff (returns a JWT), and the `POST /api/auth/otp/send` → `POST /api/auth/otp/verify` pair for PWA members.

---

## Deploy to cPanel shared hosting

The project includes a Passenger-compatible entrypoint, `cpanel-app.js`, used instead of `server.js` on shared hosting.

1. Upload and extract the project into your Node application root.
2. In **cPanel → Setup Node.js App**, set:
   - Node.js version: **18 or 20**
   - Application root: your project folder
   - Application startup file: **`cpanel-app.js`**
   - Environment: **production**
3. Run `npm install` from the cPanel Node app panel.
4. Copy `.env.cpanel.example` to `.env` and set `JWT_SECRET`, `CORS_ORIGINS`, and `APP_NAME`.
5. Make `data/`, `data/backups/`, and `data/uploads/` writable.
6. Restart the app from cPanel.

`trust proxy` turns on automatically when `CPANEL_ENV=true`. Full notes, including behavior on hosts that throttle background timers, are in [README_CPANEL_SHARED_HOSTING.md](README_CPANEL_SHARED_HOSTING.md).

To run the same entrypoint locally: `npm run start:cpanel`.

---

## Writing a module

Scaffold one:

```bash
npm run create-module
```

A module is a folder under `modules/` containing:

```
modules/my-module/
├── manifest.json      # name, version, dependencies, permissions, menu, widgets
├── routes.js          # Express routes, mounted automatically under /api
└── migrations/        # schema changes, run once and tracked in _migrations
```

The loader picks it up on the next restart — resolving `dependencies`, running pending migrations, registering permissions, and injecting menu items and dashboard widgets. Start by reading `modules/sdk-example/`.

Modules can also be installed at runtime as a `.zip` from the admin UI (Settings → Modules), which requires the `modules.install` and `modules.upload` permissions.

---

## Backups

The database is a single file. The platform writes periodic copies into `data/backups/`, but for a real backup take `data/gym.db` **and** `data/uploads/` off the machine on a schedule:

```bash
cp data/gym.db "backup-$(date +%F).db"
```

Nothing under `data/` is tracked in git — not the database, not uploads, not backups. Your gym's data never enters the repository.

---

## Troubleshooting

**`JWT_SECRET` errors on boot** — `.env` is missing, or the secret is still the placeholder. Copy `.env.example` and generate a real value.

**Port already in use** — change `PORT` in `.env`, or stop whatever is holding 3000.

**Login rejected from a browser on another host** — add that origin to `CORS_ORIGINS` (comma-separated, no trailing slash).

**Locked out after failed logins** — rate limiting is doing its job. Wait out `LOGIN_WINDOW_MS`, 15 minutes by default.

**Modules show 0 loaded** — check `MODULES_PATH` and that each module has a valid `manifest.json`. The boot log names any module that failed to load and why.

**Database changes do not survive a restart** — `data/` must be writable, and the process needs a clean shutdown to flush. Stop with `Ctrl+C` or `SIGTERM`, not `SIGKILL`.

**Start fresh** — stop the app, delete `data/gym.db`, restart. Migrations and the default admin are recreated from scratch. This destroys all data.

---

## License

GymOS is free and open source software, licensed under the **GNU General Public License v3.0 or later**. The full text is in [LICENSE](LICENSE).

```
Copyright (C) 2026  Maxlevels — Eng. Ahmad Alkharouf

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
```

In short: you are free to use, run, study, modify, and redistribute it, including commercially. If you distribute a modified version — or run it as a service you distribute — you must release your changes under the same GPL-3.0 license and keep the copyright notice intact.

---

## Custom work and support

Need custom modules, integrations, branding, migration from another system, or hosted setup?

**Eng. Ahmad Alkharouf — Maxlevels**
WhatsApp: [+962 79 308 8001](https://wa.me/962793088001)

Bug reports and feature requests are welcome in [GitHub Issues](https://github.com/maxlevels-ae/gymos/issues).
