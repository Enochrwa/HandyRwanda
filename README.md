
# 🔨 HandyRwanda

### Rwanda's Premier Home Services Marketplace




## The Problem

Finding a skilled artisan in Rwanda is broken. There is no vetted directory of tradespeople. Discovery happens via WhatsApp groups and word-of-mouth — unreliable and unsafe. Prices are opaque. A bad artisan faces zero consequences. Clients, especially women and the elderly, are vulnerable to fraud and dangerous substandard work. Artisans lack consistent income pipelines.

**HandyRwanda fixes all of this — built solo, with zero budget.**

---

## What HandyRwanda Does

HandyRwanda is a **mobile-first, two-sided marketplace** connecting verified skilled artisans — plumbers, electricians, painters, carpenters, cleaners, masons, welders, and more — with households and businesses across Rwanda.

Three interlocking systems make it work:

**Supply side (Artisan):** Onboard → verify identity → build a digital profile → set service radius → accept jobs → get paid via mobile money → accumulate verifiable reviews.

**Demand side (Client):** Register with phone + OTP → search by category and location → review artisan profiles → book → pay into escrow → confirm completion → leave a review.

**Trust infrastructure:** Escrow holds payment until the client confirms job completion. Only verified clients who completed a booking can leave a review. ID verification creates real accountability. A dispute resolution system protects both sides.

---

## 💰 Zero-Budget Stack Philosophy

Every external dependency in this project is **completely free, forever** — not "free tier with limits", not "free trial". The rule is simple: if it requires a credit card or bills by the request, it is not in this stack.

| Category | Replaced | Free Alternative | Notes |
|---|---|---|---|
| **OTP / SMS** | Africa's Talking ($) | **Email OTP via Resend free tier** + WhatsApp OTP fallback | Resend: 3,000 emails/month free. Most users have WhatsApp. |
| **Payments** | MTN MoMo API ($) | **Direct mobile money — manual confirmation flow** | See payment section below. No API key needed. |
| **Media storage** | Cloudinary ($) | **Supabase Storage** (free tier: 1 GB) | S3-compatible, no credit card required. |
| **Backend hosting** | Railway.app ($) | **Render.com free tier** | Free PostgreSQL (90-day data retention on free), auto-deploy from GitHub. |
| **Web hosting** | Vercel / Cloudflare | **GitHub Pages** (static) or **Render free tier** | TanStack Start SSR → deploy as static export or Render web service. |
| **Push notifications** | Expo Push | **Expo Push** ✅ | Already free, no change. |
| **Maps** | Google Maps ($) | **OpenStreetMap + Leaflet.js** ✅ | Already free, no change. |
| **Database** | Managed PostgreSQL ($) | **Supabase free tier** (500 MB, unlimited API calls) | Built-in PostGIS, auth helpers, and storage in one free platform. |
| **Cache / Redis** | Managed Redis ($) | **Upstash Redis free tier** (10,000 req/day) | Serverless Redis, HTTP-based, no server to manage. |
| **Email** | SendGrid / Mailgun ($) | **Resend free tier** (3,000/month) | Simple API, reliable deliverability. |
| **AI / Matching** | OpenAI API ($) | **Ollama + local model** (dev) / **Hugging Face Inference API** (free tier) | sentence-transformers for job matching, runs free. |
| **Auth** | Auth0 / Clerk ($) | **Self-built JWT + OTP** ✅ | Already planned, no change. |

> **On payments:** MTN MoMo and Airtel Money APIs require a business registration, sandbox approval process, and eventually billing. For a $0-budget solo build, the pragmatic v1 approach is a **manual confirmation flow**: the artisan and client exchange mobile money using numbers shown in-app, then both parties confirm payment in the app. Escrow is simulated by the platform's trust system (reviews, ID verification, dispute mechanism). This is how the majority of informal Rwandan service transactions already work — the app adds the trust layer on top. The MoMo API integration is designed and documented for when a business account is eventually obtained.

---

## Core Design Principles

