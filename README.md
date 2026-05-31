<!-- File: README.md -->
# HandyRwanda 🔧

> Rwanda's trusted marketplace for local artisans — booked in minutes, paid via MoMo.

[![Web](https://img.shields.io/badge/Web-React%2018-blue?logo=react)](./web)
[![Mobile](https://img.shields.io/badge/Mobile-Expo%2052-purple?logo=expo)](./mobile)
[![Backend](https://img.shields.io/badge/Backend-FastAPI-green?logo=fastapi)](./backend)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)](.)

---

## Architecture

```
HandyRwanda/
├── backend/          FastAPI (Python 3.12) + SQLAlchemy async + PostgreSQL
├── web/              React 18 + TanStack Router + TanStack Query + Vite
└── mobile/           Expo 52 + Expo Router + React Native + NativeWind
```

All three share a single REST API (`/api/v1`) and use JWT auth with OTP login.
Real-time messaging runs over WebSocket at `ws://host/ws/messages/{bookingId}`.

---

## Quick Start

### Backend

```bash
cd backend
cp .env.example .env          # fill in DATABASE_URL, JWT_SECRET, SUPABASE_* vars
pip install -r requirements.txt
alembic upgrade head           # run migrations
uvicorn app.main:app --reload  # http://localhost:8000
```

Docs auto-generated at `http://localhost:8000/docs`.

### Web

```bash
cd web
cp .env.example .env           # VITE_API_URL=http://localhost:8000
npm install --ignore-scripts
npm run dev                    # http://localhost:5173
npm run build                  # production build → dist/
```

### Mobile

```bash
cd mobile
cp .env.example .env           # EXPO_PUBLIC_API_URL=http://localhost:8000
npm install --ignore-scripts
npx expo start                 # scan QR with Expo Go
npx expo run:android           # Android device/emulator
npx expo run:ios               # iOS simulator (macOS only)
```

---

## Feature Map

### Authentication
- OTP-based login (email or phone) — no passwords
- Role selection at registration: **client** or **artisan**
- JWT access + refresh tokens, stored securely (localStorage / AsyncStorage)
- Admin role for platform management

### For Clients
| Feature | Web | Mobile |
|---------|-----|--------|
| Browse & search artisans | ✅ | ✅ |
| Filter by category, rating, availability | ✅ | ✅ |
| Map view (nearby artisans) | ✅ | ✅ |
| View artisan profile (bio, portfolio, reviews) | ✅ | ✅ |
| Book artisan (3-step: describe → confirm → pay) | ✅ | ✅ |
| Post a job (get competitive bids) | ✅ | ✅ |
| Accept / reject bids | ✅ | ✅ |
| Real-time messaging (WebSocket) | ✅ | ✅ (polling) |
| Confirm MoMo payment | ✅ | ✅ |
| Mark job complete | ✅ | ✅ |
| Leave review & rating | ✅ | via profile |
| Raise dispute | ✅ | ✅ |
| Notifications (in-app) | ✅ | ✅ |

### For Artisans
| Feature | Web | Mobile |
|---------|-----|--------|
| Artisan dashboard (earnings, jobs, ratings) | ✅ | ✅ |
| Toggle availability | ✅ | ✅ |
| Browse open jobs feed | ✅ | ✅ |
| Submit bids on jobs | ✅ | ✅ |
| Confirm payment receipt | ✅ | ✅ |
| Portfolio management (upload photos) | ✅ | ✅ |
| Reply to reviews | ✅ | — |
| Onboarding wizard (4 steps) | ✅ | ✅ |
| ID verification upload | ✅ | ✅ |

### For Admins
| Feature | Web |
|---------|-----|
| Verification queue (approve/reject) | ✅ |
| Platform analytics (charts, revenue, top artisans) | ✅ |
| User management (suspend/activate) | ✅ |
| Dispute resolution | ✅ |
| Category management | ✅ |
| Review moderation (flagged reviews) | ✅ |

---

## API Reference

Base URL: `http://localhost:8000`

### Authentication
```
POST /auth/otp/request          Request OTP (email + phone)
POST /auth/otp/verify           Verify OTP → returns JWT
POST /auth/register             Register new user
GET  /auth/users/{id}/profile   Get user profile
PATCH /auth/users/{id}/profile  Update profile
```

### Artisans
```
GET  /artisans/search           Search artisans (lat, lng, radius_km, q, category_id)
GET  /artisans/{id}/public      Full public profile (bio, portfolio, reviews)
GET  /artisans/categories       List all service categories
POST /artisans/profile          Create/update artisan profile
POST /artisans/skills           Update skill categories
PATCH /artisans/availability    Toggle is_available
GET  /artisans/dashboard        Artisan earnings + schedule + bids
POST /artisans/portfolio        Add portfolio photo
GET  /artisans/portfolio/me     List my portfolio
DELETE /artisans/portfolio/{id} Remove portfolio photo
POST /artisans/profile/me/id-verification  Submit ID docs
```

### Jobs & Bids
```
GET  /jobs                      List open jobs (public, for artisans to bid)
GET  /jobs/mine                 My jobs (authenticated client)
GET  /jobs/available            Skill-matched open jobs (authenticated artisan)
POST /jobs                      Post a new job
GET  /jobs/{id}                 Job detail + price guidance
POST /bids/jobs/{job_id}        Submit bid
GET  /bids/jobs/{job_id}        List bids on a job
POST /bids/{bid_id}/accept      Accept bid → creates booking
POST /bids/{bid_id}/reject      Reject bid
```

### Bookings
```
GET  /bookings                  My bookings
GET  /bookings/upcoming         Next 5 upcoming bookings
GET  /bookings/{id}             Booking detail
POST /bookings/{id}/confirm-payment   Client: I've sent MoMo
POST /bookings/{id}/confirm-receipt   Artisan: I received payment
POST /bookings/{id}/complete          Client: job is done
POST /bookings/{id}/dispute           Raise dispute
POST /bookings/{id}/cancel            Cancel booking
```

### Messages
```
GET  /messages/conversations    All conversations (bookings + last message)
GET  /messages/{booking_id}     Messages in a thread
POST /messages/{booking_id}     Send message
WS   /ws/messages/{booking_id}  Real-time WebSocket channel
```

### Reviews
```
POST /reviews/{booking_id}              Submit review (client, after completion)
GET  /reviews/artisan/{artisan_id}      Public reviews for an artisan
PATCH /reviews/{review_id}/reply        Artisan replies
PATCH /reviews/{review_id}/flag         Flag for moderation
```

### Notifications
```
GET  /notifications             List my notifications
PATCH /notifications/read-all   Mark all as read
PATCH /notifications/{id}/read  Mark one as read
```

### Admin
```
GET  /admin/artisans/pending            Verification queue
POST /admin/artisans/{id}/approve       Approve artisan
POST /admin/artisans/{id}/reject        Reject artisan
GET  /admin/disputes                    Open disputes
POST /admin/disputes/{booking_id}/resolve  Resolve dispute
GET  /admin/analytics                   Platform analytics
GET  /admin/users                       User list (search, filter)
POST /admin/users/{id}/suspend          Suspend user
POST /admin/users/{id}/activate         Activate user
GET  /admin/reviews/flagged             Flagged reviews
DELETE /admin/reviews/{id}              Delete review
POST /admin/categories                  Create category
```

---

## Booking Lifecycle

```
[post job] → [bid submitted] → [bid accepted]
                                     ↓
                            pending_payment
                                     ↓ client taps "I've sent payment"
                              confirmed
                                     ↓ artisan taps "I received payment"
                              in_progress
                                     ↓ client taps "Mark complete"
                              completed  ← auto-confirm after 48h
                                     ↓
                            [review prompt]

At any pending/confirmed/in_progress stage:
  → disputed   (admin resolves)
  → cancelled  (either party, pre-start)
```

---

## Environment Variables

### Backend `.env`
```env
DATABASE_URL=postgresql+asyncpg://user:password@localhost/handyrwanda
JWT_SECRET=your-secret-key-min-32-chars
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
SUPABASE_BUCKET=handyrwanda-media
ENV=development
```

### Web `.env`
```env
VITE_API_URL=http://localhost:8000
```

### Mobile `.env`
```env
EXPO_PUBLIC_API_URL=http://localhost:8000
```

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | FastAPI, SQLAlchemy (async), Alembic, PostgreSQL, python-jose |
| Web | React 18, TanStack Router, TanStack Query, Vite, Tailwind CSS, Recharts |
| Mobile | Expo 52, Expo Router, React Native, NativeWind, React Query |
| Auth | OTP via email, JWT access/refresh tokens |
| Storage | Supabase Storage (images), PostgreSQL (data) |
| Maps | OpenStreetMap / react-native-maps |
| Payments | MTN MoMo / Airtel Money (manual confirm flow) |
| Realtime | WebSocket (backend) + polling fallback (mobile) |

---

## Contributing

1. Fork and clone
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Backend: follow existing router patterns, add file comment, write tests
4. Web/Mobile: use NativeWind classes, add file comment, no `StyleSheet.create`
5. Every file must start with `// File: path/to/file` or `# File: path/to/file`
6. Run `npx tsc --noEmit` (web + mobile) and `python -m py_compile` before committing

---

*Made with ❤️ in Rwanda*
