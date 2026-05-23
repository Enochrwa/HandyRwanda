# HandyRwanda — Engineering Development Plan

> **Version:** 2.0.0  
> **Last Updated:** May 2026  
> **Scope:** 7-Sprint Full-Stack Build Plan (Mobile + Web + Backend)  
> **Stack:** FastAPI · React Native (Expo) · TanStack Start · Supabase · Upstash Redis · Resend · Expo Push · OpenStreetMap · Hugging Face  
> **Target:** Rwanda → East Africa → World 🌍

---

## How to Read This Document

Each sprint describes **exactly what to build**, **which files to create or edit**, **which libraries to install**, and **how every piece works technically**. There are no vague goals here. If you follow this document sprint by sprint, you will have a production-ready, world-class marketplace.

The stack is 100% free-tier. No credit card. No paid API. Every service used has been chosen because it is permanently free at the scale needed to launch and grow to tens of thousands of users.

---

## Repository Structure (Monorepo)

```
HandyRwanda/
├── backend/               # FastAPI — Python 3.11+
│   ├── app/
│   │   ├── main.py
│   │   ├── models/        # SQLAlchemy ORM models
│   │   ├── schemas/       # Pydantic v2 request/response schemas
│   │   ├── routers/       # One file per domain
│   │   ├── services/      # Business logic (no DB calls in routers)
│   │   ├── integrations/  # supabase_storage, resend, upstash, huggingface
│   │   ├── middleware/    # rate_limit, cors, logging
│   │   └── dependencies/  # jwt_auth, get_db, get_redis
│   ├── migrations/        # Alembic
│   ├── tests/
│   ├── requirements.txt
│   └── .env.example
│
├── mobile/                # React Native — Expo SDK 51+
│   ├── app/               # Expo Router (file-based)
│   │   ├── (auth)/
│   │   ├── (client)/
│   │   └── (artisan)/
│   ├── components/
│   ├── hooks/
│   ├── services/          # api.ts, sqlite.ts, notifications.ts
│   ├── i18n/              # rw.json, en.json, fr.json
│   └── store/             # Zustand stores
│
├── web/                   # TanStack Start — React 19 + TypeScript
│   └── src/
│       ├── routes/        # File-based routes (TanStack Router)
│       ├── components/
│       ├── store/
│       └── services/
│
├── docs/
├── DEVELOPMENT.Md         # This file
└── README.md
```

---

## Sprint 1 — Foundation: Auth, Database, Design System & CI/CD

**Goal:** Have a running monorepo with a working authentication system (phone + email OTP), a fully migrated database, a consistent design system across all three apps, and automated CI/CD. Every developer who clones this repo can be running locally within 10 minutes.

---

### 1.1 Monorepo & Tooling Setup

**What to build:** Root-level workspace configuration, shared linting, formatting, commit enforcement, and a single `npm run dev` that boots all three apps.

**How to build it:**

1. **`package.json` (root)** — define npm workspaces:
   ```json
   {
     "workspaces": ["backend", "mobile", "web"],
     "scripts": {
       "dev": "concurrently \"npm run dev -w web\" \"cd backend && uvicorn app.main:app --reload --port 8000\"",
       "lint": "eslint web/src mobile/app --ext .ts,.tsx",
       "format": "prettier --write \"**/*.{ts,tsx,py}\"",
       "type-check": "tsc -p web/tsconfig.json --noEmit && tsc -p mobile/tsconfig.json --noEmit",
       "test": "npm test -w web && npm test -w mobile && cd backend && pytest"
     }
   }
   ```

2. **ESLint + Prettier** — install at root: `npm i -D eslint prettier eslint-config-universe husky lint-staged commitlint @commitlint/config-conventional`. Add `.eslintrc.json`, `.prettierrc`, `commitlint.config.js`.

3. **Husky hooks** — `npx husky init`. In `.husky/pre-commit` run lint-staged. In `.husky/commit-msg` run commitlint. Conventional commits enforced from day one: `feat:`, `fix:`, `chore:`, `docs:`, `test:`.

4. **`concurrently`** — `npm i -D concurrently` for the root dev script.

---

### 1.2 Supabase Database Schema — Full Migration

**Technology:** Supabase (PostgreSQL 15 + PostGIS), SQLAlchemy 2.0 async, Alembic.

**What to build:** All database tables for the entire application defined upfront via Alembic migrations. One migration file per domain.

**How to build it:**

Install backend dependencies:
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install fastapi uvicorn[standard] sqlalchemy[asyncio] asyncpg alembic pydantic[email] python-jose[cryptography] passlib[bcrypt] python-multipart httpx slowapi upstash-redis resend python-dotenv pytest pytest-asyncio
```

Create `backend/app/database.py`:
```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
import os

DATABASE_URL = os.getenv("DATABASE_URL").replace("postgresql://", "postgresql+asyncpg://")
engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
```

Create `backend/app/models/` — one file per domain. Full schema:

**`models/user.py`:**
```python
import uuid
from sqlalchemy import Column, String, Boolean, Enum, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
import enum

class UserRole(str, enum.Enum):
    client = "client"
    artisan = "artisan"
    admin = "admin"

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone_number = Column(String(20), unique=True, nullable=False)
    full_name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=True)
    avatar_url = Column(String, nullable=True)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.client)
    preferred_lang = Column(String(5), default="rw")
    is_active = Column(Boolean, default=True)
    expo_push_token = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
```

**`models/artisan.py`:** ArtisanProfile with `location GEOGRAPHY(POINT,4326)`, `verification_status` enum (`unverified`, `id_verified`, `pro_verified`), `is_available`, `average_rating`, `response_rate`, `on_time_rate`, `repeat_client_rate`, `community_score`. Also: `Category`, `ArtisanSkill` junction, `PortfolioPhoto`.

**`models/job.py`:** Job with `status` enum (`open`, `pending_bid`, `booked`, `in_progress`, `completed`, `cancelled`, `disputed`), `location GEOGRAPHY`, `before_photo_url`, `after_photo_url`. Bid with `status` enum.

**`models/booking.py`:** Booking with full lifecycle status, `before_photo_url`, `after_photo_url`, `auto_confirm_at` timestamp.

**`models/message.py`:** Message linked to booking, `translated_content` (nullable), `voice_note_url` (nullable), `is_read`.

**`models/review.py`:** Review with `rating`, `comment`, `artisan_reply`, `is_flagged`. Dual review: both `client_review` and `artisan_review` per booking.

**`models/transaction.py`:** Transaction with type enum (`payment_in`, `payout_out`, `commission`, `refund`), `momo_reference`, `status`.

**`models/notification.py`:** Notification with `event_type`, `payload` (JSONB), `is_read`.

**`models/referral.py`:** Referral with `referral_code`, `status`.

**Alembic init:**
```bash
alembic init migrations
# Edit alembic.ini: sqlalchemy.url = ${DATABASE_URL}
# Edit migrations/env.py: import all models, set target_metadata = Base.metadata
alembic revision --autogenerate -m "initial_schema"
alembic upgrade head
```

Run this on Supabase: `CREATE EXTENSION IF NOT EXISTS postgis;` before migrations.

---

### 1.3 Backend: Auth System (Phone + Email OTP)

**Technology:** FastAPI, Upstash Redis (OTP store), Resend (email delivery), python-jose (JWT), passlib (hashing).

**What to build:** Complete auth flow — register, OTP request, OTP verify, JWT issue, refresh, logout. Works for all three user roles.

**How to build it:**

Create `backend/app/integrations/upstash.py`:
```python
import httpx, os

UPSTASH_URL = os.getenv("UPSTASH_REDIS_REST_URL")
UPSTASH_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN")

async def redis_set(key: str, value: str, ttl_seconds: int):
    async with httpx.AsyncClient() as client:
        await client.post(f"{UPSTASH_URL}/set/{key}/{value}/ex/{ttl_seconds}",
                          headers={"Authorization": f"Bearer {UPSTASH_TOKEN}"})

async def redis_get(key: str) -> str | None:
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{UPSTASH_URL}/get/{key}",
                              headers={"Authorization": f"Bearer {UPSTASH_TOKEN}"})
        data = r.json()
        return data.get("result")

async def redis_del(key: str):
    async with httpx.AsyncClient() as client:
        await client.get(f"{UPSTASH_URL}/del/{key}",
                          headers={"Authorization": f"Bearer {UPSTASH_TOKEN}"})
```

Create `backend/app/integrations/resend_email.py`:
```python
import resend, os
resend.api_key = os.getenv("RESEND_API_KEY")

async def send_otp_email(to_email: str, otp: str, lang: str = "rw"):
    subjects = {"rw": "Kode yawe ya HandyRwanda", "en": "Your HandyRwanda OTP", "fr": "Votre code HandyRwanda"}
    bodies = {
        "rw": f"Kode yawe ni: {otp}\nIyi kode izamara iminota 5.",
        "en": f"Your verification code is: {otp}\nThis code expires in 5 minutes.",
        "fr": f"Votre code de vérification est: {otp}\nCe code expire dans 5 minutes."
    }
    resend.Emails.send({"from": os.getenv("RESEND_FROM_EMAIL"), "to": to_email,
                        "subject": subjects.get(lang, subjects["en"]),
                        "text": bodies.get(lang, bodies["en"])})
```

Create `backend/app/services/auth_service.py`:
```python
import random, string
from datetime import datetime, timedelta
from jose import jwt, JWTError
from app.integrations.upstash import redis_set, redis_get, redis_del
from app.integrations.resend_email import send_otp_email
import os