| Principle | Implementation |
|---|---|
| **Mobile-first** | React Native primary app. 80%+ of Rwandan internet users are on mobile. |
| **Africa-first auth** | Phone number + email OTP. No paid SMS dependency at launch. |
| **Offline-capable** | Cache-first architecture. The app functions in low- or no-connectivity environments. |
| **Trust by design** | ID verification, verified reviews, and dispute resolution are not features — they *are* the product. |
| **Kinyarwanda-first** | All UI strings support Kinyarwanda (`rw`), English (`en`), and French (`fr`) from day one. |
| **Low-bandwidth** | Compressed images, minimal payloads, progressive loading. Optimised for 3G and intermittent connections. |
| **$0 forever** | No service in this stack requires payment to run. Scale on free tiers, graduate to paid when revenue exists. |

---

## ✨ Feature Specifications

### 1. Authentication & Identity

- **Phone number + email registration** — user enters their phone number (Rwanda format: `+2507XXXXXXXX`) and an email address. OTP is sent to email via **Resend** (free tier, 3,000/month).
- OTP is a 6-digit code stored in **Upstash Redis** with a 5-minute TTL.
- **JWT access tokens** (15-minute expiry) + **refresh tokens** (30-day expiry) with secure rotation. All self-built, no third-party auth service.
- **Role-based access control** — three roles: `client`, `artisan`, `admin`. Set at registration and enforced at every API endpoint.
- **Profile completion gate** — artisans cannot receive bookings until their profile completion score reaches 80%+.
- Soft account deletion: `is_active = false`. Data retained 90 days.

### 2. Artisan Profiles & Verification

- **Rich profile fields:** Full name, phone, avatar, bio, service categories (multi-select), years of experience, spoken languages, hourly/fixed rate, service radius (km).
- **Portfolio gallery** — up to 12 photos of past work, stored in **Supabase Storage**. Labeled with job type and date.
- **Verification tiers:**
  - 🟡 `Unverified` — phone confirmed only.
  - 🔵 `ID Verified` — Rwanda National ID (`Indangamuntu`) uploaded and approved by admin.
  - 🟢 `Pro Verified` — ID verified + min. 10 completed jobs + avg. rating ≥ 4.2.
  - 🏅 `TVET Certified` — Rwanda Polytechnic graduate badge (Phase 4 roadmap).
- **Service categories** — plumbing, electrical, painting, carpentry, cleaning, masonry, welding, gardening, and more. Extensible via admin panel without redeployment.
- **Geo-radius configuration** — artisans set their maximum travel distance. PostGIS `ST_DWithin` queries match clients to artisans willing to travel to them.
- **Availability status** — toggle "Available Now" in real time, cached in Redis.

### 3. Job Posting & Discovery

- **Two discovery models:** (a) search for artisans directly by category + location, or (b) post a job and receive bids from artisans in the area.
- **Smart search with PostGIS** — artisans ranked by composite score: distance (40%), rating (30%), completion rate (20%), Pro badge (10%).
- **List view + Map view toggle** — map view on OpenStreetMap tiles with custom artisan pins. Tapping a pin slides up a summary card without leaving the map.
- **Filter chips** — Nearest, Top Rated, Available Now, Verified Only, Pro Only. Single-tap. No modal.
- **Job post fields** — service category, job description (text + optional photos), preferred date/time, location (GPS or manual), budget (optional).
- **Bid system** — artisans view posted jobs in their radius and submit a price, message, and proposed start time.
- **Price anchor** — platform shows typical price range for that category in that district to anchor expectations and reduce disputes.

### 4. Booking Management

Booking lifecycle with automatic notifications at every transition:

```
POSTED → BID_SUBMITTED → ACCEPTED → PAYMENT_PENDING → IN_PROGRESS → COMPLETED → REVIEWED
                                          ↓
                                      DISPUTED → RESOLVED
                                          ↓
                                     CANCELLED
```

- **Booking sheet** — 3-step bottom sheet that slides up over the artisan profile, keeping it visible underneath during the commitment moment.
- **Real-time status** — WebSocket connection pushes status changes to both apps instantly.
- **Auto-confirm fallback** — if client does not confirm completion within 48 hours of scheduled end, job auto-confirms. Configurable via env variable.

### 5. Payment Flow (Zero-API, Trust-Based)

The v1 payment flow requires no API keys and no business registration:

```
1. Client confirms booking in-app
2. App shows artisan's mobile money number (MTN or Airtel)
3. Client sends payment directly via their own MoMo app
4. Client taps "I've sent payment" in HandyRwanda
5. Artisan receives notification, confirms receipt in-app
6. Job status moves to IN_PROGRESS
7. On completion, client confirms — artisan's earnings log is updated
8. Both parties leave reviews
```

This model works because:
- Rwanda has extremely high mobile money penetration — both parties already know how to use it.
- The trust layer (ID verification, escrow-simulated by reviews + dispute system, real identity accountability) is what the app provides — not the payment rails.
- When a business MoMo account is obtained (Phase 2), the real escrow API is a drop-in replacement with no UI changes required.

**Earnings tracking:** All confirmed payments are logged in the platform database. Artisans see full earnings history, pending and confirmed, in their dashboard.

### 6. Reviews & Ratings

- **Eligibility gate** — only clients with a booking in `COMPLETED` state can review. No fake reviews possible.
- **Dual review** — client reviews artisan AND artisan reviews client. Mutual accountability.
- **5-star system** with optional text comment (max 500 chars).
- **Artisan reply** — one public reply per review, shown indented with a green left border.
- **Admin moderation queue** — flagged reviews go to admin for review.

### 7. Geo-Search & Maps

- **PostGIS `ST_DWithin`** for all proximity queries with a spatial index.
- **OpenStreetMap tiles** — free forever, excellent Rwanda coverage including secondary cities.
- **react-native-maps (OSM)** on mobile. **Leaflet.js** on web admin. No Google Maps. No billing.
- **Artisan location** — GPS-detected or manually set to district. Clients see only distance ("2.3 km away") until booking is confirmed.
- **District-based fallback** — if no artisans within 5 km, search expands to district, then province, with a banner.

### 8. Notifications (Push + In-App)

Without a paid SMS API, notifications are delivered via two free channels:

| Event | Expo Push | In-App Badge | Email (Resend) |
|---|---|---|---|
| New job in artisan's radius | ✅ | ✅ | — |
| Bid received | ✅ | ✅ | — |
| Booking confirmed | ✅ | ✅ | ✅ |
| Payment confirmed | ✅ | ✅ | ✅ |
| Job completion pending | ✅ | ✅ | ✅ |
| Dispute opened | ✅ | ✅ | ✅ |
| New review received | ✅ | ✅ | — |

- **Expo Push Notifications** — cross-platform, completely free.
- **Resend email** — free tier: 3,000 emails/month. Used for critical transactional events (booking confirmed, payment, dispute).
- **In-app notification centre** — a bell icon with unread count showing all activity. Works completely offline once cached.

> **SMS fallback (Phase 2):** When the platform generates revenue, add Africa's Talking SMS for artisans who turn off push notifications. The notification service layer is already abstracted to make this a one-line config change.

### 9. Offline Mode

- Browse artisan profiles cached from the last session (`expo-sqlite`).
- View active bookings and their current status.
- Read past job thread messages.
- View and edit your own profile data.
- Queued actions (new messages) sync automatically when connectivity restores.
- **Offline banner** — amber strip at the top when offline, so users are never confused.

### 10. Admin Dashboard

Web admin (TanStack Start) accessible only to `admin` role:

- **Artisan verification queue** — view pending ID submissions with uploaded document, one-click approve/reject with reason.
- **Dispute resolution centre** — full job history, payment confirmation trail, message thread. Admin can close in either party's favour.
- **User management** — search, filter, suspend, or ban any account.
- **Category management** — add, rename, reorder service categories without redeployment.
- **Analytics overview** — bookings, active users, dispute rate, top artisans, geographic heatmap (via Recharts, already in `web/package.json`).

### 11. Localisation (i18n)

- **Three languages:** Kinyarwanda (`rw`) default, English (`en`), French (`fr`).
- Language picker on splash screen and in settings. Zero English-only fallbacks in the Kinyarwanda experience.
- Service category names stored with translations in the database.
- All prices in Rwandan Franc (RWF) with locale-appropriate formatting.

---

## 🚀 Unforgettable Features (Beyond Existing Competitors)

