# GymOS — Modular Gym Management ERP

A self-hosted gym management platform built on Express and SQLite. Everything beyond the core — members, memberships, attendance, HR, accounting, scheduling — is a **module** that is discovered and loaded at boot, so you can install, disable, or write your own without touching the core.

Ships with an admin web app plus two installable PWAs (members and staff), bilingual English/Arabic content, and a cPanel shared-hosting deployment path.

- **Version:** 1.0.0 · [Release notes](https://github.com/maxlevels-ae/gymos/releases/tag/v1.0.0)
- **Stack:** Node.js 18+ · Express 4 · SQLite (via `sql.js`) · vanilla JS front end
- **License:** proprietary — all rights reserved

---

## Table of contents

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

Neither `data/uploads/` nor `data/backups/` is tracked in git.

---

## Troubleshooting

**`JWT_SECRET` errors on boot** — `.env` is missing, or the secret is still the placeholder. Copy `.env.example` and generate a real value.

**Port already in use** — change `PORT` in `.env`, or stop whatever is holding 3000.

**Login rejected from a browser on another host** — add that origin to `CORS_ORIGINS` (comma-separated, no trailing slash).

**Locked out after failed logins** — rate limiting is doing its job. Wait out `LOGIN_WINDOW_MS`, 15 minutes by default.

**Modules show 0 loaded** — check `MODULES_PATH` and that each module has a valid `manifest.json`. The boot log names any module that failed to load and why.

**Database changes do not survive a restart** — `data/` must be writable, and the process needs a clean shutdown to flush. Stop with `Ctrl+C` or `SIGTERM`, not `SIGKILL`.

**Start fresh** — stop the app, delete `data/gym.db`, restart. Migrations and the default admin are recreated from scratch. This destroys all data.