SECRET = os.getenv("JWT_SECRET")
ALGO = os.getenv("JWT_ALGORITHM", "HS256")

def generate_otp() -> str:
    return "".join(random.choices(string.digits, k=6))

async def request_otp(email: str, lang: str = "rw") -> None:
    otp = generate_otp()
    await redis_set(f"otp:{email}", otp, ttl_seconds=300)  # 5 min TTL
    await send_otp_email(email, otp, lang)

async def verify_otp(email: str, otp: str) -> bool:
    stored = await redis_get(f"otp:{email}")
    if stored == otp:
        await redis_del(f"otp:{email}")
        return True
    return False

def create_access_token(user_id: str, role: str) -> str:
    payload = {"sub": user_id, "role": role,
                "exp": datetime.utcnow() + timedelta(minutes=15)}
    return jwt.encode(payload, SECRET, algorithm=ALGO)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "type": "refresh",
                "exp": datetime.utcnow() + timedelta(days=30)}
    return jwt.encode(payload, SECRET, algorithm=ALGO)
```

Create `backend/app/routers/auth.py` with these endpoints:
- `POST /auth/otp/request` — accepts `{phone_number, email, lang}`, generates OTP, emails it
- `POST /auth/otp/verify` — accepts `{email, otp_code}`, validates, creates user if new, returns `{access_token, refresh_token, user}`
- `POST /auth/refresh` — accepts `{refresh_token}`, returns new access token
- `POST /auth/logout` — blacklists refresh token in Redis with 30-day TTL

Create `backend/app/dependencies/jwt_auth.py`:
```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import os

bearer = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    try:
        payload = jwt.decode(credentials.credentials, os.getenv("JWT_SECRET"),
                              algorithms=[os.getenv("JWT_ALGORITHM", "HS256")])
        return payload  # {"sub": user_id, "role": role}
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

def require_role(*roles):
    async def checker(user=Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return checker
```

---

### 1.4 Design System — All Three Apps

**What to build:** A single source of truth for colors, typography, and spacing. Consistent look across web and mobile.

**Web (`web/src/styles.css`):**
```css
:root {
  --color-primary: #1B5E3B;
  --color-primary-light: #2E7D4F;
  --color-accent: #E8A020;
  --color-accent-light: #FFF8EE;
  --color-bg: #F7F5F0;
  --color-surface: #FFFFFF;
  --color-text: #1A1A1A;
  --color-text-secondary: #6B6B6B;
  --color-verified: #1565C0;
  --color-danger: #C0392B;
  --color-success: #2E7D4F;
  --font-family: 'Plus Jakarta Sans', sans-serif;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 20px;
  --shadow-card: 0 2px 8px rgba(0,0,0,0.08);
}
```

**Mobile (`mobile/src/theme.ts`):**
```typescript
export const colors = {
  primary: '#1B5E3B',
  primaryLight: '#2E7D4F',
  accent: '#E8A020',
  accentLight: '#FFF8EE',
  bg: '#F7F5F0',
  surface: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#6B6B6B',
  verified: '#1565C0',
  danger: '#C0392B',
  success: '#2E7D4F',
};

export const typography = {
  display: { fontSize: 36, fontWeight: '700' as const, fontFamily: 'PlusJakartaSans-Bold' },
  heading: { fontSize: 22, fontWeight: '600' as const },
  subheading: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 24 },
  caption: { fontSize: 12, fontWeight: '500' as const, letterSpacing: 0.3 },
};
```

Load Plus Jakarta Sans in Expo via `expo-font`:
```typescript
// mobile/app/_layout.tsx
import { useFonts } from 'expo-font';
const [loaded] = useFonts({
  'PlusJakartaSans-Regular': require('../assets/fonts/PlusJakartaSans-Regular.ttf'),
  'PlusJakartaSans-SemiBold': require('../assets/fonts/PlusJakartaSans-SemiBold.ttf'),
  'PlusJakartaSans-Bold': require('../assets/fonts/PlusJakartaSans-Bold.ttf'),
});
```

---

### 1.5 Mobile: Auth Screens

**Technology:** React Native, Expo Router, Zustand, expo-secure-store.

**Install:**
```bash
cd mobile
npx expo install expo-router expo-secure-store expo-font expo-status-bar @react-native-async-storage/async-storage zustand axios react-native-safe-area-context react-native-screens
```

**Files to create:**

`mobile/app/(auth)/phone.tsx` — Phone number input screen with Rwanda format validation (`+2507XXXXXXXX`). On submit, calls `POST /auth/otp/request`. Shows inline validation, not an alert. Uses `colors.primary` green button.

`mobile/app/(auth)/otp.tsx` — 6-cell OTP input (one digit per cell, auto-advance on input). 60-second resend countdown. Calls `POST /auth/otp/verify`. On success, stores tokens in `expo-secure-store` and navigates to onboarding or home.

`mobile/app/(auth)/register.tsx` — Shown only for new users. Collect `full_name`, language preference (Kinyarwanda/English/French — shown as flag chips, not a dropdown). Role selection: Client or Artisan. Clean, single-screen form.

`mobile/store/authStore.ts`:
```typescript
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  setAuth: (user: User, accessToken: string, refreshToken: string) => Promise<void>;
  clearAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  setAuth: async (user, accessToken, refreshToken) => {
    await SecureStore.setItemAsync('access_token', accessToken);
    await SecureStore.setItemAsync('refresh_token', refreshToken);
    set({ user, accessToken });
  },
  clearAuth: async () => {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    set({ user: null, accessToken: null });
  },
}));
```

`mobile/services/api.ts` — Axios instance with base URL from env, request interceptor to attach `Authorization: Bearer <token>`, response interceptor to auto-refresh on 401 using the stored refresh token.

---

### 1.6 i18n — Three Languages from Day One

**Technology:** `i18n-js` + `expo-localization`.

**Install:** `npx expo install expo-localization i18n-js`

Create `mobile/i18n/rw.json`, `en.json`, `fr.json` with every UI string. Structure:
```json
{
  "auth": {
    "phone_placeholder": "Numero ya telefoni (+250...)",
    "otp_title": "Injiza kode yoherejwe",
    "resend": "Ohereza nanone"
  },
  "home": {
    "greeting_morning": "Muraho {{name}} 👋",
    "search_placeholder": "Shakisha inzobere..."
  }
}
```

`mobile/i18n/index.ts`:
```typescript
import * as Localization from 'expo-localization';
import { I18n } from 'i18n-js';
import rw from './rw.json';
import en from './en.json';
import fr from './fr.json';

const i18n = new I18n({ rw, en, fr });
i18n.locale = Localization.locale.startsWith('rw') ? 'rw' : 
               Localization.locale.startsWith('fr') ? 'fr' : 'en';
i18n.enableFallback = true;
i18n.defaultLocale = 'rw';

export default i18n;
```

All strings in every screen must go through `i18n.t('key')`. No hardcoded English text anywhere.

---

### 1.7 CI/CD — GitHub Actions

Create `.github/workflows/ci.yml`:
```yaml
name: CI
on: [push, pull_request]
jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install -r backend/requirements.txt
      - run: cd backend && pytest -v
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run type-check
      - run: npm test -w web
  mobile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm test -w mobile
```

Create `.github/workflows/deploy.yml` — runs on merge to `main`, deploys backend to Render and web to Render/GitHub Pages.

---

### 1.8 Sprint 1 Deliverables Checklist

- [ ] Monorepo boots with `npm run dev`
- [ ] All database tables migrated to Supabase
- [ ] `POST /auth/otp/request` sends OTP email via Resend
- [ ] `POST /auth/otp/verify` issues JWT tokens
- [ ] Mobile phone + OTP screens working end-to-end
- [ ] Design tokens (colors, fonts) consistent across web and mobile
- [ ] All text strings in `rw.json`, `en.json`, `fr.json`
- [ ] GitHub Actions CI green on first push

---

## Sprint 2 — Artisan Onboarding, Profiles & ID Verification

**Goal:** Artisans can fully onboard, build rich profiles with portfolio photos, submit their National ID for admin verification, and appear as verified on the platform. The trust system — the core product value — is live.

---

### 2.1 Backend: Artisan Profile APIs

**What to build:** Full artisan profile CRUD, portfolio management, skill/category management, verification status management, and the admin verification queue.

**How to build it:**

Create `backend/app/integrations/supabase_storage.py`:
```python
import httpx, os, base64, uuid

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
BUCKET = "artisan-media"

async def upload_image(base64_data: str, folder: str, filename: str = None) -> str:
    """Upload base64 image to Supabase Storage. Returns public URL."""
    if not filename:
        filename = f"{uuid.uuid4()}.jpg"
    path = f"{folder}/{filename}"
    image_bytes = base64.b64decode(base64_data.split(",")[-1])
    headers = {
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "image/jpeg",
        "x-upsert": "true"
    }
    async with httpx.AsyncClient() as client:
        await client.post(f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}",
                          headers=headers, content=image_bytes)
    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{path}"