### 📸 Before & After Photo Verification
At job start, the artisan uploads a "before" photo. At completion, an "after" photo. Both are timestamped and shown during the client's confirmation step. Eliminates disputes, auto-builds artisan portfolios, creates a visually compelling review prompt. Stored in Supabase Storage — free.

### 🛡️ Community Safety Score
Beyond star ratings, a multidimensional trust scorecard on every artisan profile: ID verified ✅, response rate (% replied within 2 hours), on-time arrival rate (before-photo timestamp vs. scheduled time), repeat client rate (% of clients who rebooked the same artisan). The most honest signals of quality on the platform.

### 💬 In-App Bilingual Messaging
A messaging thread attached to every booking — text, voice notes, photos. **AI-assisted translation** between Kinyarwanda, English, and French using **Helsinki-NLP translation models on Hugging Face Inference API** (free tier). Translation shown below the original, not replacing it. No exchanging phone numbers needed.

### 📊 Artisan Income Intelligence Dashboard
Artisans are running micro-businesses. HandyRwanda becomes their financial partner: monthly earnings chart, best-performing skills analysis (*"Your electrical jobs earn 35% more per hour than painting"*), income projection based on current booking pace, and a **one-tap RRA-ready PDF income statement** for Rwanda Revenue Authority filing. No competitor in the African market offers this.

### 🔴 Live Job Tracking (Phase 2)
Once an artisan marks a job "In Progress", the client sees a live status timeline: *Accepted → On the way → Arrived → Working → Done.* Artisan location shared on OSM map (consent-gated, active only during job hours). ETA calculated from current position to client address. Borrowed from ride-hailing, transforming anxiety into confidence.

### 🔁 Recurring Services (Phase 3)
Weekly cleaner, monthly gardener, quarterly plumber inspection — set up once, runs automatically. Client confirms each occurrence. Artisan is pre-booked. Highest-LTV feature on the platform. No competitor in East Africa has this.

### 🆘 Emergency Services Mode (Phase 3)
A red "EMERGENCY" button for burst pipe, power outage, gas leak. All available artisans in the relevant category within 10 km are simultaneously notified. First to accept wins. Surge pricing displayed upfront. Live tracking from acceptance. Borrowed from ride-hailing emergency models.

### 📲 USSD Interface (Phase 4)
Via Africa's Talking USSD when the platform has revenue — no smartphone required. Search artisans, post a job, get an SMS confirmation. Extends HandyRwanda's market to feature phone users. No smartphone-only competitor can reach this segment.

---

## 🛠 Tech Stack

### Monorepo Structure

| Workspace | Technology | Purpose |
|---|---|---|
| `backend/` | FastAPI (Python 3.11+) | REST API + WebSockets |
| `mobile/` | React Native (Expo SDK 51+) | iOS + Android app |
| `web/` | TanStack Start + TanStack Router | Admin dashboard + public artisan profiles |

### Full Stack — Zero Paid Dependencies

| Layer | Technology | Cost |
|---|---|---|
| Mobile | React Native (Expo) | Free |
| Web admin | TanStack Start (React 19) | Free |
| Backend API | FastAPI (Python 3.11+) | Free |
| Database + PostGIS | **Supabase** (free tier: 500 MB, built-in PostGIS) | Free |
| Cache / Redis | **Upstash Redis** (free tier: 10,000 req/day) | Free |
| Auth | Self-built JWT + OTP | Free |
| OTP delivery | **Resend** email (free: 3,000/month) | Free |
| Maps | OpenStreetMap + Leaflet.js | Free forever |
| Mobile maps | react-native-maps (OSM tiles) | Free forever |
| Push notifications | **Expo Push Notifications** | Free |
| Media storage | **Supabase Storage** (free: 1 GB) | Free |
| Offline storage | expo-sqlite + AsyncStorage | Free |
| AI matching | **Hugging Face Inference API** (free tier) | Free |
| Backend hosting | **Render.com** (free web service) | Free |
| Web hosting | **Render.com** or **GitHub Pages** | Free |
| CI/CD | **GitHub Actions** (free for public repos) | Free |
| UI components | Radix UI + Tailwind CSS v4 | Free |
| State | Zustand + TanStack Query | Free |
| Validation | Zod + React Hook Form | Free |
| Charts | Recharts | Free |

