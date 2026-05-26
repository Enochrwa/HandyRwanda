# HandyRwanda — Local Development Setup

## What was fixed

### Web (`/web`)
| Issue | Fix |
|---|---|
| `Cannot GET /` on `localhost:5173` | Replaced `@tanstack/react-start` (Cloudflare SSR worker) with standard Vite SPA. The original config used a Cloudflare Worker entry point that Vite dev doesn't serve as a normal HTTP app. |
| Missing `index.html` | Created `/web/index.html` — the required entry point for Vite SPA mode. |
| Missing `src/main.tsx` | Created the React SPA bootstrap that mounts `<RouterProvider>`. |
| `__root.tsx` used SSR-only APIs | Removed `HeadContent`, `Scripts`, `shellComponent` (TanStack Start SSR APIs). Root now just renders `<Outlet />`. |
| `vite.config.ts` used Cloudflare plugin | Replaced with `@vitejs/plugin-react` + `TanStackRouterVite` plugin. |
| SSR deps in `package.json` | Removed `@cloudflare/vite-plugin`, `@tanstack/react-start`, `@tanstack/start-plugin-core`. |

### Backend (`/backend`)
| Issue | Fix |
|---|---|
| Crashes without PostgreSQL | `database.py` now detects missing `DATABASE_URL` and falls back to **SQLite** via `aiosqlite`. No external DB needed locally. |
| PostgreSQL-specific model types | Created `app/db_compat.py` — transparent shims for `UUID`, `ARRAY`, `JSONB`, `Geography` that map to SQLite-compatible types when not on PG. All models patched to import from there. |
| Crashes without Upstash Redis | `upstash.py` now uses an in-memory dict with TTL when `UPSTASH_REDIS_REST_URL` is unset. OTPs work in dev, printed to console. |
| Crashes without Resend API key | `resend_email.py` now prints OTP emails to console when `RESEND_API_KEY` is unset. |
| Missing CORS headers | Added `CORSMiddleware` to `main.py` — web and mobile can reach the API. |
| No auto table creation in dev | `main.py` lifespan calls `init_db()` on startup when using SQLite. |
| `requirements.txt` pulled PG/cloud deps | Moved `asyncpg`, `geoalchemy2`, `psycopg2-binary`, `upstash-redis`, `resend` to `requirements-prod.txt`. |

### Mobile (`/mobile`)
| Issue | Fix |
|---|---|
| expo-router had no `_layout.tsx` files | Created `app/_layout.tsx` (root), `app/(auth)/_layout.tsx`, `app/(client)/_layout.tsx`, `app/(artisan)/_layout.tsx`. |
| No root index route | Created `app/index.tsx` that redirects to `/(auth)/phone`. |
| Wrong `main` entry | Changed `package.json` `"main"` from `node_modules/expo/AppEntry.js` to `expo-router/entry`. |
| `app.json` missing expo-router config | Added `scheme`, `web.bundler: "metro"`, and `expo-router` plugin. |

### Root (`/`)
| Issue | Fix |
|---|---|
| `dev` script backend command fragile | Split into `dev:backend`, `dev:web`, `dev:mobile`, `dev:all` with named concurrently processes. |

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 18 | https://nodejs.org |
| Python | ≥ 3.10 | https://python.org |
| npm | ≥ 9 | bundled with Node |

---

## Quick start (web + API)

```bash
# 1. Clone and install
git clone https://github.com/Enochrwa/HandyRwanda.git
cd HandyRwanda
npm install

# 2. Install Python backend deps
npm run backend:install
# or: cd backend && pip install -r requirements.txt

# 3. Create backend env file
cp backend/.env.example backend/.env
# (defaults work for local dev — no edits needed)

# 4. Run web + API together
npm run dev
```

- **Web** → http://localhost:5173  
- **API** → http://localhost:8000  
- **API docs** → http://localhost:8000/docs  

---

## Individual services

```bash
# Web only
npm run dev:web

# Backend only
npm run dev:backend

# Mobile only (needs Expo Go app on phone or emulator)
npm run dev:mobile

# All three at once
npm run dev:all
```

---

## How local dev services work without infrastructure

### Database
No PostgreSQL needed. `DATABASE_URL` is unset → SQLite file created automatically at `backend/handyrwanda_dev.db`. Tables are created on first startup.

To use PostgreSQL instead:
```env
# backend/.env
DATABASE_URL=postgresql://user:pass@localhost:5432/handyrwanda
```
Then install prod deps: `cd backend && pip install -r requirements-prod.txt`

### OTP / Auth
No Upstash Redis needed. OTPs are stored in memory (5-min TTL) and **printed to the terminal** instead of emailed:
```
==================================================
[DEV] OTP for user@example.com: 847291
==================================================
```
Copy the code from the terminal to complete login.

### Email
No Resend API key needed. Emails are printed to the terminal (see above).

---

## Production / staging

Set these in `backend/.env` (or your deployment environment):

```env
DATABASE_URL=postgresql://user:pass@host:5432/handyrwanda
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=noreply@handyrwanda.rw
JWT_SECRET=a-long-random-secret-string
```

Then install all deps including cloud providers:
```bash
cd backend && pip install -r requirements-prod.txt
```

---

## Project structure

```
HandyRwanda/
├── web/              # React SPA — Vite + TanStack Router + Tailwind
│   ├── index.html    # ← entry point (new)
│   └── src/
│       ├── main.tsx  # ← SPA bootstrap (new)
│       ├── routes/   # TanStack Router file-based routes
│       └── ...
├── backend/          # FastAPI + SQLAlchemy + SQLite/PostgreSQL
│   ├── app/
│   │   ├── db_compat.py   # ← PG→SQLite type shims (new)
│   │   ├── database.py    # ← auto-selects SQLite or PG
│   │   ├── main.py        # ← CORS + lifespan init
│   │   ├── models/        # all patched to use db_compat
│   │   ├── routers/       # auth, artisans, jobs, bids, admin
│   │   └── integrations/  # upstash (in-mem fallback), resend (console fallback)
│   ├── requirements.txt       # dev deps (SQLite)
│   └── requirements-prod.txt  # + cloud deps (PG, Redis, Resend)
├── mobile/           # React Native / Expo Router
│   └── app/          # file-based routes with _layout.tsx files (new)
└── package.json      # monorepo scripts (web + backend + mobile)
```

---

## Common issues

**`npm run dev` — Python not found**  
Make sure `python` or `python3` is on your PATH. On macOS/Linux, the script uses `python`. If yours is `python3`, edit the `dev:backend` script in root `package.json`.

**Port 8000 already in use**  
```bash
lsof -i :8000 | grep LISTEN  # find the PID
kill <PID>
```

**SQLite "table already exists" on restart**  
Normal — `init_db()` uses `CREATE TABLE IF NOT EXISTS`, so it's safe to restart freely.

**Mobile — Expo not found**  
```bash
cd mobile && npm install
npx expo start
```