```

Create `backend/app/routers/artisans.py`:

**Endpoints:**
- `POST /artisans/profile` — Create or update artisan profile. Accepts `bio`, `years_experience`, `service_radius_km`, `latitude`, `longitude`, `location_label`, `hourly_rate`, `fixed_rate`, `spoken_languages[]`. Requires `artisan` role JWT.
- `GET /artisans/profile/me` — Current artisan's own full profile.
- `GET /artisans/{user_id}/profile` — Public artisan profile view (used by clients). Returns profile + skills + portfolio + reviews summary + community score.
- `PUT /artisans/profile/me/availability` — Toggle `is_available` boolean. Cached in Upstash Redis key `artisan_availability:{user_id}` with 5-minute TTL for fast reads.
- `POST /artisans/profile/me/id-verification` — Accepts `national_id_number`, `national_id_doc_base64`, `selfie_base64`. Uploads both images to Supabase Storage under `id-docs/` folder (private bucket). Sets `verification_status = 'pending'`. Sends email to admin via Resend.
- `GET /categories` — List all active categories with translations.
- `POST /artisans/skills` — Accepts `category_ids: List[UUID]`. Upserts `artisan_skills` junction rows.
- `POST /artisans/portfolio` — Accepts `photo_base64`, `job_type`, `description`. Uploads to Supabase Storage `portfolio/` folder. Creates `PortfolioPhoto` row. Max 12 photos enforced.
- `DELETE /artisans/portfolio/{photo_id}` — Deletes portfolio photo.

Create `backend/app/routers/admin.py`:

**Endpoints (all require `admin` role):**
- `GET /admin/artisans/pending` — Artisans with `verification_status = 'pending'`. Returns profile with ID doc URL (signed URL from Supabase Storage, valid 10 minutes).
- `POST /admin/artisans/{user_id}/approve` — Sets `verification_status = 'id_verified'`. Sends approval email via Resend and Expo push notification to artisan.
- `POST /admin/artisans/{user_id}/reject` — Sets `verification_status = 'unverified'`. Body: `{reason: string}`. Sends rejection email with reason.
- `POST /categories` — Create new category (name, name_rw, name_fr, icon_emoji).
- `PUT /categories/{id}` — Update category.
- `DELETE /categories/{id}` — Soft delete (`is_active = false`).

**Artisan search endpoint** (`GET /artisans/search`):
```python
# PostGIS geo-query with composite scoring
@router.get("/artisans/search")
async def search_artisans(
    category_id: UUID | None = None,
    latitude: float = Query(...),
    longitude: float = Query(...),
    radius_km: int = Query(default=10, le=50),
    filter: str | None = None,  # "available", "verified", "pro"
    page: int = 1,
    db: AsyncSession = Depends(get_db)
):
    query = """
        SELECT 
            u.id, u.full_name, u.avatar_url,
            ap.average_rating, ap.total_reviews, ap.is_available,
            ap.verification_status, ap.community_score,
            ap.hourly_rate,
            ST_Distance(ap.location::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography) / 1000 AS distance_km,
            -- Composite ranking score
            (
                (1 - ST_Distance(ap.location::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography) / (:radius_km * 1000)) * 0.40
                + (ap.average_rating / 5.0) * 0.30
                + (COALESCE(ap.completion_rate, 0)) * 0.20
                + (CASE WHEN ap.verification_status = 'pro_verified' THEN 1 ELSE 0 END) * 0.10
            ) AS rank_score
        FROM users u
        JOIN artisan_profiles ap ON u.id = ap.user_id
        LEFT JOIN artisan_skills ask ON ap.user_id = ask.artisan_id
        WHERE ST_DWithin(ap.location::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radius_km * 1000)
        AND u.is_active = true
        AND (:category_id IS NULL OR ask.category_id = :category_id)
        ORDER BY rank_score DESC
        LIMIT 20 OFFSET :offset
    """
    # Cache result in Upstash Redis for 2 minutes
```

---

### 2.2 Community Safety Score Calculation

**What to build:** The `community_score` on every artisan profile — a multidimensional trust signal that goes beyond stars. Calculated nightly as a background task and on each completed booking.

**How to build it:**

Create `backend/app/services/community_score_service.py`:
```python
async def recalculate_community_score(artisan_id: str, db: AsyncSession):
    """
    Community Score = weighted composite of:
    - ID verification: 25 points if id_verified, 50 if pro_verified
    - Response rate (% replied within 2 hours): 0-20 points
    - On-time arrival rate (before-photo timestamp vs scheduled time): 0-20 points  
    - Repeat client rate (% clients who rebooked): 0-10 points
    - Average rating (normalized): 0-15 points
    - Completion rate (completed/accepted): 0-10 points
    Max: 100 points
    """
    # Fetch metrics from DB
    # Calculate weighted sum
    # UPDATE artisan_profiles SET community_score = score WHERE user_id = artisan_id
```

Display on artisan profile as: a progress bar (0–100) broken into five colored segments, each labeled with its component.

---

### 2.3 Mobile: Artisan Onboarding Flow

**Technology:** Expo Router, expo-image-picker, expo-location, react-native-maps with OSM tiles.

**Install:**
```bash
npx expo install expo-image-picker expo-location react-native-maps expo-camera
```

**Screens to create:**

`mobile/app/(artisan)/onboarding/step1-bio.tsx` — Bio text area (250 char limit with live counter), years of experience (number picker 1–30), spoken languages (multi-select chips: Kinyarwanda, English, French, Swahili).

`mobile/app/(artisan)/onboarding/step2-skills.tsx` — Grid of service category cards with emoji icons. Multi-select with checkmark overlay. Rate input below each selected category (optional hourly rate in RWF).

`mobile/app/(artisan)/onboarding/step3-location.tsx` — Map screen using `react-native-maps` with OSM tile URL (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`). Shows current GPS location as initial center. Draggable pin. Below map: service radius slider (1–50 km) that draws a green circle on the map. Shows coverage area in text: "You'll be visible to clients within **15 km** — covering most of Kigali."

`mobile/app/(artisan)/onboarding/step4-id.tsx` — Two sections: (1) Photo of Rwanda National ID (front). (2) Selfie holding the ID. Uses `expo-image-picker` with `allowsEditing: true`. Shows uploaded thumbnails with green checkmarks. Explains the verification process and timeline.

`mobile/app/(artisan)/profile/portfolio.tsx` — Grid of portfolio photos (3-column). Each tile shows the photo with a job-type label overlay. Tap to expand. `+` button to add (opens picker → `upload_image` → creates portfolio row). Tap existing → show detail with delete option.

---

### 2.4 Web: Admin Verification Dashboard

**Technology:** TanStack Start (already in `web/`), TanStack Query, Tailwind CSS.

**Files to create:**

`web/src/routes/admin/verification.tsx` — Table of pending artisans. Columns: Photo, Name, Phone, Submitted date, ID Doc (link opens Supabase signed URL in new tab), Selfie (thumbnail inline), Actions (Approve / Reject).

On Reject click: opens a modal with a textarea for rejection reason. Sends `POST /admin/artisans/{id}/reject` with reason.

On Approve click: shows confirmation dialog: "Approve Jean-Pierre Habimana's identity?" → Confirm → `POST /admin/artisans/{id}/approve` → row removes from list with success toast.

**Component:** `web/src/components/VerificationBadge.tsx` — renders the correct badge (🟡 Unverified / 🔵 ID Verified / 🟢 Pro Verified / 🏅 TVET) based on `verification_status` prop.

---

### 2.5 Sprint 2 Deliverables Checklist

- [ ] Artisan can complete 4-step onboarding including map location picker
- [ ] Portfolio photo upload working (Supabase Storage)
- [ ] ID verification documents uploaded (private bucket, signed URLs)
- [ ] Admin can approve/reject from web dashboard
- [ ] Artisan receives email + push notification on approval
- [ ] `GET /artisans/search` returns PostGIS-ranked results
- [ ] Community Score computed and stored on booking completion
- [ ] Language picker in onboarding works in all 3 languages

---

## Sprint 3 — Job Posting, Discovery & Smart Matching

**Goal:** Clients can post jobs with photos and location. Artisans see a live feed of relevant nearby jobs. The map view shows both artisans and jobs. Price anchoring shows typical rates per category/district. This sprint makes the core marketplace loop functional.

---

### 3.1 Backend: Job & Bid APIs

**What to build:** Job creation, geo-filtered job feed, bid submission, bid accept/reject, with AI-powered price anchoring.

**How to build it:**

Create `backend/app/routers/jobs.py`:

**Endpoints:**
- `POST /jobs` — Client creates a job. Body: `{category_id, title, description, latitude, longitude, location_label, scheduled_time?, budget?, photos_base64: string[]}`. Upload photos to Supabase Storage `job-photos/` folder. Set `status = 'open'`. After creation, trigger background task to notify nearby artisans.
- `GET /jobs` — Client's own jobs list. Filter by `status`.
- `GET /jobs/{job_id}` — Job detail with photos, bids (if owner), location.
- `GET /jobs/available` — **Artisan feed.** Geo-filtered. Query: `ST_DWithin(jobs.location, artisan.location, artisan.service_radius_km * 1000) AND status = 'open' AND category matches artisan skills`. Ordered by recency + distance. Cached per artisan in Redis for 90 seconds.
- `DELETE /jobs/{job_id}` — Cancel own open job (client only, before any bid accepted).

Create `backend/app/routers/bids.py`:

**Endpoints:**
- `POST /jobs/{job_id}/bids` — Artisan submits bid. Body: `{proposed_price, message, proposed_start_time}`. One bid per artisan per job enforced at DB level (unique constraint). Sends push + in-app notification to client.
- `GET /jobs/{job_id}/bids` — Client views all bids on their job. Each bid includes artisan's name, avatar, rating, verification badge, proposed price, message.
- `POST /bids/{bid_id}/accept` — Client accepts bid. Transitions: `bid.status = 'accepted'`, all other bids on same job `status = 'rejected'`, `job.status = 'booked'`. Creates `Booking` row with `status = 'pending_payment'`. Push + email notifications to both parties.
- `POST /bids/{bid_id}/reject` — Client rejects bid. Artisan notified.
- `PUT /bids/{bid_id}` — Artisan edits bid (only while `status = 'pending'`). Price or message only.

Create `backend/app/services/price_anchor_service.py`:
```python
async def get_price_anchor(category_id: str, district: str, db: AsyncSession) -> dict:
    """
    Returns: {min: int, median: int, max: int, currency: 'RWF', sample_size: int}
    Calculated from completed bookings in same category + district over last 90 days.
    Cached in Redis for 1 hour per (category_id, district) pair.
    Falls back to nationwide median if district has < 5 samples.
    """
```

Create `backend/app/integrations/huggingface.py`:
```python
import httpx, os

HF_TOKEN = os.getenv("HUGGINGFACE_API_TOKEN")
HEADERS = {"Authorization": f"Bearer {HF_TOKEN}"}

async def get_job_category_match(job_description: str) -> list[dict]:
    """
    Use Helsinki-NLP/text-classification or a zero-shot classifier to
    suggest the most relevant service category for a job description.
    Used to auto-suggest category when client types a description.
    Model: facebook/bart-large-mnli (zero-shot, free on HF Inference API)
    """
    payload = {
        "inputs": job_description,
        "parameters": {
            "candidate_labels": ["plumbing", "electrical", "painting", "carpentry",
                                  "cleaning", "masonry", "welding", "gardening"]
        }
    }
    async with httpx.AsyncClient() as client:
        r = await client.post(
            "https://api-inference.huggingface.co/models/facebook/bart-large-mnli",
            headers=HEADERS, json=payload, timeout=15.0)
        return r.json()  # Returns labels with confidence scores

async def translate_message(text: str, src_lang: str, tgt_lang: str) -> str:
    """
    Translate chat message using Helsinki-NLP models.
    Supported pairs: rw↔en, en↔fr, fr↔en
    Model: Helsinki-NLP/opus-mt-{src}-{tgt}
    """
    model = f"Helsinki-NLP/opus-mt-{src_lang}-{tgt_lang}"
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"https://api-inference.huggingface.co/models/{model}",
            headers=HEADERS, json={"inputs": text}, timeout=20.0)
        result = r.json()
        return result[0]["translation_text"] if isinstance(result, list) else text
```

**Artisan notification on new nearby job** (background task, triggered after `POST /jobs`):
```python
# backend/app/services/notification_service.py
async def notify_artisans_of_new_job(job: Job, db: AsyncSession):
    """
    Find artisans: matching category + job location within their service_radius_km.
    Use PostGIS ST_DWithin. Batch fetch their expo_push_tokens.
    Send push notifications in batches of 100 (Expo limit).
    Also create Notification rows in DB for in-app inbox.
    """
```

---

### 3.2 Mobile: Job Posting Flow (Client)

**Screens to create:**

`mobile/app/(client)/post-job/index.tsx` — Entry point. Shows category grid (same icons as home screen). Tapping a category takes you to step 2 with that category pre-selected.

`mobile/app/(client)/post-job/details.tsx` — Title (autocompleted from AI category match as user types), description textarea (triggers HuggingFace category suggestion after 2-second debounce), date/time picker, optional budget field with "Typical range: 5,000–15,000 RWF" shown below (from price anchor API), photo attachments (up to 5, expo-image-picker).

`mobile/app/(client)/post-job/location.tsx` — Map with pin drop. Default to GPS location. Allow manual adjustment. Show district name resolved from coordinates (reverse geocode via Nominatim OSM API — free). "Confirm location" button.

`mobile/app/(client)/post-job/confirm.tsx` — Summary card: category icon + name, description preview, date/time, location label, budget, photo thumbnails. Total: "Post Job (Free)". Submit button.

`mobile/app/(client)/jobs/[jobId]/bids.tsx` — Bid list view. Each bid card shows: artisan avatar, name, verification badge, ⭐ rating, proposed price (large, prominent), message excerpt, proposed start time. "Accept" (amber button) and "Reject" (outline button) per bid. Accepted bid transitions the screen to booking view.

---

### 3.3 Mobile: Artisan Job Feed