> **Supabase** is the keystone of this stack. One free project gives you: PostgreSQL 15 with PostGIS, a REST API (PostgREST), file storage (S3-compatible), row-level security, and a dashboard — everything that would otherwise require Railway ($) + Cloudinary ($) + a managed DB ($).

---

## 📁 Folder Structure

```text
.
├── backend/                  # FastAPI application
│   ├── app/
│   │   ├── main.py
│   │   ├── models/           # SQLAlchemy ORM models
│   │   ├── schemas/          # Pydantic request/response schemas
│   │   ├── routers/          # auth, users, artisans, jobs, bookings,
│   │   │                     # payments, reviews, notifications, admin
│   │   ├── services/         # Business logic layer
│   │   └── integrations/     # supabase_storage.py, resend_email.py,
│   │                         # upstash_redis.py, huggingface.py
│   │                         # (mtn_momo.py — stub, Phase 2)
│   ├── migrations/           # Alembic migration files
│   ├── tests/
│   ├── requirements.txt
│   └── .env.example
│
├── mobile/                   # React Native (Expo) app
│   ├── app/                  # Expo Router file-based routing
│   │   ├── (auth)/           # phone.tsx, otp.tsx (email OTP)
│   │   ├── (client)/         # home, search, post-job, bookings, profile
│   │   └── (artisan)/        # home, nearby-jobs, my-bids, earnings, profile
│   ├── components/           # ArtisanCard, BookingSheet, MapView, OfflineBanner
│   ├── hooks/                # useAuth, useLocation, useBookings
│   ├── services/             # api.ts, storage.ts (SQLite), notifications.ts
│   ├── i18n/                 # rw.json, en.json, fr.json
│   └── store/                # Zustand: authStore, bookingStore
│
├── web/                      # TanStack Start admin + public web
│   └── src/
│       ├── routes/
│       │   ├── index.tsx         # Public homepage
│       │   ├── search.tsx        # Public artisan search
│       │   ├── artisan.$id.tsx   # Public artisan profile (SEO)
│       │   └── pro.tsx           # Artisan sign-up landing
│       ├── components/           # ArtisanCard, BookingSheet, Header
│       └── store/
│
├── docs/
│   ├── HandyRwanda.md        # Full developer blueprint
│   └── HandRwandaUI.md       # UI design philosophy and screen specs
│
├── package.json              # npm workspaces root
└── README.md
```

---

## 🏁 Getting Started

### Prerequisites