`mobile/app/(artisan)/jobs/index.tsx` — Feed of available nearby jobs. Tabs: **Nearby** (geo-sorted) and **Category** (filtered by artisan's skills). Each job card: category icon, title, location label + distance, budget (if provided), time ago posted, client's district. "View Details" → job detail screen.

`mobile/app/(artisan)/jobs/[jobId]/index.tsx` — Job detail. Full description, photos (horizontal scroll), map showing job location relative to artisan's location (route distance via OSRM — free routing API). Price anchor shown: "Typical price for this work in Kiyovu: **8,000–14,000 RWF**". Bid form at bottom: price input (pre-filled with median anchor), message textarea, proposed start time. Submit Bid button.

`mobile/app/(artisan)/jobs/[jobId]/bid-sent.tsx` — Success state. Shows "Your bid has been sent. We'll notify you when the client responds." and a link to the artisan's active bids list.

---

### 3.4 Map View — Artisan Discovery

`mobile/app/(client)/search/map.tsx` — Full-screen OSM map. Custom green teardrop pins for artisan locations (using `react-native-maps` `<Marker>` with custom icon). Tapping a pin slides up a `<BottomSheet>` (install `@gorhom/bottom-sheet`) with the artisan summary card: photo, name, rating, distance, category pills, "View Profile" button. Does not navigate away from map. Filter chips float at top of screen.

**OSM tile configuration for react-native-maps:**
```tsx
<MapView
  mapType="none"
  style={{ flex: 1 }}
  initialRegion={...}
>
  <UrlTile
    urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
    maximumZ={19}
    flipY={false}
    tileSize={256}
  />
  {artisans.map(a => (
    <Marker key={a.id} coordinate={{ latitude: a.lat, longitude: a.lng }}>
      <ArtisanMapPin artisan={a} />
    </Marker>
  ))}
</MapView>
```

---

### 3.5 Sprint 3 Deliverables Checklist

- [ ] Client can post a job with photos and location in under 2 minutes
- [ ] AI auto-suggests category from description (HuggingFace zero-shot)
- [ ] Price anchor shown in job post and bid form
- [ ] Artisan job feed shows geo-filtered results
- [ ] Artisan can submit, edit, and see status of bids
- [ ] Client can accept/reject bids with instant push notification
- [ ] Map view shows artisans as custom pins, bottom sheet on tap
- [ ] All text localized in 3 languages

---

## Sprint 4 — Booking Lifecycle, Real-Time Updates & Payments

**Goal:** The full booking lifecycle works end-to-end with real-time status updates via WebSockets. The trust-based payment flow (manual mobile money with in-app confirmation) is live. Before/After photo verification is implemented. The auto-confirm fallback runs as a scheduled task.

---

### 4.1 Backend: Booking State Machine

**What to build:** The booking lifecycle API — every state transition, with WebSocket pushes and notifications at each step.

**Booking state machine:**
```
PENDING_PAYMENT → CONFIRMED → IN_PROGRESS → COMPLETED → REVIEWED
                      ↓              ↓
                  CANCELLED      DISPUTED → RESOLVED
```

Create `backend/app/routers/bookings.py`:

**Endpoints:**
- `GET /bookings/client` — Client's bookings, paginated, filter by status.
- `GET /bookings/artisan` — Artisan's bookings.
- `GET /bookings/{booking_id}` — Full booking detail: job info, artisan/client profiles, all status history, before/after photos, payment status.
- `POST /bookings/{booking_id}/confirm-payment` — **Client confirms they've sent mobile money.** Sets `status = 'confirmed'`. Shows artisan's MoMo number to client (revealed only at this step). Artisan receives push: "Payment sent by [Client Name]. Please confirm receipt."
- `POST /bookings/{booking_id}/confirm-receipt` — **Artisan confirms they received payment.** Sets `status = 'in_progress'`. Both parties notified. Job begins.
- `POST /bookings/{booking_id}/before-photo` — Artisan uploads before-photo at job start. Body: `{photo_base64}`. Timestamps stored. Required before marking in_progress in v2 (optional in v1).
- `POST /bookings/{booking_id}/after-photo` — Artisan uploads after-photo at job completion. Body: `{photo_base64}`.
- `POST /bookings/{booking_id}/complete` — Artisan marks job done. Status → `completed` (pending client confirmation). Client gets notification with both before + after photos: "Jean-Pierre says your job is complete. Confirm to release payment."
- `POST /bookings/{booking_id}/confirm-completion` — **Client confirms job done.** Status → `completed`. Artisan's earnings log updated. Sets `auto_confirm_at = NULL`. Both parties prompted to review.
- `POST /bookings/{booking_id}/cancel` — Body: `{reason}`. Allowed in `pending_payment` or `confirmed` states only. Notifies other party.
- `POST /bookings/{booking_id}/dispute` — Body: `{reason}`. Allowed in `in_progress` or `completed`. Creates dispute record, notifies admin, sets status → `disputed`.
- `GET /bookings/{booking_id}/payment-info` — Returns artisan's MTN/Airtel number (formatted for easy copy) and the exact amount to send. Rate-limited: only callable after bid acceptance.

**Auto-confirm background task:**
```python
# backend/app/tasks/auto_confirm.py
# Run every hour via APScheduler (install: pip install apscheduler)
# Find bookings where status='completed' AND auto_confirm_at < NOW()
# Call confirm_completion for each (system-initiated)
# Log: "Auto-confirmed booking {id} after 48 hours"
```

**WebSocket setup** (`backend/app/routers/ws.py`):
```python
from fastapi import WebSocket, WebSocketDisconnect
from app.integrations.upstash import redis_subscribe  # polling-based for Upstash

connected: dict[str, WebSocket] = {}

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await websocket.accept()
    connected[user_id] = websocket
    try:
        while True:
            # Poll Upstash Redis for messages on channel f"updates:{user_id}"
            # Send to client if found
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        del connected[user_id]

async def push_to_user(user_id: str, event_type: str, data: dict):
    """Called by booking service on every state change."""
    ws = connected.get(user_id)
    if ws:
        await ws.send_json({"type": event_type, "data": data})
    # Also write to DB notifications table (for offline users)
    await create_notification(user_id, event_type, data)
```

---

### 4.2 Before & After Photo Verification Feature

This is one of HandyRwanda's most powerful viral features — it eliminates disputes and auto-builds portfolios.

**Backend:**
- `before_photo_url` and `after_photo_url` stored on `Booking`.
- Before-photo timestamp stored in `before_photo_taken_at`. On-time rate calculated: `before_photo_taken_at` vs `booking.scheduled_time`.
- After-photos auto-added to artisan's portfolio with `job_type` and date — zero extra effort for artisan.

**Mobile — Before Photo Screen** (`mobile/app/(artisan)/bookings/[id]/before-photo.tsx`):
- Camera view (expo-camera), no gallery picker (must be taken live — authenticity).
- GPS stamp and timestamp overlay burned into the photo display (not the file, just UI).
- "This photo will be shown to your client when you mark the job complete."
- On upload success: `POST /bookings/{id}/before-photo` → status bar updates.

**Mobile — Completion Confirmation Screen** (`mobile/app/(client)/bookings/[id]/confirm-complete.tsx`):
- Side-by-side before/after photos with "BEFORE" and "AFTER" labels.
- Star rating prompt below: "How did it go?" 1–5 stars (tap to set).
- "Confirm Completion" button (green, full-width). "Raise Dispute" link (text, red).
- This screen makes clients feel informed and in control at the critical trust moment.

---

### 4.3 Mobile: Booking Management Screens

`mobile/app/(client)/bookings/index.tsx` — Tabs: Active, Past. Each booking card: artisan photo, name, job title, status pill (color-coded), scheduled date, price. Tap → booking detail.

`mobile/app/(client)/bookings/[id]/index.tsx` — Booking detail. Status timeline at top (horizontal progress steps: Booked → Payment → In Progress → Done). Below: payment instructions (artisan MoMo number + amount, copy button), message thread (link to chat), before/after photos when available, action buttons contextual to current status.

`mobile/app/(artisan)/bookings/[id]/index.tsx` — Same structure. Actions: Start Job (→ before photo), Mark Complete (→ after photo), View earnings.

**Real-time connection:**
```typescript
// mobile/hooks/useBookingUpdates.ts
import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';

export function useBookingUpdates(onUpdate: (event: BookingEvent) => void) {
  const { user, accessToken } = useAuthStore();
  
  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE_URL}/ws/${user?.id}?token=${accessToken}`);
    ws.onmessage = (e) => onUpdate(JSON.parse(e.data));
    ws.onerror = () => setTimeout(() => {/* reconnect */}, 3000);
    return () => ws.close();
  }, [user?.id]);
}
```

---

### 4.4 Artisan Income Intelligence Dashboard

This feature makes HandyRwanda an essential financial tool for artisans, not just a job board.

**Backend:**
- `GET /artisans/me/earnings` — Returns earnings grouped by month for last 12 months. Calculated from confirmed bookings.
- `GET /artisans/me/earnings/analytics` — Returns: best-performing category (highest average rate), income projection (current pace × 30 days), category comparison ("Your electrical jobs earn 35% more per hour than painting").
- `GET /artisans/me/earnings/statement?month=2026-05` — Returns JSON formatted for RRA income statement. PDF generated client-side.

**Mobile** (`mobile/app/(artisan)/earnings/index.tsx`):
- Monthly bar chart (recharts-equivalent for React Native: `victory-native`).
- Install: `npx expo install victory-native react-native-svg`
- "This Month: 47,500 RWF" in large display typography at top.
- Insight cards below chart: "💡 Your top skill: Electrical (avg 12,000 RWF/job)", "📈 At this pace, you'll earn ~85,000 RWF this month."
- "Download Income Statement" button → generates a formatted PDF using `expo-print` and `expo-sharing`.

---

### 4.5 Sprint 4 Deliverables Checklist

- [ ] Full booking state machine with all transitions
- [ ] WebSocket pushes status updates in real-time to both parties
- [ ] Mobile money payment flow (manual confirmation) works end-to-end
- [ ] Before/after photo upload with camera (no gallery for before photo)
- [ ] After-photos auto-added to artisan portfolio
- [ ] Auto-confirm runs 48h after artisan marks complete
- [ ] Artisan earnings dashboard with monthly chart + insights
- [ ] RWF income statement download via expo-print

---

## Sprint 5 — In-App Chat, Reviews & Notifications

**Goal:** Clients and artisans can communicate through bilingual in-app chat (with AI translation). The review system is live with mutual accountability. All notification channels are wired up and working. The in-app notification inbox functions offline.

---

### 5.1 Backend: Messaging System

**What to build:** Real-time chat tied to bookings, with automatic AI translation between Kinyarwanda, English, and French.

**Endpoints** (`backend/app/routers/messages.py`):
- `GET /bookings/{booking_id}/messages` — Paginated message history. Returns `[{id, sender_id, content, translated_content, lang, voice_note_url, created_at, is_read}]`.
- `POST /bookings/{booking_id}/messages` — Send message. Body: `{content, lang}`. Triggers:
  1. Store in `messages` table.
  2. If sender and receiver have different `preferred_lang`: call `translate_message()` from HuggingFace integration. Store translated text in `translated_content`.
  3. Push WebSocket event `new_message` to receiver.
  4. Send Expo push notification if receiver is offline.
- `POST /bookings/{booking_id}/messages/voice` — Upload voice note (base64 audio, max 60s). Store in Supabase Storage `voice-notes/`. Creates message with `voice_note_url`.
- `PUT /bookings/{booking_id}/messages/read` — Mark all messages in booking as read by current user.

**Translation flow:**
```python
# In message service, after storing the message:
sender_lang = sender.preferred_lang  # e.g., "rw"
receiver_lang = receiver.preferred_lang  # e.g., "en"

if sender_lang != receiver_lang:
    try:
        translated = await translate_message(content, sender_lang, receiver_lang)
        await update_message_translation(message.id, translated)
    except Exception:
        pass  # Translation failure is non-blocking — original message still delivered
```

---

### 5.2 Mobile: Chat Screen

`mobile/app/(shared)/chat/[bookingId].tsx`:

Install: `npx expo install expo-av` (for voice note recording/playback)

Chat UI structure:
```tsx
// Bubble layout: sent messages right (green), received left (white card)
// Each bubble:
// - Message text (large enough to read at arm's length)
// - If translated: small italic text below original: "Translation: ..."
// - Timestamp (right-aligned, small, secondary color)
// - Read receipt dot (✓ delivered, ✓✓ read — green ticks)

// Input bar (pinned to keyboard):
// [🎤 Voice] [Text input: "Type a message..."] [📷] [➤ Send]
```

Voice note recording: tap 🎤 to start, release to send. Playback shows waveform + duration. Uses `expo-av` for recording and playback.

Translation display: a small "🌐 Translate" chip on received messages that triggers on-demand translation if auto-translate is off. In Settings, toggle "Auto-translate messages" (on by default).

---

### 5.3 Backend: Review System

**What to build:** Verified dual-review system. Only parties to a completed booking can review. Artisan can reply. Flagging for moderation.

**Endpoints** (`backend/app/routers/reviews.py`):
- `POST /bookings/{booking_id}/review` — Submit review. Body: `{rating: 1-5, comment: string (max 500 chars)}`. Validations: booking must be `completed`, current user is `client_id`, no existing review for this booking. Triggers: create `Review` row, recalculate `artisan_profiles.average_rating`, recalculate `community_score`.
- `POST /bookings/{booking_id}/review/artisan` — Artisan reviews client. Same pattern. Stored in `client_reviews` table.
- `POST /reviews/{review_id}/reply` — Artisan adds public reply to client's review. One reply per review. Max 300 chars.
- `POST /reviews/{review_id}/flag` — Flag review for moderation. Creates admin task.
- `GET /artisans/{user_id}/reviews` — Public paginated reviews for artisan profile. Returns: review text, rating, reviewer first name (privacy), date, artisan reply if any.

**Rating recalculation** (called after every new review):
```python
async def recalculate_artisan_rating(artisan_id: str, db: AsyncSession):
    result = await db.execute(
        text("SELECT AVG(rating)::NUMERIC(2,1), COUNT(*) FROM reviews WHERE artisan_id = :id"),
        {"id": artisan_id}
    )
    avg_rating, total = result.one()
    await db.execute(
        text("UPDATE artisan_profiles SET average_rating = :r, total_reviews = :t WHERE user_id = :id"),
        {"r": avg_rating, "t": total, "id": artisan_id}
    )
    await recalculate_community_score(artisan_id, db)