- **Node.js** v18+
- **Python** 3.11+
- **Expo CLI** (`npm install -g expo-cli`)
- A free **Supabase** account — [supabase.com](https://supabase.com) (no credit card)
- A free **Upstash** account — [upstash.com](https://upstash.com) (no credit card)
- A free **Resend** account — [resend.com](https://resend.com) (no credit card)
- A free **Render** account — [render.com](https://render.com) (no credit card)

### 1. Clone the repository

```bash
git clone https://github.com/Enochrwa/HandyRwanda.git
cd HandyRwanda
```

### 2. Install all dependencies

```bash
npm install        # installs root + all workspace node deps
```

### 3. Set up Supabase (replaces PostgreSQL + Redis + Cloudinary)

1. Create a new project at [supabase.com](https://supabase.com).
2. In the Supabase SQL editor, run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```
3. Copy your project URL and `anon`/`service_role` keys from **Project Settings → API**.
4. Create a storage bucket called `artisan-media` (set to public read).

### 4. Set up Upstash Redis (replaces managed Redis)

1. Create a free Redis database at [upstash.com](https://upstash.com).
2. Copy the `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

### 5. Set up Resend (replaces Africa's Talking SMS for OTP)

1. Sign up at [resend.com](https://resend.com).
2. Create an API key.
3. Verify your sender domain (or use the free `onboarding@resend.dev` address for development).

### 6. Configure environment variables

```bash
cp backend/.env.example backend/.env
# Fill in the values below
```

### 7. Run database migrations

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
```

### 8. Start all services

```bash
# Terminal 1 — Backend API
cd backend && uvicorn app.main:app --reload --port 8000

# Terminal 2 — Web admin
cd web && npm run dev

# Terminal 3 — Mobile app
cd mobile && npx expo start
```

---

## ⚙️ Environment Variables

```bash
# backend/.env

# App
APP_SECRET_KEY=generate-a-long-random-string-here
DEBUG=true
ALLOWED_ORIGINS=http://localhost:3000,exp://

# Supabase (replaces PostgreSQL + Cloudinary)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
# Direct DB connection for SQLAlchemy / Alembic migrations:
DATABASE_URL=postgresql://postgres:your-password@db.your-project-id.supabase.co:5432/postgres

# Upstash Redis (replaces managed Redis — HTTP-based, no server needed)
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token

# JWT
JWT_SECRET=another-long-random-string
JWT_ALGORITHM=HS256
JWT_ACCESS_EXPIRE_MINUTES=15
JWT_REFRESH_EXPIRE_DAYS=30

# Resend (replaces Africa's Talking for OTP delivery)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@handyrwanda.rw   # or onboarding@resend.dev in dev

# Hugging Face (free AI matching — no billing)
HUGGINGFACE_API_TOKEN=hf_xxxxxxxxxxxxxxxxxxxx

# Platform config
AUTO_CONFIRM_HOURS=48
PLATFORM_COMMISSION_DEFAULT=0.10   # 10%

# --- Phase 2 stubs (leave empty until business account obtained) ---
# MTN_MOMO_SUBSCRIPTION_KEY=
# MTN_MOMO_DISBURSEMENT_KEY=
# MTN_MOMO_API_USER=
# MTN_MOMO_API_KEY=
# AIRTEL_CLIENT_ID=
# AIRTEL_CLIENT_SECRET=
```

---

## 🧪 Testing

```bash
# Backend
cd backend
pytest -v
pytest --cov=app --cov-report=html

# Mobile
cd mobile && npm test

# Web
cd web && npm test

# All (from root)
npm run test
```

**CI/CD:** GitHub Actions runs all tests on every pull request to `main`. Auto-deploys backend to Render and web to Render/GitHub Pages on merge. No paid CI minutes needed (public repo).

---

## 🧑‍💻 Development Workflow

```bash
npm run lint          # ESLint across all workspaces
npm run format        # Prettier across all workspaces
npm run test          # All tests
npm run type-check    # TypeScript strict check
```

**Husky** hooks enforce lint-staged on commit and **commitlint** for conventional commits (`feat:`, `fix:`, `docs:`, etc.).

---

## 💰 Monetisation (When You're Ready)

Collect revenue before spending money on APIs:

| Stream | Mechanism | Rate |
|---|---|---|
| Transaction commission | Manual: artisans pay a monthly flat fee covering platform use (simpler than per-job at v1) | 5,000 RWF/month |
| Pro artisan badge | Enhanced profile placement, verified badge | 2,000 RWF/month |
| Featured placement | Top-of-search placement | 3,000 RWF / 7 days |
| Emergency surcharge | Premium rate applied to emergency category | +20% of job value |

Once the platform earns its first 50,000 RWF/month, upgrade in this order:
1. **Africa's Talking SMS** (~$5/month) — real OTP + notifications for artisans.
2. **MTN MoMo Business Account** (free to register, % per transaction) — real escrow.
3. **Supabase Pro** ($25/month) — lifts storage and DB limits.

---

## 🗺 Build Roadmap

### Phase 1 — MVP (Weeks 1–6) — $0
Core booking loop, all on free infrastructure.

- [ ] Supabase schema: users, artisans, jobs, bookings, reviews, categories
- [ ] Enable PostGIS on Supabase project
- [ ] FastAPI backend: auth (JWT + email OTP via Resend), all core routers
- [ ] Upstash Redis for OTP storage and search caching
- [ ] Supabase Storage for artisan media (photos, ID documents)
- [ ] React Native app: auth, search (OSM), artisan profile, booking flow
- [ ] Manual payment confirmation flow (no MoMo API)
- [ ] Expo Push Notifications + Resend email for critical events
- [ ] Offline cache layer (`expo-sqlite`)
- [ ] TanStack Start admin: verification queue, dispute resolution, analytics
- [ ] GitHub Actions CI/CD → Render (backend) + GitHub Pages (web)

### Phase 2 — Trust & Quality (Weeks 7–12) — $0
- [ ] Before & after photo verification
- [ ] In-app bilingual messaging (Hugging Face translation, free tier)
- [ ] Community Safety Score on profiles
- [ ] Live job tracking (WebSocket + GPS, consent-gated)
- [ ] Artisan scheduling calendar
- [ ] AI-powered smart matching v1 (Hugging Face sentence-transformers)

### Phase 3 — Monetisation & Retention (Weeks 13–18) — Revenue-funded
- [ ] Pro badge + featured placement monetisation
- [ ] Recurring job subscriptions
- [ ] Emergency Services Mode
- [ ] Artisan Income Intelligence Dashboard + RRA-ready PDF export
- [ ] **Upgrade: Africa's Talking SMS** (first paid service, ~$5/month)
- [ ] **Upgrade: MTN MoMo Business API** — real escrow, drop-in replacement

### Phase 4 — Scale & Expand (Month 5+)
- [ ] USSD interface via Africa's Talking
- [ ] TVET certificate badge (Rwanda Polytechnic partnership)
- [ ] WhatsApp Business bot
- [ ] Secondary cities: Butare, Musanze, Rubavu, Huye
- [ ] East Africa expansion: Uganda, Kenya

---

## 🔌 Integrations

| Service | Purpose | Cost | Docs |
|---|---|---|---|
| Supabase | PostgreSQL + PostGIS + Storage | Free | [supabase.com/docs](https://supabase.com/docs) |
| Upstash Redis | OTP cache, rate limiting, search cache | Free | [upstash.com/docs](https://upstash.com/docs/redis) |
| Resend | Transactional email (OTP, confirmations) | Free (3k/mo) | [resend.com/docs](https://resend.com/docs) |
| Expo Push | Mobile push notifications | Free | [docs.expo.dev/push-notifications](https://docs.expo.dev/push-notifications) |
| Hugging Face | Job-skill matching + translation | Free tier | [huggingface.co/docs](https://huggingface.co/docs/api-inference) |
| OpenStreetMap | Map tiles | Free forever | [openstreetmap.org](https://openstreetmap.org) |
| Render.com | Backend + web hosting, auto-deploy | Free | [render.com/docs](https://render.com/docs) |
| GitHub Actions | CI/CD | Free (public repo) | [docs.github.com/actions](https://docs.github.com/en/actions) |
| MTN MoMo API | *(Phase 2 — after biz registration)* | % per txn | [momodeveloper.mtn.com](https://momodeveloper.mtn.com) |
| Africa's Talking | *(Phase 3 — when revenue exists)* | ~$5/mo | [developers.africastalking.com](https://developers.africastalking.com) |

---

## 🎨 Design System

**One job: build trust fast.** Every visual decision makes a stranger feel safe hiring another stranger.

| Token | Hex | Usage |
|---|---|---|
| Primary | `#1B5E3B` | Deep Forest Green — trust, Rwanda's landscape |
| Accent | `#E8A020` | Warm Amber — CTAs, money, energy |
| Background | `#F7F5F0` | Warm off-white — soft on cheap Android screens |
| Text | `#1A1A1A` | Near-black |
| Verified | `#1565C0` | Blue — universally signals "official" |

**Typography:** [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) — elegant and legible at small sizes on low-end Android hardware. Never weight 400 on interactive elements.

Full design specification: [`docs/HandRwandaUI.md`](docs/HandRwandaUI.md).

---

## 📜 Documentation

| Document | Description |
|---|---|
| [`docs/HandyRwanda.md`](docs/HandyRwanda.md) | Full developer blueprint: schema, API design, security, deployment |
| [`docs/HandRwandaUI.md`](docs/HandRwandaUI.md) | UI design philosophy, screen-by-screen component specs |

---

## 🤝 Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feat/your-feature-name`.
3. Commit with conventional commits: `git commit -m "feat: add before-after photo verification"`.
4. Push and open a PR against `main`. All PRs must pass CI before review.

---


**Built for Rwanda. Built for Africa. 🇷🇼**

*Built solo. Built for $0. Built to last.*