```

---

### 5.4 Mobile: Review Screens

`mobile/app/(client)/bookings/[id]/review.tsx` — Shown automatically after `confirm-completion`. Star selector (5 large stars, tap to rate). Text area "What did you think?" with suggested prompts as chips ("On time", "Great quality", "Professional", "Would hire again"). Character counter. Skip link.

`mobile/app/(artisan)/reviews/index.tsx` — Artisan's reviews list. Aggregate at top: 4.8 ⭐ from 47 reviews. Breakdown bar: 5★ ████████░ 72%, 4★ ██░ 18% etc. Each review shows client first name + initial avatar, date, stars, comment, and artisan's reply (if any) with a reply input if not yet replied.

---

### 5.5 Backend: Notification System

**What to build:** Unified notification service that writes to DB (in-app inbox), pushes via Expo, and emails via Resend — all from a single `notify()` call.

Create `backend/app/services/notification_service.py`:
```python
from app.integrations.upstash import redis_set
from app.models.notification import Notification
from resend import send_email  # wrapper around resend integration
import httpx, os

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

async def notify(
    user_id: str,
    event_type: str,
    title: str,
    body: str,
    data: dict,
    send_email: bool = False,
    email_subject: str = None,
    db: AsyncSession = None
):
    # 1. Write to notifications table (always)
    notif = Notification(user_id=user_id, event_type=event_type,
                          title=title, body=body, payload=data)
    db.add(notif)
    
    # 2. Push via Expo (if user has push token)
    user = await get_user(user_id, db)
    if user.expo_push_token:
        async with httpx.AsyncClient() as client:
            await client.post(EXPO_PUSH_URL, json={
                "to": user.expo_push_token,
                "title": title,
                "body": body,
                "data": data,
                "sound": "default"
            })
    
    # 3. Email via Resend (for critical events only)
    if send_email and user.email:
        await send_transactional_email(user.email, email_subject or title, body)
    
    await db.commit()
```

Notification event types and their channels:

| Event | Push | In-App | Email |
|---|---|---|---|
| `new_nearby_job` | ✅ | ✅ | — |
| `bid_received` | ✅ | ✅ | — |
| `bid_accepted` | ✅ | ✅ | ✅ |
| `payment_confirmation_needed` | ✅ | ✅ | ✅ |
| `job_started` | ✅ | ✅ | — |
| `job_completed` | ✅ | ✅ | ✅ |
| `dispute_opened` | ✅ | ✅ | ✅ |
| `review_received` | ✅ | ✅ | — |
| `verification_approved` | ✅ | ✅ | ✅ |
| `verification_rejected` | ✅ | ✅ | ✅ |

`GET /notifications` — Paginated inbox, unread count in response headers. `PUT /notifications/read-all` — Mark all read.

**Mobile notification inbox** (`mobile/app/(shared)/notifications/index.tsx`):
- Bell icon in header with red badge (unread count from Zustand store).
- Grouped by date (Today, Yesterday, This Week, Older).
- Each item: event icon + title + body + time ago. Tap navigates to relevant screen.
- Loaded from SQLite for offline access (`expo-sqlite`).

---

### 5.6 Offline Mode

**What to build:** The app functions with full read access to cached data when offline. Queued writes sync when back online.

Create `mobile/services/sqlite.ts`:
```typescript
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabase('handyrwanda.db');

export function setupDatabase() {
  db.transaction(tx => {
    tx.executeSql(`CREATE TABLE IF NOT EXISTS artisans (id TEXT PRIMARY KEY, data TEXT, cached_at INTEGER)`);
    tx.executeSql(`CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY, data TEXT, cached_at INTEGER)`);
    tx.executeSql(`CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, data TEXT, is_read INTEGER)`);
    tx.executeSql(`CREATE TABLE IF NOT EXISTS message_queue (id TEXT PRIMARY KEY, endpoint TEXT, payload TEXT, created_at INTEGER)`);
  });
}

export async function cacheArtisan(artisan: Artisan) {
  db.transaction(tx => {
    tx.executeSql(
      `INSERT OR REPLACE INTO artisans (id, data, cached_at) VALUES (?, ?, ?)`,
      [artisan.id, JSON.stringify(artisan), Date.now()]
    );
  });
}

export async function queueOfflineAction(endpoint: string, payload: object) {
  // Store action to retry when online
}
```

Create `mobile/hooks/useNetworkSync.ts` — Uses `@react-native-community/netinfo`. On reconnect: drains `message_queue`, sends queued messages, refreshes stale cache items.

`mobile/components/OfflineBanner.tsx` — Amber strip at top of all screens when `isConnected === false`. Text: "Nta murandasi — Wereka ibibitswe" / "Offline — Showing cached data". Disappears when connection restores with a brief "Back online" green flash.

---

### 5.7 Sprint 5 Deliverables Checklist

- [ ] In-app chat with real-time WebSocket delivery
- [ ] Voice note recording and playback
- [ ] Auto-translation on messages between different-language users
- [ ] Review submission gated to completed bookings only
- [ ] Artisan can reply to reviews
- [ ] All 11 notification event types firing correctly
- [ ] In-app notification inbox works offline (SQLite cache)
- [ ] Offline banner displays and queued actions sync on reconnect
- [ ] Expo push tokens registered and stored per user

---

## Sprint 6 — Admin Dashboard, Analytics & SEO Public Pages

**Goal:** The admin dashboard is fully operational with user management, dispute resolution, analytics dashboards, and category management. Public-facing SEO-optimized artisan profile pages and job board are live on the web, driving organic discovery and viral sharing.

---

### 6.1 Admin Dashboard — Full Build

**Technology:** TanStack Start (already scaffolded in `web/`), TanStack Query, Recharts, Tailwind CSS.

**Install:**
```bash
cd web
npm install recharts @tanstack/react-query date-fns
```

**Route: `web/src/routes/admin/index.tsx`** — Overview dashboard.

Top stat cards (4-grid):
- Total Users (with % growth last 30 days)
- Active Artisans (verified + unverified)
- Completed Jobs This Month
- Dispute Rate (%)

Charts (Recharts):
- `LineChart`: Daily bookings over last 30 days (2 lines: created vs completed)
- `BarChart`: Top 5 service categories by volume
- `AreaChart`: User registrations over time (split: clients vs artisans)
- Geographic heatmap: District-level job density using a simple SVG Rwanda map with district polygons colored by intensity.

**Route: `web/src/routes/admin/users.tsx`** — User management.
- Searchable table: Name, Phone, Role, Status, Join date, Bookings count.
- Row actions: View full profile, Suspend (toggle `is_active`), Change role, Delete (soft).
- Filter chips: All, Clients, Artisans, Suspended.
- Bulk action: Select multiple → Send broadcast notification.

**Route: `web/src/routes/admin/disputes.tsx`** — Dispute resolution center.
- Table of disputed bookings. Each row expandable: full job history, payment confirmation trail, chat transcript, before/after photos.
- Resolution form: "Resolve in favor of:" [Client] / [Artisan] + resolution notes.
- After resolution: `PATCH /admin/disputes/{booking_id}/resolve` → notifies both parties via email + push.

**Route: `web/src/routes/admin/categories.tsx`** — Category management.
- Drag-to-reorder list (install `@dnd-kit/core`).
- Inline edit: name (rw/en/fr), emoji icon, active toggle.
- Add new category form.
- Changes take effect immediately (no redeployment).

**Route: `web/src/routes/admin/broadcast.tsx`** — Push + email broadcast.
- Compose form: title, body, target audience (All / Clients only / Artisans only / Specific user by phone).
- Preview of notification appearance.
- Send button → `POST /admin/notifications/broadcast`.

---

### 6.2 Public SEO Web Pages

**What to build:** Server-rendered, SEO-optimized public pages that rank in Google for searches like "plumber Kigali", "best electrician Rwanda". These pages drive organic traffic and are the primary viral growth driver on the web.

**Route: `web/src/routes/index.tsx`** — Public homepage.
- Hero: "Rwanda's trusted artisan marketplace" with search bar (category + location).
- Stats: "2,400+ verified artisans · 8,500+ jobs completed · 4.8★ average rating"
- Category grid (same 8 categories as mobile, with artisan counts per category).
- How it works: 3-step infographic (Post Job → Get Bids → Pay on Completion).
- Featured artisans: 6 top-rated artisan cards.
- Footer: links, Kinyarwanda/English/French switcher.

**Route: `web/src/routes/artisan.$id.tsx`** — Public artisan profile page (SEO). Server-rendered.

This page generates a shareable URL: `handyrwanda.rw/artisan/jean-pierre-123`. Artisans share this as their business card.

Meta tags:
```tsx
// TanStack Start head() export
export const head = () => ({
  title: `${artisan.full_name} — ${artisan.primary_category} in ${artisan.district} | HandyRwanda`,
  meta: [
    { name: 'description', content: `${artisan.full_name} is a verified ${artisan.primary_category} in ${artisan.district}, Rwanda. ⭐ ${artisan.average_rating} from ${artisan.total_reviews} reviews. Book online.` },
    { property: 'og:image', content: artisan.avatar_url },
    { property: 'og:type', content: 'profile' }
  ]
});
```

This enables artisans to share `handyrwanda.rw/artisan/their-name` on WhatsApp and Facebook with a rich preview (photo + rating + category). This is the primary **viral loop** for artisan acquisition.

**Route: `web/src/routes/search.tsx`** — Public artisan search / job board.
- Search bar: category dropdown + location text (district name).
- Artisan cards in grid.
- URL is shareable and bookmarkable: `/search?category=plumbing&location=Kiyovu`
- Meta tags: "Find plumbers in Kiyovu, Kigali — HandyRwanda"

**Route: `web/src/routes/pro.tsx`** — Artisan sign-up landing page. Designed to convert. "Join HandyRwanda as an artisan. Get more clients. Get paid faster." Statistics. Testimonials. CTA → mobile app download or web onboarding.

**Sitemap generation** (`web/src/sitemap.ts`) — generates `/sitemap.xml` with all artisan profile URLs. Submitted to Google Search Console. This is how the SEO flywheel starts.

---

### 6.3 Sprint 6 Deliverables Checklist

- [ ] Admin analytics dashboard with 4 charts and growth stats
- [ ] Dispute resolution: full job history + chat visible to admin
- [ ] User management: search, suspend, role change
- [ ] Category management: add/edit/reorder without redeployment
- [ ] Broadcast notifications: push + email to all/segment
- [ ] Public homepage with stats and category grid (server-rendered)
- [ ] Artisan public profile page with OG tags for WhatsApp sharing
- [ ] `/search` page SEO-optimized with shareable URLs
- [ ] Sitemap generated and submitted to Google

---

## Sprint 7 — Viral Growth Engine, Performance & Launch Readiness

**Goal:** Implement the features that make HandyRwanda spread — referral system, WhatsApp sharing, recurring bookings, Emergency Mode, artisan profile shareability, and the mechanisms that turn users into advocates. Optimize for performance on low-end Android devices. Achieve full production readiness.

---

### 7.1 Viral Growth Features

#### 7.1.1 Referral System

**Backend:**
- Every user gets a unique `referral_code` (6-char alphanumeric, e.g., `JEAN47`) generated on registration.
- `GET /users/me/referral-stats` — Returns: `{referral_code, total_referred, qualified_referred, pending_reward}`.
- Registration endpoint modified: accepts optional `referral_code`. If valid, creates `Referral` row with `status = 'registered'`.
- When referred user completes first job: background task updates referral `status = 'qualified'`, adds discount credit to referrer.

**Mobile** (`mobile/app/(shared)/referral/index.tsx`):
- Large referral code display (e.g., big green text `JEAN47`).
- Share button that opens native share sheet with message: "I use HandyRwanda to find trusted artisans in Rwanda. Use my code **JEAN47** to get 10% off your first booking! 👷 Download: handyrwanda.rw/app"
- Progress bar: "3 of 5 friends joined. Refer 2 more to earn 5,000 RWF credit."
- How it works: 3 steps illustrated.

#### 7.1.2 WhatsApp Deep Share

Every artisan profile has a "Share" button. On tap:
```typescript
// mobile/components/ShareArtisanButton.tsx
import { Share } from 'react-native';

async function shareArtisan(artisan: Artisan) {
  await Share.share({
    message: `I found a great ${artisan.primary_category} on HandyRwanda! 
    
👷 *${artisan.full_name}*
⭐ ${artisan.average_rating}/5 (${artisan.total_reviews} reviews)
✅ Verified

Book them here: https://handyrwanda.rw/artisan/${artisan.slug}`,
    url: `https://handyrwanda.rw/artisan/${artisan.slug}`,
    title: `${artisan.full_name} on HandyRwanda`
  });
}
```

When the link opens in WhatsApp and someone clicks it, the rich OG preview (artisan photo + rating + category) is shown. This is the primary word-of-mouth loop.

#### 7.1.3 Emergency Services Mode

**Backend:**
- `POST /jobs/emergency` — Special job type. Body: `{category_id, description, latitude, longitude}`. Sets `is_emergency = true`, `status = 'open'`. Triggers `notify_artisans_emergency()`: **simultaneously notifies ALL available artisans** in matching category within 10 km. First artisan to accept gets the job. No bidding — first-come, first-served.
- `POST /jobs/{job_id}/emergency-accept` — Artisan claims emergency job. Immediately creates booking. All other artisans notified "Job filled".
- Surge pricing: `agreed_price = suggested_price * 1.20`. Shown to client before posting.

**Mobile** — Emergency button is a red ⚠️ button on the home screen, separate from the normal job post flow:
```tsx
<TouchableOpacity style={styles.emergencyButton} onPress={openEmergencyFlow}>
  <Text style={styles.emergencyText}>🆘 EMERGENCY</Text>
  <Text style={styles.emergencySubtext}>Burst pipe? Power failure? Get help now.</Text>
</TouchableOpacity>
```

Emergency job post is a single screen (not multi-step): category, brief description, location auto-detected. Posts immediately. Artisans notified within 3 seconds.

#### 7.1.4 Recurring Bookings

**Backend:**
- `POST /bookings/{booking_id}/set-recurring` — Body: `{frequency: 'weekly'|'biweekly'|'monthly', end_after_occurrences: int}`. Creates `RecurringBookingSchedule` row.
- Celery periodic task: weekly, creates new bookings from active schedules. Notifies both parties: "Your recurring cleaning with Solange is scheduled for Friday."
- `DELETE /recurring/{schedule_id}` — Cancel recurring schedule.

**Mobile** — After a completed booking, show: "💚 Book this artisan again regularly? Set up a recurring service." → opens a frequency picker modal.

**This feature has the highest LTV of any feature in the entire app** — it turns one-time users into long-term retained clients.

#### 7.1.5 Artisan Referral to Platform

Artisans can refer other artisans. Different incentive: "Refer an artisan who completes 5 jobs and earn 1 month Pro subscription free."

---

### 7.2 Pro Artisan Subscription

**What to build:** The first monetization feature. Artisans pay for Pro status which gives them priority placement and enhanced profile features.

**Backend:**
- `POST /artisans/me/subscribe/pro` — Initiates pro subscription. Returns `{momo_number, amount: 2000, reference: 'PRO-{user_id}-{month}'}`. Admin manually verifies payment → activates.
- Once revenue exists: this endpoint will auto-process payment via MoMo API (designed as a drop-in upgrade).
- Pro artisans: amber tint on search cards, `⚡ Pro` badge, priority in search ranking (+10% boost), analytics access, 20 portfolio photos (vs 12 free), response time SLA badge.

**Admin web panel** (`web/src/routes/admin/subscriptions.tsx`) — Table of pro subscription requests. Each row: artisan name, phone, reference number, status. Admin confirms payment → `POST /admin/artisans/{id}/activate-pro`.

---

### 7.3 Performance Optimization

#### Low-end Android Performance (Critical for Rwanda)

**Mobile optimizations:**

1. **Image lazy loading and compression:**
   ```typescript
   // Use expo-image instead of Image for all artisan photos
   import { Image } from 'expo-image';
   // It caches aggressively and loads progressively
   <Image
     source={{ uri: artisan.avatar_url }}
     style={styles.avatar}
     placeholder={blurhash}  // LQIP placeholder while loading
     contentFit="cover"
     transition={200}
   />
   ```

2. **Virtualized lists everywhere:**
   - Use `FlashList` (install: `npx expo install @shopify/flash-list`) instead of `FlatList`.
   - `FlashList` is 10x faster than `FlatList` on low-end Android.

3. **Bundle optimization:**
   - Run `npx expo export --platform android --analyze` to find large dependencies.
   - Tree-shake unused icons (only import specific icons, not entire icon sets).
   - Use `expo-font` subset loading.

4. **API response compression:**
   - Add `GZipMiddleware` to FastAPI.
   - Return only required fields (avoid `SELECT *`).
   - Paginate all lists (max 20 items per page).

5. **Skeleton screens:**
   - Every data-fetching screen shows a skeleton loader (gray pulsing placeholders) instead of a spinner. Users perceive skeleton screens as 40% faster. Use `react-native-skeleton-placeholder`.

#### Backend performance:

1. **Redis caching layer** for all read-heavy endpoints:
   - Artisan search results: cache 2 min per (category, lat, lng, radius) key.
   - Category list: cache 10 min.
   - Artisan public profiles: cache 5 min, invalidated on profile update.

2. **Database query optimization:**
   - Add `EXPLAIN ANALYZE` to all geo-queries and confirm spatial index is used.
   - Add composite index: `CREATE INDEX idx_artisan_search ON artisan_profiles (is_available, verification_status) WHERE is_active = true;`
   - Connection pooling: use `asyncpg` pool size 10.

3. **Rate limiting** (`slowapi` — already in requirements.txt):
   ```python
   from slowapi import Limiter
   from slowapi.util import get_remote_address
   limiter = Limiter(key_func=get_remote_address)
   
   @router.post("/auth/otp/request")
   @limiter.limit("5/minute")  # Prevent OTP spam
   async def request_otp(...): ...
   ```

---

### 7.4 App Store & Launch Readiness

#### EAS Build Configuration

`mobile/eas.json`:
```json
{
  "cli": { "version": ">= 7.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "android": { "buildType": "aab" },
      "ios": { "credentialsSource": "remote" }
    }
  },
  "submit": {
    "production": {}
  }
}
```

**Build and submit:**
```bash
# Install EAS CLI
npm install -g eas-cli
eas login

# Build for Android
eas build --platform android --profile production

# Submit to Play Store
eas submit --platform android
```

#### App Store Assets

- App icon: 1024×1024px, green background with white toolbelt icon.
- Feature graphic: 1024×500px, showing artisan + client handshake on Rwanda landscape background.
- Screenshots: 5 screenshots per device size (phone + tablet). Show: Home, Search, Artisan Profile, Booking Flow, Chat.
- Store description in all 3 languages (Kinyarwanda primary, English, French).

#### Production Deployment

**Backend on Render.com (free tier):**

`render.yaml` (in repo root):
```yaml
services:
  - type: web
    name: handyrwanda-api
    env: python
    buildCommand: "cd backend && pip install -r requirements.txt && alembic upgrade head"
    startCommand: "cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT"
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: JWT_SECRET
        sync: false
      # ... all other env vars
```

**Web on Render.com:**
```yaml
  - type: web
    name: handyrwanda-web
    env: node
    buildCommand: "npm ci && npm run build -w web"
    startCommand: "npm run start -w web"
```

**Health check endpoint:**
```python
# backend/app/routers/health.py
@router.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
```

---

### 7.5 Security Hardening

Before launch, complete this security checklist:

**Authentication:**
- [ ] JWT tokens signed with HS256, secret minimum 256 bits (32 random bytes)
- [ ] Refresh tokens stored hashed in DB, not plaintext
- [ ] OTP: max 3 attempts before lockout (Redis counter with 15-min TTL)
- [ ] Account lockout after 5 failed logins (Redis key `login_attempts:{email}`)

**API security:**
- [ ] CORS configured: `ALLOWED_ORIGINS` whitelist only (no `*` in production)
- [ ] Rate limiting on all auth endpoints (5 req/min for OTP)
- [ ] Input validation via Pydantic on all request bodies
- [ ] SQL injection impossible via SQLAlchemy parameterized queries
- [ ] File uploads: validate MIME type, max 10 MB, scan for malicious content
- [ ] Admin endpoints require `admin` role AND IP allowlist (Render IP only)

**Data privacy:**
- [ ] Artisan location: show only distance ("2.3 km") until booking confirmed
- [ ] Phone numbers masked in API responses: `+25078****12`
- [ ] ID documents in private Supabase bucket (signed URLs, 10-min expiry)
- [ ] GDPR-style data deletion: `DELETE /users/me` soft-deletes, full purge after 90 days

**Mobile:**
- [ ] JWT stored in `expo-secure-store` (hardware-backed on Android/iOS), never `AsyncStorage`
- [ ] Certificate pinning for production API calls
- [ ] No sensitive data in console logs (strip with Babel plugin in production builds)

---

### 7.6 Sprint 7 Deliverables Checklist

- [ ] Referral system: unique codes, share sheet, reward tracking
- [ ] WhatsApp share button on artisan profiles with rich preview
- [ ] Emergency mode: simultaneous artisan notification, first-accept flow
- [ ] Recurring bookings: weekly/monthly auto-schedule
- [ ] Pro subscription: payment flow + admin activation
- [ ] FlashList replacing all FlatLists
- [ ] Skeleton loaders on all data-fetching screens
- [ ] Redis caching on artisan search and profile endpoints
- [ ] Rate limiting on auth endpoints
- [ ] EAS production build compiles successfully
- [ ] App submitted to Google Play Store
- [ ] Backend deployed on Render.com with health check passing
- [ ] All security checklist items completed

---

## Environment Variables Reference

```bash
# backend/.env

# ── Core ──────────────────────────────────────────────────────────
APP_SECRET_KEY=<32-byte-random-hex>
DEBUG=false
ALLOWED_ORIGINS=https://handyrwanda.rw,https://admin.handyrwanda.rw

# ── Supabase ──────────────────────────────────────────────────────
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SUPABASE_ANON_KEY=eyJhbGc...
DATABASE_URL=postgresql://postgres:password@db.xxxx.supabase.co:5432/postgres

# ── Upstash Redis ─────────────────────────────────────────────────
UPSTASH_REDIS_REST_URL=https://xxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxxx

# ── JWT ───────────────────────────────────────────────────────────
JWT_SECRET=<64-char-random-string>
JWT_ALGORITHM=HS256
JWT_ACCESS_EXPIRE_MINUTES=15
JWT_REFRESH_EXPIRE_DAYS=30

# ── Resend ────────────────────────────────────────────────────────
RESEND_API_KEY=re_xxxx
RESEND_FROM_EMAIL=noreply@handyrwanda.rw

# ── Hugging Face ──────────────────────────────────────────────────
HUGGINGFACE_API_TOKEN=hf_xxxx

# ── Platform Config ───────────────────────────────────────────────
AUTO_CONFIRM_HOURS=48
PLATFORM_COMMISSION_RATE=0.10
MAX_PORTFOLIO_PHOTOS=12
EMERGENCY_SURGE_MULTIPLIER=1.20

# ── Phase 2 Stubs (leave empty until MTN business account obtained) ──
MTN_MOMO_SUBSCRIPTION_KEY=
MTN_MOMO_DISBURSEMENT_KEY=
AIRTEL_CLIENT_ID=
AIRTEL_CLIENT_SECRET=
```

---

## Testing Strategy

### Backend — pytest

```bash
cd backend
pytest tests/ -v --cov=app --cov-report=html
```

Structure:
```
backend/tests/
├── conftest.py          # Fixtures: test DB, test client, mock auth
├── test_auth.py         # OTP request, verify, JWT issue, refresh, logout
├── test_artisans.py     # Profile CRUD, search, geo-query, community score
├── test_jobs.py         # Create, list, geo-filter, bid submit/accept
├── test_bookings.py     # Full state machine, each transition
├── test_messages.py     # Send, receive, translate
├── test_reviews.py      # Submit, rating calculation, reply, flag
├── test_admin.py        # Verification queue, dispute resolution, analytics
└── test_notifications.py # All event types fire correctly
```

Each router must have >80% test coverage before moving to the next sprint.

### Mobile — Jest + React Native Testing Library

```bash
cd mobile && npm test
```

Test every custom hook (`useAuth`, `useBookings`, `useLocation`) and every form submission screen.

### Web — Vitest

```bash
cd web && npm test
```

Test all TanStack Query hooks and admin table interactions.

### End-to-End — Playwright (add in Sprint 6)

```bash
npm install -D @playwright/test
# web/tests/e2e/booking-flow.spec.ts
# Test the complete web booking journey
```

---

## Monetization Unlock Timeline

| Milestone | Action | Revenue Stream |
|---|---|---|
| 50 completed bookings | Launch Pro subscription (manual MoMo) | 2,000 RWF/artisan/month |
| 200 active artisans | Launch Featured Placement | 3,000 RWF/7 days |
| 50,000 RWF/month | Upgrade to Africa's Talking SMS | Better OTP + notifications |
| 100,000 RWF/month | Apply for MTN MoMo business account | Real escrow payments |
| 200,000 RWF/month | Upgrade to Supabase Pro | Lift storage/DB limits |
| 500,000 RWF/month | Hire first part-time moderator | Quality control at scale |

---

## Post-Launch Roadmap

After all 7 sprints ship and the platform is live with real users:

**Phase 2 (next 3 months):**
- MTN MoMo API real escrow integration (replace manual confirmation)
- Africa's Talking SMS OTP (for artisans without email)
- Live job tracking (artisan shares location during active job, client sees ETA)
- Secondary cities launch: Butare, Musanze, Rubavu

**Phase 3 (months 4–6):**
- WhatsApp Business bot (post jobs, get quotes via WhatsApp)
- Corporate/B2B accounts (companies managing multiple service requests)
- TVET certification badge program (Rwanda Polytechnic partnership)
- Uganda launch (same codebase, different i18n + MoMo config)

**Phase 4 (months 7–12):**
- USSD interface via Africa's Talking (feature phone users)
- AI-powered dynamic pricing (demand × time × artisan rating)
- East Africa expansion: Kenya, Tanzania
- HandyRwanda Academy (vetted artisan training content in-app)

---

## The Viral Growth Loop — Summary

HandyRwanda goes viral through four interlocking loops:

**Loop 1 — Artisan sharing:** Every verified artisan gets a personal web page at `handyrwanda.rw/artisan/their-name`. They share this link as their business card on WhatsApp, Facebook, and to family. Each link brings new clients to the platform. Each new client potentially becomes a user.

**Loop 2 — Client referrals:** Clients who get a great job done share the experience with friends: "I found this electrician on HandyRwanda — 4.9 stars, fixed my wiring in 2 hours." The before/after photo in the review makes this story visual and shareable.

**Loop 3 — Emergency word of mouth:** Emergency mode creates memorable stories. "My pipe burst at 10pm and I had a plumber here in 40 minutes through this app." This kind of story travels.

**Loop 4 — SEO flywheel:** Every artisan profile and every completed job generates indexed content. "Best electrician in Kiyovu" → Google → HandyRwanda. As more jobs complete, more long-tail searches find the platform. No paid advertising needed.

**The result:** HandyRwanda becomes the only name Rwandans say when someone asks "how do I find a good artisan?" — the same way Uber became the only name people say for rides.

---

**Built for Rwanda. Ready for Africa. Built to go viral. 🇷🇼**

*Built solo. Built for $0. Built to last.*

---

*Last updated: May 2026 — DEVELOPMENT.Md v2.0*