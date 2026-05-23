# HandyRwanda — Developer Blueprint

> **Version:** 1.0.0  
> **Last Updated:** May 2026  
> **Type:** Mobile-first Home Services Marketplace  
> **Market:** Rwanda (East Africa)  
> **Model:** Adapted from Thumbtack / Handy.com — built for MTN MoMo,
> low-bandwidth networks, and the Kinyarwanda-speaking market

## Table of Contents

1.  [Project
    > Overview](https://claude.ai/chat/8e0e1339-a3af-4ef1-9ae0-f91ab0cb81b5#1-project-overview)

2.  [Problem
    > Statement](https://claude.ai/chat/8e0e1339-a3af-4ef1-9ae0-f91ab0cb81b5#2-problem-statement)

3.  [Solution
    > Architecture](https://claude.ai/chat/8e0e1339-a3af-4ef1-9ae0-f91ab0cb81b5#3-solution-architecture)

4.  [Tech
    > Stack](https://claude.ai/chat/8e0e1339-a3af-4ef1-9ae0-f91ab0cb81b5#4-tech-stack)

5.  [System
    > Architecture](https://claude.ai/chat/8e0e1339-a3af-4ef1-9ae0-f91ab0cb81b5#5-system-architecture)

6.  [Database
    > Schema](https://claude.ai/chat/8e0e1339-a3af-4ef1-9ae0-f91ab0cb81b5#6-database-schema)

7.  [API
    > Design](https://claude.ai/chat/8e0e1339-a3af-4ef1-9ae0-f91ab0cb81b5#7-api-design)

8.  [Feature
    > Specifications](https://claude.ai/chat/8e0e1339-a3af-4ef1-9ae0-f91ab0cb81b5#8-feature-specifications)

    - 8.1 [Authentication & User
      > Management](https://claude.ai/chat/8e0e1339-a3af-4ef1-9ae0-f91ab0cb81b5#81-authentication--user-management)

    - 8.2 [Artisan Profiles &
      > Verification](https://claude.ai/chat/8e0e1339-a3af-4ef1-9ae0-f91ab0cb81b5#82-artisan-profiles--verification)

    - 8.3 [Job Posting &
      > Matching](https://claude.ai/chat/8e0e1339-a3af-4ef1-9ae0-f91ab0cb81b5#83-job-posting--matching)

    - 8.4 [Booking
      > Management](https://claude.ai/chat/8e0e1339-a3af-4ef1-9ae0-f91ab0cb81b5#84-booking-management)

    - 8.5 [Payment & Escrow
      > System](https://claude.ai/chat/8e0e1339-a3af-4ef1-9ae0-f91ab0cb81b5#85-payment--escrow-system)

    - 8.6 [Reviews &
      > Ratings](https://claude.ai/chat/8e0e1339-a3af-4ef1-9ae0-f91ab0cb81b5#86-reviews--ratings)

    - 8.7 [Geo-Search &
      > Maps](https://claude.ai/chat/8e0e1339-a3af-4ef1-9ae0-f91ab0cb81b5#87-geo-search--maps)

    - 8.8 [Notifications (Push +
      > SMS)](https://claude.ai/chat/8e0e1339-a3af-4ef1-9ae0-f91ab0cb81b5#88-notifications-push--sms)

    - 8.9 [Offline
      > Mode](https://claude.ai/chat/8e0e1339-a3af-4ef1-9ae0-f91ab0cb81b5#89-offline-mode)

    - 8.10 [Admin
      > Dashboard](https://claude.ai/chat/8e0e1339-a3af-4ef1-9ae0-f91ab0cb81b5#810-admin-dashboard)

    - 8.11 [Localisation
      > (i18n)](https://claude.ai/chat/8e0e1339-a3af-4ef1-9ae0-f91ab0cb81b5#811-localisation-i18n)

9.  [User Roles &
    > Permissions](https://claude.ai/chat/8e0e1339-a3af-4ef1-9ae0-f91ab0cb81b5#9-user-roles--permissions)

10. [Mobile App
    > Screens](https://claude.ai/chat/8e0e1339-a3af-4ef1-9ae0-f91ab0cb81b5#10-mobile-app-screens)

11. [Payment
    > Integration](https://claude.ai/chat/8e0e1339-a3af-4ef1-9ae0-f91ab0cb81b5#11-payment-integration)

12. [Security
    > Considerations](https://claude.ai/chat/8e0e1339-a3af-4ef1-9ae0-f91ab0cb81b5#12-security-considerations)

13. [Monetisation
    > Model](https://claude.ai/chat/8e0e1339-a3af-4ef1-9ae0-f91ab0cb81b5#13-monetisation-model)

14. [Build Roadmap &
    > Phases](https://claude.ai/chat/8e0e1339-a3af-4ef1-9ae0-f91ab0cb81b5#14-build-roadmap--phases)

15. [Folder
    > Structure](https://claude.ai/chat/8e0e1339-a3af-4ef1-9ae0-f91ab0cb81b5#15-folder-structure)

16. [Environment
    > Variables](https://claude.ai/chat/8e0e1339-a3af-4ef1-9ae0-f91ab0cb81b5#16-environment-variables)

17. [Deployment
    > Guide](https://claude.ai/chat/8e0e1339-a3af-4ef1-9ae0-f91ab0cb81b5#17-deployment-guide)

18. [Third-Party
    > Integrations](https://claude.ai/chat/8e0e1339-a3af-4ef1-9ae0-f91ab0cb81b5#18-third-party-integrations)

19. [Testing
    > Strategy](https://claude.ai/chat/8e0e1339-a3af-4ef1-9ae0-f91ab0cb81b5#19-testing-strategy)

20. [Future
    > Roadmap](https://claude.ai/chat/8e0e1339-a3af-4ef1-9ae0-f91ab0cb81b5#20-future-roadmap)

## 1. Project Overview

**HandyRwanda** is a mobile-first, two-sided marketplace that connects
verified skilled artisans — plumbers, electricians, painters,
carpenters, cleaners, and other tradespeople — with households and
businesses across Rwanda that need their services.

The platform creates a trusted, transparent, and accountable ecosystem
where:

- **Clients** can find, book, and pay a vetted artisan in under 5
  > minutes.

- **Artisans** build a verifiable digital reputation that earns them
  > consistent, fairly-priced work.

- **The platform** earns a commission on completed jobs while providing
  > the trust infrastructure that neither side could build
  > independently.

### Core Design Principles

- **Mobile-first:** The primary interface is a React Native app. 80%+ of
  > Rwandan internet users are on mobile.

- **Africa-first auth:** Phone number + OTP, not email. MTN MoMo and
  > Airtel Money for payments, not credit cards.

- **Offline-capable:** Cache-first architecture so the app functions in
  > low- or no-connectivity environments.

- **Trust by design:** Escrow payments, ID verification, and a review
  > system are not features — they are the product.

- **Kinyarwanda-first:** All UI strings support Kinyarwanda, English,
  > and French from day one.

## 2. Problem Statement

Finding a skilled artisan in Rwanda today is a chaotic, unsafe, and
time-consuming process:

- No centralised directory of vetted tradespeople exists.

- Word-of-mouth and WhatsApp group referrals are the primary discovery
  > mechanism — highly unreliable.

- There is no price transparency; clients are routinely overcharged or
  > given unexpected quotes.

- There is no accountability mechanism — a bad artisan faces zero
  > consequences and can keep working.

- Artisans lack a stable pipeline of work, leading to income
  > unpredictability.

- Clients, particularly women and the elderly, are vulnerable to being
  > conned or receiving dangerous substandard work (e.g., faulty
  > electrical work).

## 3. Solution Architecture

HandyRwanda solves this with three interlocking systems:

**Supply side (Artisan):** Onboard → submit ID → get verified badge →
list skills and service radius → accept jobs → get paid → accumulate
reviews.

**Demand side (Client):** Register → post a job or search by category +
location → review artisan profiles → book → pay into escrow → confirm
completion → leave review.

**Trust infrastructure:** Escrow holds payment until job confirmation.
Reviews are verified (only clients who completed a booking can review).
ID verification creates accountability. Dispute resolution protects both
sides.

## 4. Tech Stack

### Recommended Stack (Production-Ready, Free-Tier Launchable)

| Layer              | Technology                      | Reason                                                        |
|--------------------|---------------------------------|---------------------------------------------------------------|
| Mobile frontend    | React Native (Expo SDK 51+)     | Single codebase for Android + iOS; Expo Go for device testing |
| Web frontend       | Next.js 14 (App Router)         | Artisan profiles and job board as SEO-indexable web pages     |
| Backend API        | FastAPI (Python 3.11+)          | Async, fast, auto-generates OpenAPI docs                      |
| Database           | PostgreSQL 15 + PostGIS         | Native geo queries via ST_DWithin; battle-tested              |
| Cache              | Redis 7                         | Cache artisan search results, geo queries, session data       |
| Authentication     | JWT + OTP via Africa's Talking  | Phone-number OTP; Africa-first; no email dependency           |
| Maps               | OpenStreetMap + Leaflet.js      | 100% free; excellent Kigali coverage                          |
| Mobile maps        | react-native-maps (OSM tiles)   | Free OSM tiles; no Google Maps billing                        |
| Payments           | MTN MoMo API + Airtel Money API | Rwanda's dominant mobile money providers                      |
| Push notifications | Expo Push Notifications         | Free; cross-platform                                          |
| SMS fallback       | Africa's Talking SMS API        | For artisans in the field without internet                    |
| File storage       | Cloudinary (free tier)          | Artisan profile photos, portfolio images, ID document uploads |
| Offline storage    | expo-sqlite + AsyncStorage      | Local caching on device                                       |
| Backend deploy     | Railway.app                     | Free tier; PostgreSQL + Redis on one platform                 |
| Web deploy         | Vercel                          | Free tier; instant Git deploys                                |
| CI/CD              | GitHub Actions                  | Free for public repos; automates tests + deploys              |

### Why Not Google Maps / Stripe / Firebase?

- **Google Maps:** Billing starts immediately at scale; OSM + Leaflet is
  > free forever.

- **Stripe:** Not directly available in Rwanda; MTN MoMo and Airtel
  > Money are the payment rails that actually work.

- **Firebase:** Vendor lock-in; PostgreSQL with PostGIS gives you more
  > power for geo-based queries at no cost.

## 5. System Architecture

┌──────────────────────────────────────────────────────────────┐

│ CLIENT LAYER │

│ │

│ React Native App (Expo) Next.js Web (Vercel) │

│ \[iOS + Android\] \[SEO profiles + job board\] │

└─────────────────────────┬────────────────────────────────────┘

│ HTTPS / REST + WebSocket

┌─────────────────────────▼────────────────────────────────────┐

│ API LAYER (Railway.app) │

│ │

│ FastAPI (Python 3.11+) │

│ ├── /auth JWT + OTP │

│ ├── /users Client & artisan profiles │

│ ├── /jobs Job posting & search │

│ ├── /bookings Booking lifecycle │

│ ├── /payments Escrow + MoMo integration │

│ ├── /reviews Ratings & comments │

│ ├── /notifications Push + SMS dispatch │

│ └── /admin Dashboard APIs │

└──────────┬─────────────────────────────┬─────────────────────┘

│ │

┌──────────▼──────────┐ ┌─────────────▼──────────────────────┐

│ PostgreSQL 15 │ │ Redis 7 │

│ + PostGIS │ │ │

│ │ │ ├── Artisan search cache │

│ ├── users │ │ ├── Geo query cache │

│ ├── artisans │ │ ├── Session tokens │

│ ├── jobs │ │ ├── OTP codes (TTL: 5 min) │

│ ├── bookings │ │ └── Rate limiting counters │

│ ├── payments │ └────────────────────────────────────┘

│ ├── reviews │

│ └── categories │

└─────────────────────┘

│

┌──────────▼──────────────────────────────────────────────────┐

│ THIRD-PARTY SERVICES │

│ │

│ Africa's Talking MTN MoMo API Airtel Money API │

│ (OTP + SMS) (Payments) (Payments) │

│ │

│ Cloudinary Expo Push OpenStreetMap │

│ (Media storage) (Notifications) (Map tiles) │

└─────────────────────────────────────────────────────────────┘

### Key Architectural Decisions

**Monolithic API, modular structure:** A single FastAPI app with clearly
separated modules (routers, services, models). This is faster to build
and deploy for an MVP. Microservices can be extracted later if needed.

**PostGIS for geo-queries:** Every artisan profile stores a location
point and service_radius_km. Queries like "find verified plumbers within
8km of lat/lng" are a single SQL statement using ST_DWithin.

**Escrow payment flow:** Payment is collected from the client at booking
time. It is held in a platform-controlled MoMo wallet and released to
the artisan only after the client confirms job completion — or
automatically after 48 hours if no dispute is raised. This is the core
trust mechanism.

**WebSocket for real-time updates:** Booking status changes (artisan
accepted, artisan en route, job complete) are pushed to the client in
real-time via a WebSocket connection managed by FastAPI.

## 6. Database Schema

### Core Tables

-- Enums

CREATE TYPE user_role AS ENUM ('client', 'artisan', 'admin');

CREATE TYPE verification_status AS ENUM ('unverified', 'pending',
'verified', 'rejected');

CREATE TYPE job_status AS ENUM ('open', 'assigned', 'in_progress',
'completed', 'cancelled', 'disputed');

CREATE TYPE booking_status AS ENUM ('pending', 'accepted', 'declined',
'in_progress', 'completed', 'cancelled', 'disputed');

CREATE TYPE payment_status AS ENUM ('pending', 'escrowed', 'released',
'refunded', 'failed');

CREATE TYPE payment_provider AS ENUM ('mtn_momo', 'airtel_money');

-- Users (shared table for clients and artisans)

CREATE TABLE users (

id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

phone VARCHAR(20) UNIQUE NOT NULL,

full_name VARCHAR(100) NOT NULL,

email VARCHAR(150),

avatar_url TEXT,

role user_role NOT NULL DEFAULT 'client',

preferred_lang VARCHAR(5) NOT NULL DEFAULT 'rw', -- rw, en, fr

is_active BOOLEAN NOT NULL DEFAULT TRUE,

last_seen_at TIMESTAMPTZ,

created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

-- Artisan profiles (extends users where role = 'artisan')

CREATE TABLE artisan_profiles (

id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,

bio TEXT,

years_experience SMALLINT DEFAULT 0,

service_radius_km SMALLINT NOT NULL DEFAULT 10,

location GEOGRAPHY(POINT, 4326), -- PostGIS point (lng, lat)

location_label VARCHAR(200), -- Human-readable: "Kicukiro, Kigali"

national_id_number VARCHAR(50),

national_id_doc_url TEXT,

selfie_url TEXT,

verification_status verification_status NOT NULL DEFAULT 'unverified',

verified_at TIMESTAMPTZ,

verified_by UUID REFERENCES users(id),

is_available BOOLEAN NOT NULL DEFAULT TRUE,

hourly_rate_rwf INTEGER, -- Optional indicative rate

rating_avg NUMERIC(3, 2) DEFAULT 0,

rating_count INTEGER DEFAULT 0,

total_jobs_done INTEGER DEFAULT 0,

is_premium BOOLEAN NOT NULL DEFAULT FALSE,

premium_until TIMESTAMPTZ,

created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

-- Service categories (Plumbing, Electrical, Cleaning, etc.)

CREATE TABLE categories (

id SERIAL PRIMARY KEY,

name_rw VARCHAR(100) NOT NULL,

name_en VARCHAR(100) NOT NULL,

name_fr VARCHAR(100) NOT NULL,

icon_name VARCHAR(60), -- Corresponds to icon set key in app

is_active BOOLEAN NOT NULL DEFAULT TRUE,

sort_order SMALLINT DEFAULT 0

);

-- Artisan \<-\> Category mapping (many-to-many)

CREATE TABLE artisan_categories (

artisan_id UUID NOT NULL REFERENCES artisan_profiles(id) ON DELETE
CASCADE,

category_id INTEGER NOT NULL REFERENCES categories(id),

PRIMARY KEY (artisan_id, category_id)

);

-- Artisan portfolio images

CREATE TABLE artisan_portfolio (

id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

artisan_id UUID NOT NULL REFERENCES artisan_profiles(id) ON DELETE
CASCADE,

image_url TEXT NOT NULL,

caption TEXT,

created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

-- Jobs posted by clients

CREATE TABLE jobs (

id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

client_id UUID NOT NULL REFERENCES users(id),

category_id INTEGER NOT NULL REFERENCES categories(id),

title VARCHAR(200) NOT NULL,

description TEXT NOT NULL,

location GEOGRAPHY(POINT, 4326),

location_label VARCHAR(200),

budget_rwf INTEGER, -- Optional max budget

status job_status NOT NULL DEFAULT 'open',

preferred_date DATE,

preferred_time TIME,

images TEXT\[\], -- Array of Cloudinary URLs

created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'

);

-- Bookings (a confirmed match between job and artisan)

CREATE TABLE bookings (

id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

job_id UUID NOT NULL REFERENCES jobs(id),

client_id UUID NOT NULL REFERENCES users(id),

artisan_id UUID NOT NULL REFERENCES artisan_profiles(id),

status booking_status NOT NULL DEFAULT 'pending',

agreed_price_rwf INTEGER NOT NULL,

scheduled_at TIMESTAMPTZ,

started_at TIMESTAMPTZ,

completed_at TIMESTAMPTZ,

client_confirmed_at TIMESTAMPTZ,

cancellation_reason TEXT,

dispute_reason TEXT,

created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

-- Payments (escrow lifecycle)

CREATE TABLE payments (

id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

booking_id UUID UNIQUE NOT NULL REFERENCES bookings(id),

client_id UUID NOT NULL REFERENCES users(id),

artisan_id UUID NOT NULL REFERENCES artisan_profiles(id),

amount_rwf INTEGER NOT NULL,

platform_fee_rwf INTEGER NOT NULL, -- Commission retained

artisan_payout_rwf INTEGER NOT NULL, -- amount - fee

provider payment_provider NOT NULL,

client_phone VARCHAR(20) NOT NULL,

artisan_phone VARCHAR(20) NOT NULL,

status payment_status NOT NULL DEFAULT 'pending',

provider_ref VARCHAR(100), -- MoMo transaction reference

escrowed_at TIMESTAMPTZ,

released_at TIMESTAMPTZ,

refunded_at TIMESTAMPTZ,

created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

-- Reviews (only after booking is completed)

CREATE TABLE reviews (

id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

booking_id UUID UNIQUE NOT NULL REFERENCES bookings(id),

reviewer_id UUID NOT NULL REFERENCES users(id), -- The client

artisan_id UUID NOT NULL REFERENCES artisan_profiles(id),

rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),

comment TEXT,

artisan_reply TEXT,

artisan_replied_at TIMESTAMPTZ,

is_visible BOOLEAN NOT NULL DEFAULT TRUE,

created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

-- Notifications log

CREATE TABLE notifications (

id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

user_id UUID NOT NULL REFERENCES users(id),

title VARCHAR(200) NOT NULL,

body TEXT NOT NULL,

type VARCHAR(50), -- booking_update, payment, review, etc.

data JSONB, -- Extra payload (booking_id, etc.)

is_read BOOLEAN NOT NULL DEFAULT FALSE,

sent_via VARCHAR(20)\[\], -- \['push', 'sms'\]

created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

-- Premium subscriptions

CREATE TABLE premium_subscriptions (

id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

artisan_id UUID NOT NULL REFERENCES artisan_profiles(id),

starts_at TIMESTAMPTZ NOT NULL,

ends_at TIMESTAMPTZ NOT NULL,

amount_rwf INTEGER NOT NULL DEFAULT 500,

payment_id UUID REFERENCES payments(id),

is_active BOOLEAN NOT NULL DEFAULT TRUE,

created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

-- Spatial index for geo-queries (critical for performance)

CREATE INDEX idx_artisan_location ON artisan_profiles USING GIST
(location);

CREATE INDEX idx_job_location ON jobs USING GIST (location);

CREATE INDEX idx_bookings_artisan ON bookings (artisan_id);

CREATE INDEX idx_bookings_client ON bookings (client_id);

CREATE INDEX idx_jobs_status ON jobs (status);

CREATE INDEX idx_reviews_artisan ON reviews (artisan_id);

## 7. API Design

Base URL: https://api.handyrwanda.rw/v1

All endpoints return JSON. Authentication uses Authorization: Bearer
\<jwt_token\>.

### Authentication endpoints

| Method | Endpoint          | Description              |
|--------|-------------------|--------------------------|
| POST   | /auth/request-otp | Send OTP to phone number |
| POST   | /auth/verify-otp  | Verify OTP, return JWT   |
| POST   | /auth/refresh     | Refresh access token     |
| POST   | /auth/logout      | Invalidate refresh token |

### User endpoints

| Method | Endpoint         | Description                 |
|--------|------------------|-----------------------------|
| GET    | /users/me        | Get own profile             |
| PATCH  | /users/me        | Update own profile          |
| POST   | /users/me/avatar | Upload avatar to Cloudinary |
| DELETE | /users/me        | Soft-delete account         |

### Artisan endpoints

| Method | Endpoint                          | Description                               |
|--------|-----------------------------------|-------------------------------------------|
| POST   | /artisans/profile                 | Create artisan profile (role upgrade)     |
| GET    | /artisans/{id}                    | Get artisan public profile                |
| PATCH  | /artisans/me                      | Update own artisan profile                |
| POST   | /artisans/me/verify               | Submit ID + selfie for verification       |
| GET    | /artisans/me/stats                | Get own job stats                         |
| POST   | /artisans/me/portfolio            | Upload portfolio image                    |
| DELETE | /artisans/me/portfolio/{image_id} | Remove portfolio image                    |
| GET    | /artisans/search                  | Search artisans (geo + category + rating) |
| PATCH  | /artisans/me/availability         | Toggle available/unavailable              |

### Category endpoints

| Method | Endpoint    | Description                |
|--------|-------------|----------------------------|
| GET    | /categories | List all active categories |

### Job endpoints

| Method | Endpoint     | Description                                     |
|--------|--------------|-------------------------------------------------|
| POST   | /jobs        | Client posts a new job                          |
| GET    | /jobs        | List jobs (client's own or nearby for artisans) |
| GET    | /jobs/{id}   | Get job details                                 |
| PATCH  | /jobs/{id}   | Update job (client only, if still open)         |
| DELETE | /jobs/{id}   | Cancel/delete job                               |
| GET    | /jobs/nearby | Artisan: get open jobs within service radius    |

### Booking endpoints

| Method | Endpoint                | Description                                 |
|--------|-------------------------|---------------------------------------------|
| POST   | /bookings               | Artisan creates a booking bid on a job      |
| GET    | /bookings               | List own bookings (client or artisan)       |
| GET    | /bookings/{id}          | Get booking details                         |
| PATCH  | /bookings/{id}/accept   | Client accepts artisan's booking            |
| PATCH  | /bookings/{id}/decline  | Client declines bid                         |
| PATCH  | /bookings/{id}/start    | Artisan marks job as started                |
| PATCH  | /bookings/{id}/complete | Artisan marks job as done                   |
| PATCH  | /bookings/{id}/confirm  | Client confirms completion, triggers payout |
| PATCH  | /bookings/{id}/dispute  | Client or artisan raises a dispute          |
| PATCH  | /bookings/{id}/cancel   | Cancel booking (before start only)          |

### Payment endpoints

| Method | Endpoint               | Description                         |
|--------|------------------------|-------------------------------------|
| POST   | /payments/initiate     | Initiate MoMo payment for a booking |
| GET    | /payments/{id}         | Get payment status                  |
| POST   | /payments/{id}/release | Admin: manually release escrow      |
| POST   | /payments/{id}/refund  | Admin: refund to client             |
| GET    | /payments/history      | Own payment history                 |

### Review endpoints

| Method | Endpoint              | Description                                  |
|--------|-----------------------|----------------------------------------------|
| POST   | /reviews              | Client submits review (post-completion only) |
| GET    | /reviews/artisan/{id} | Get all reviews for an artisan               |
| POST   | /reviews/{id}/reply   | Artisan replies to a review                  |
| DELETE | /reviews/{id}         | Admin: remove inappropriate review           |

### Notification endpoints

| Method | Endpoint                 | Description               |
|--------|--------------------------|---------------------------|
| GET    | /notifications           | Get own notifications     |
| PATCH  | /notifications/{id}/read | Mark notification as read |
| PATCH  | /notifications/read-all  | Mark all as read          |
| POST   | /notifications/token     | Register Expo push token  |

### Admin endpoints (admin role only)

| Method | Endpoint                     | Description                         |
|--------|------------------------------|-------------------------------------|
| GET    | /admin/users                 | List all users                      |
| PATCH  | /admin/users/{id}/ban        | Ban a user                          |
| GET    | /admin/artisans/pending      | List artisans awaiting verification |
| PATCH  | /admin/artisans/{id}/verify  | Approve or reject verification      |
| GET    | /admin/disputes              | List open disputes                  |
| PATCH  | /admin/disputes/{id}/resolve | Resolve dispute (refund or release) |
| GET    | /admin/stats                 | Platform-wide stats                 |

## 8. Feature Specifications

### 8.1 Authentication & User Management

**Registration and login flow:**

1.  User enters phone number (Rwanda format: +2507XXXXXXXX).

2.  Backend calls Africa's Talking API to send a 6-digit OTP via SMS.

3.  OTP is stored in Redis with a 5-minute TTL keyed by phone number.

4.  User submits OTP. Backend validates against Redis. On success, a JWT
    > access token (15-minute TTL) and a refresh token (30-day TTL) are
    > returned.

5.  The refresh token is stored in the database (hashed) for revocation
    > support.

6.  First-time users are prompted to complete their profile (name,
    > language preference).

**Token strategy:**

- Access token: short-lived JWT (15 min), stored in memory on device.

- Refresh token: long-lived (30 days), stored securely in
  > expo-secure-store on device.

- On 401 response, the app silently refreshes the access token.

**Phone number validation:**

- Accept Rwandan mobile numbers: MTN (+25078, +25079) and Airtel
  > (+25073).

- Strip and normalise all inputs to E.164 format before processing.

**Profile management:**

- Users can update name, language, and avatar at any time.

- Artisans have an extended profile (see section 8.2).

- Account deletion is soft: is_active = false. Data is retained for 90
  > days per data protection best practice.

### 8.2 Artisan Profiles & Verification

**Profile fields:**

- Full name, phone, avatar

- Bio (text, max 500 characters)

- Years of experience

- Service categories (multi-select from the categories table)

- Service radius (km, slider: 2–50 km)

- Current location (GPS point, updated at login)

- Portfolio images (max 10)

- Hourly rate in RWF (optional indicative figure)

- Availability toggle (on/off)

**Verification process:**

Verification gives an artisan a "Verified" badge that significantly
increases booking conversion.

Steps:

1.  Artisan submits a photo of their Rwandan National ID card (front +
    > back).

2.  Artisan submits a selfie holding the ID.

3.  Documents are uploaded to Cloudinary in a private, admin-only
    > folder.

4.  Artisan profile verification_status is set to pending.

5.  An admin reviews the documents in the admin dashboard.

6.  Admin approves (status → verified) or rejects with a reason (status
    > → rejected).

7.  On approval, the artisan receives a push notification and SMS.

**Verification badge display rules:**

- verified → green shield icon on profile and search results.

- pending → grey clock icon.

- unverified → no badge shown; a prompt in-app encourages submission.

**Premium badge:**

- Artisans can pay 500 RWF/month via MoMo to receive a "Pro" badge.

- Pro artisans are ranked above non-pro artisans with similar ratings in
  > search results.

- Premium status is tracked in premium_subscriptions table with an
  > ends_at timestamp.

**Availability toggle:**

- Artisans can toggle availability on/off (e.g., when on holiday).

- Unavailable artisans do not appear in search results.

- The toggle is visible on the artisan's home screen as a prominent
  > on/off switch.

### 8.3 Job Posting & Matching

**Job posting (client flow):**

1.  Client selects a service category.

2.  Client writes a title and description of the work needed.

3.  Client attaches up to 5 photos (optional, e.g., photo of broken
    > pipe).

4.  Client sets their location (auto-detected via GPS or manually
    > entered).

5.  Client optionally sets a preferred date/time and budget ceiling.

6.  Job is posted with status open and expires after 7 days.

**Artisan matching:**

Artisans discover open jobs in two ways:

Option A — Push-based (recommended): When a job is posted, the backend
queries all verified, available artisans whose service_radius_km covers
the job's location using ST_DWithin. Matching artisans receive a push
notification and SMS.

Option B — Pull-based: Artisans open the "Nearby Jobs" tab, which
queries open jobs within their service radius sorted by distance.

**Search filters available to artisans:**

- Category

- Distance (slider: 1–30 km)

- Budget range

- Posted within (last 24h / last 3 days / last week)

**Job lifecycle states:**

open → assigned (client accepted a bid) → in_progress (artisan started)
→ completed → \[reviewed\]

↓

cancelled

↓

disputed

### 8.4 Booking Management

**Booking bid flow:**

1.  Artisan views a job and submits a bid: proposed price (RWF) +
    > optional message + proposed start time.

2.  Client receives a notification with artisan's profile, rating, and
    > price.

3.  Client can accept one bid or decline all bids and wait.

4.  On acceptance, all other bids for the same job are automatically
    > declined.

5.  The accepted booking moves to pending state, awaiting payment.

**Booking lifecycle states:**

pending (bid submitted, awaiting client accept)

→ accepted (client accepted, payment initiated)

→ in_progress (artisan pressed "Start Job")

→ completed (artisan pressed "Job Done")

→ confirmed (client pressed "Confirm Complete" → triggers payout)

→ disputed (client pressed "Raise Dispute")

→ declined (client declined bid)

→ cancelled (either party cancelled before start)

**Cancellation policy:**

- Client can cancel for free before artisan accepts.

- Client cancels after acceptance but before start: 10% cancellation fee
  > (to compensate artisan).

- Artisan cancels after acceptance: artisan's reliability score is
  > penalised.

- Once job is in_progress, cancellation requires admin intervention.

**Auto-confirmation rule:** If the client does not confirm or dispute
within 48 hours of artisan marking completed, the system automatically
releases payment to the artisan.

### 8.5 Payment & Escrow System

**Flow overview:**

Client initiates payment (MoMo)

→ MoMo API collects funds from client phone

→ Funds held in platform escrow wallet

→ Booking confirmed by client (or auto after 48h)

→ Platform releases payout to artisan

→ Platform retains commission

**MTN MoMo integration:**

Use the MTN MoMo API (Collections product to receive, Disbursements
product to pay out).

Key API calls:

- POST /collection/v1_0/requesttopay — debit client phone.

- Poll GET /collection/v1_0/requesttopay/{referenceId} for status
  > (SUCCESSFUL / FAILED / PENDING).

- POST /disbursement/v1_0/transfer — credit artisan phone on release.

- Store referenceId as provider_ref in the payments table.

**Airtel Money integration:**

Fallback for Airtel subscribers. Uses the Airtel Africa API.

**Commission calculation:**

COMMISSION_RATES = {

"cleaning": 0.10, \# 10%

"plumbing": 0.12,

"electrical": 0.12,

"painting": 0.10,

"carpentry": 0.10,

"default": 0.15, \# 15% for all other categories

}

def calculate_payout(amount_rwf: int, category_slug: str) -\> dict:

rate = COMMISSION_RATES.get(category_slug,
COMMISSION_RATES\["default"\])

fee = round(amount_rwf \* rate)

payout = amount_rwf - fee

return {"platform_fee_rwf": fee, "artisan_payout_rwf": payout}

**Dispute resolution:**

When a dispute is raised:

1.  Both parties are notified.

2.  An admin is alerted via the admin dashboard.

3.  Both parties can submit text evidence and photos through the app.

4.  Admin reviews and decides: full/partial refund to client, or
    > full/partial payout to artisan.

5.  Resolution is executed via the admin payment release/refund API
    > endpoints.

**Receipts:** After payout, both client and artisan receive an SMS
receipt with job summary and amounts.

### 8.6 Reviews & Ratings

**Review eligibility:** Only clients who have a booking in confirmed
state can submit a review for the artisan on that booking. This prevents
fake reviews.

**Rating dimensions:**

- Overall star rating (1–5, required)

- Text comment (optional, max 500 characters)

- Displayed publicly on artisan's profile

**Artisan reply:** Artisans can reply to any review once. The reply is
displayed beneath the review.

**Rating aggregation:** The artisan's rating_avg and rating_count in
artisan_profiles are updated after every new review using a database
trigger or a post-commit service call:

UPDATE artisan_profiles

SET rating_avg = (

SELECT AVG(rating) FROM reviews WHERE artisan_id = NEW.artisan_id AND
is_visible = TRUE

),

rating_count = (

SELECT COUNT(\*) FROM reviews WHERE artisan_id = NEW.artisan_id AND
is_visible = TRUE

)

WHERE id = NEW.artisan_id;

**Review moderation:**

- Admins can hide reviews that violate community guidelines (is_visible
  > = false).

- A report button is available on each review for users to flag
  > inappropriate content.

### 8.7 Geo-Search & Maps

**Artisan search query:**

SELECT

u.full_name,

ap.rating_avg,

ap.rating_count,

ap.is_premium,

ap.verification_status,

ap.hourly_rate_rwf,

ap.location_label,

ST_Distance(ap.location, ST_MakePoint(:lng, :lat)::GEOGRAPHY) / 1000 AS
distance_km

FROM artisan_profiles ap

JOIN users u ON u.id = ap.user_id

JOIN artisan_categories ac ON ac.artisan_id = ap.id

WHERE ac.category_id = :category_id

AND ap.verification_status = 'verified'

AND ap.is_available = TRUE

AND ST_DWithin(ap.location, ST_MakePoint(:lng, :lat)::GEOGRAPHY,
:radius_meters)

ORDER BY

ap.is_premium DESC, -- Premium artisans first

ap.rating_avg DESC, -- Then by rating

distance_km ASC -- Then by distance

LIMIT 20 OFFSET :offset;

**Map display:**

- OpenStreetMap tiles are served via
  > https://tile.openstreetmap.org/{z}/{x}/{y}.png.

- Artisan location markers are rendered as custom SVG pins with category
  > icons.

- Client job location is shown with a blue pulse marker.

- Map interactions: tap a pin to see artisan summary card; tap card to
  > open full profile.

**Location privacy:**

- Artisan exact GPS coordinates are never exposed to clients via the
  > API.

- The API returns distance_km (rounded to 1 decimal) and location_label
  > (neighbourhood-level text) only.

- Exact location is only used server-side for ST_DWithin queries.

**Artisan location update:** Location is updated each time the artisan
opens the app or toggles availability, via a background PATCH
/artisans/me call with the current GPS coordinates.

### 8.8 Notifications (Push + SMS)

**Notification events and channels:**

| Event                             | Push | SMS |
|-----------------------------------|------|-----|
| OTP verification code             | —    | ✅  |
| New job posted nearby (artisan)   | ✅   | ✅  |
| New booking bid received (client) | ✅   | —   |
| Booking accepted by client        | ✅   | ✅  |
| Booking declined                  | ✅   | —   |
| Artisan on the way                | ✅   | ✅  |
| Job marked complete by artisan    | ✅   | —   |
| Payment released to artisan       | ✅   | ✅  |
| Payment receipt (client)          | ✅   | ✅  |
| Dispute raised                    | ✅   | ✅  |
| Dispute resolved                  | ✅   | ✅  |
| Review received (artisan)         | ✅   | —   |
| Verification approved/rejected    | ✅   | ✅  |
| Premium about to expire           | ✅   | ✅  |

**Push notification implementation (Expo):**

\# backend/services/notification_service.py

import httpx

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

async def send_push(token: str, title: str, body: str, data: dict = {}):

payload = {

"to": token,

"title": title,

"body": body,

"data": data,

"sound": "default",

}

async with httpx.AsyncClient() as client:

await client.post(EXPO_PUSH_URL, json=payload)

**SMS via Africa's Talking:**

import africastalking

africastalking.initialize(username="handyrwanda", api_key=AT_API_KEY)

sms = africastalking.SMS

def send_sms(phone: str, message: str):

sms.send(message, \[phone\], sender_id="HandyRW")

**Notification preferences:** Users can configure in Settings which
notification types they want via push vs SMS. SMS is always sent for
financial events regardless of user preference.

### 8.9 Offline Mode

**What works offline:**

- Browsing previously loaded artisan profiles (cached in SQLite)

- Viewing own booking history

- Reading notifications already received

- Viewing own profile

- Draft a job post (saved locally, submitted on reconnect)

**What requires connectivity:**

- Searching for artisans (real-time geo-query)

- Submitting or accepting bookings

- Initiating payments

- Uploading photos

**Implementation:**

Cache strategy: Cache-first, network fallback for reads. Network-first
for writes.

// hooks/useArtisanSearch.ts

import \* as SQLite from 'expo-sqlite';

const db = SQLite.openDatabase('handyrwanda.db');

async function getCachedArtisans(categoryId: number) {

return new Promise((resolve) =\> {

db.transaction(tx =\> {

tx.executeSql(

'SELECT \* FROM cached_artisans WHERE category_id = ? ORDER BY cached_at
DESC LIMIT 50',

\[categoryId\],

(\_, result) =\> resolve(result.rows.\_array)

);

});

});

}

**Offline indicator:** A persistent banner is shown when the app detects
no connectivity. Network state is monitored with expo-network.

**Sync on reconnect:** When connectivity is restored, any queued write
actions (draft job post, offline rating draft) are submitted
automatically in the background.

### 8.10 Admin Dashboard

The admin dashboard is a Next.js web application accessible only to
users with role = 'admin'. It communicates with the same FastAPI backend
via the /admin/\* endpoints.

**Dashboard sections:**

**Overview panel:** Total users, active artisans, jobs today, revenue
today, pending verifications, open disputes.

**Artisan verification queue:** List of artisans with
verification_status = 'pending', sorted by submission date. Admin can
view ID photos and selfie side-by-side, then click Approve or Reject
(with rejection reason).

**Dispute resolution centre:** List of open disputes with booking
details, client and artisan profiles, and the disputed amount. Admin can
view submitted evidence and click Release (pay artisan) or Refund
(return to client).

**User management:** Search users by phone or name. View profile.
Ban/unban account. View booking history.

**Revenue reports:** Weekly/monthly breakdown of platform fees
collected. CSV export. Filterable by category, date range.

**Broadcast notifications:** Send a push + SMS notification to all
users, all artisans, or a specific user.

### 8.11 Localisation (i18n)

**Supported languages:**

- Kinyarwanda (rw) — primary, default

- English (en)

- French (fr)

**Implementation with i18next (React Native):**

// i18n/index.ts

import i18n from 'i18next';

import { initReactI18next } from 'react-i18next';

import rw from './translations/rw.json';

import en from './translations/en.json';

import fr from './translations/fr.json';

i18n.use(initReactI18next).init({

resources: { rw: { translation: rw }, en: { translation: en }, fr: {
translation: fr } },

lng: 'rw',

fallbackLng: 'en',

interpolation: { escapeValue: false },

});

export default i18n;

**Translation key structure:**

// translations/rw.json (sample keys)

{

"auth": {

"enter_phone": "Injiza nomero ya telefone yawe",

"enter_otp": "Injiza kode woheretswe",

"resend_otp": "Ohereza nanone"

},

"booking": {

"confirm_complete": "Emeza ko akazi karangiye",

"raise_dispute": "Tanga ikibazo"

}

}

**Category names** are stored with three language columns (name_rw,
name_en, name_fr) in the database and returned based on the
Accept-Language header of the API request.

## 9. User Roles & Permissions

| Action                  | Client               | Artisan | Admin |
|-------------------------|----------------------|---------|-------|
| Register / login        | ✅                   | ✅      | ✅    |
| Post a job              | ✅                   | —       | —     |
| Bid on a job            | —                    | ✅      | —     |
| Accept / decline a bid  | ✅                   | —       | —     |
| Toggle availability     | —                    | ✅      | —     |
| Submit for verification | —                    | ✅      | —     |
| Approve verification    | —                    | —       | ✅    |
| Initiate payment        | ✅                   | —       | —     |
| Release escrow          | auto                 | —       | ✅    |
| Refund payment          | —                    | —       | ✅    |
| Submit review           | ✅ (post-completion) | —       | —     |
| Reply to review         | —                    | ✅      | —     |
| Remove review           | —                    | —       | ✅    |
| View all users          | —                    | —       | ✅    |
| Ban user                | —                    | —       | ✅    |
| Resolve dispute         | —                    | —       | ✅    |

## 10. Mobile App Screens

### Client screens

| Screen              | Description                                               |
|---------------------|-----------------------------------------------------------|
| Splash / onboarding | Brand intro + language picker                             |
| Phone entry         | Enter phone for OTP                                       |
| OTP verify          | 6-digit code input with resend timer                      |
| Home                | Category grid + nearby artisans preview + recent bookings |
| Search results      | List / map toggle of artisans by category + distance      |
| Artisan profile     | Photos, bio, categories, reviews, portfolio, book button  |
| Post a job          | Form: title, description, photos, location, date, budget  |
| My jobs             | List of posted jobs and their status                      |
| Booking detail      | Status timeline, artisan info, price, actions             |
| Payment screen      | Confirm amount, select MoMo / Airtel, enter PIN           |
| Confirm completion  | Two-button screen: Confirm Done or Raise Dispute          |
| Write review        | Star rating + comment + submit                            |
| Notifications       | List of all notifications, tappable                       |
| Profile             | Own info, language, settings, logout                      |

### Artisan screens

| Screen              | Description                                                        |
|---------------------|--------------------------------------------------------------------|
| Home                | Availability toggle + stats (earnings, jobs, rating) + nearby jobs |
| Nearby jobs         | Feed of open jobs within service radius                            |
| Job detail          | Full job description, photos, client info, submit bid              |
| My bids             | List of bids and their status                                      |
| Active booking      | Job status controls (Start Job, Mark Complete)                     |
| Earnings            | Total earnings, per-job breakdown, payout history                  |
| Profile setup       | Edit bio, categories, service radius, portfolio                    |
| Verification submit | Upload ID front, back, selfie                                      |
| My reviews          | All reviews received; reply button                                 |
| Notifications       | Notification list                                                  |
| Settings            | Language, notification prefs, logout                               |

## 11. Payment Integration

### MTN MoMo Collections (receive payment from client)

\# backend/integrations/mtn_momo.py

import httpx

import uuid

import os

MTN_BASE_URL = "https://proxy.momoapi.mtn.com"

SUBSCRIPTION_KEY = os.getenv("MTN_MOMO_SUBSCRIPTION_KEY")

API_USER = os.getenv("MTN_MOMO_API_USER")

API_KEY = os.getenv("MTN_MOMO_API_KEY")

async def request_to_pay(

amount: int,

phone: str,

external_id: str,

payer_message: str,

payee_note: str

) -\> str:

"""Initiate a collection from client phone. Returns referenceId."""

reference_id = str(uuid.uuid4())

token = await get_access_token("collection")

payload = {

"amount": str(amount),

"currency": "RWF",

"externalId": external_id,

"payer": {"partyIdType": "MSISDN", "partyId": phone},

"payerMessage": payer_message,

"payeeNote": payee_note,

}

headers = {

"Authorization": f"Bearer {token}",

"X-Reference-Id": reference_id,

"X-Target-Environment": "production",

"Ocp-Apim-Subscription-Key": SUBSCRIPTION_KEY,

"Content-Type": "application/json",

}

async with httpx.AsyncClient() as client:

resp = await client.post(

f"{MTN_BASE_URL}/collection/v1_0/requesttopay",

json=payload,

headers=headers

)

resp.raise_for_status()

return reference_id

async def check_payment_status(reference_id: str) -\> str:

"""Poll for payment status: SUCCESSFUL / FAILED / PENDING."""

token = await get_access_token("collection")

headers = {

"Authorization": f"Bearer {token}",

"X-Target-Environment": "production",

"Ocp-Apim-Subscription-Key": SUBSCRIPTION_KEY,

}

async with httpx.AsyncClient() as client:

resp = await client.get(

f"{MTN_BASE_URL}/collection/v1_0/requesttopay/{reference_id}",

headers=headers

)

data = resp.json()

return data.get("status", "PENDING")

### MTN MoMo Disbursements (pay out to artisan)

async def transfer_to_artisan(

amount: int,

phone: str,

booking_id: str

) -\> str:

"""Transfer payout from platform escrow to artisan phone."""

reference_id = str(uuid.uuid4())

token = await get_access_token("disbursement")

payload = {

"amount": str(amount),

"currency": "RWF",

"externalId": booking_id,

"payee": {"partyIdType": "MSISDN", "partyId": phone},

"payerMessage": "HandyRwanda job payout",

"payeeNote": f"Umuhembo w'akazi ka HandyRwanda - {booking_id\[:8\]}",

}

headers = {

"Authorization": f"Bearer {token}",

"X-Reference-Id": reference_id,

"X-Target-Environment": "production",

"Ocp-Apim-Subscription-Key": os.getenv("MTN_MOMO_DISBURSEMENT_KEY"),

}

async with httpx.AsyncClient() as client:

resp = await client.post(

f"{MTN_BASE_URL}/disbursement/v1_0/transfer",

json=payload, headers=headers

)

resp.raise_for_status()

return reference_id

## 12. Security Considerations

**Authentication:**

- JWT access tokens expire in 15 minutes.

- Refresh tokens are hashed before storage; raw token never stored.

- OTP codes: 6-digit numeric, 5-minute TTL, max 3 attempts before a
  > 10-minute lockout.

- Rate limiting on OTP request: max 3 OTP requests per phone per hour
  > (Redis counter).

**Input validation:**

- All request bodies are validated using Pydantic models in FastAPI.

- Phone numbers are normalised to E.164 format.

- File uploads are restricted to JPEG/PNG, max 5MB each, scanned via
  > Cloudinary.

**Payment security:**

- MoMo API credentials are environment variables, never in code.

- All payment flows use idempotent referenceId values to prevent
  > duplicate charges.

- Disbursements only execute from a verified admin-controlled service
  > account.

**Data privacy:**

- Artisan GPS coordinates are never returned to client API calls
  > (distance and label only).

- ID document photos are stored in a private Cloudinary folder
  > accessible only to admins.

- Passwords are not used; no password storage or reset flow needed.

**API security:**

- All endpoints require HTTPS.

- CORS is restricted to known origins (app scheme + web domain).

- Admin endpoints require role = 'admin' in the JWT payload; this is
  > checked in FastAPI middleware.

- Rate limiting on all endpoints via slowapi (FastAPI rate limiting
  > library).

## 13. Monetisation Model

| Stream                    | Mechanism                                                                              | Rate                |
|---------------------------|----------------------------------------------------------------------------------------|---------------------|
| Transaction commission    | Deducted from each completed job payment before artisan payout                         | 5–15% (by category) |
| Premium artisan badge     | Monthly subscription paid via MoMo                                                     | 500 RWF / month     |
| Featured search placement | Artisan bids to appear at top of search results for a category                         | Auction-based (TBD) |
| Corporate subscriptions   | Property management companies / hotels get a dedicated dashboard and priority artisans | Custom pricing      |
| Artisan training badges   | Partner with TVET schools; certified artisans pay a listing fee for a badge            | TBD                 |

**Commission revenue model (example):**

Assume 50 jobs/day × avg job value of 10,000 RWF × 10% commission =
**50,000 RWF/day (~\$45 USD)**.  
At 500 jobs/day: **500,000 RWF/day (~\$450 USD)**.

## 14. Build Roadmap & Phases

### Phase 1 — MVP (Weeks 1–6)

Goal: Core booking loop working end-to-end.

- \[ \] PostgreSQL + PostGIS database with full schema

- \[ \] FastAPI backend with auth, users, artisans, jobs, bookings
  > endpoints

- \[ \] React Native app: onboarding, OTP auth, home, search, artisan
  > profile

- \[ \] Job posting flow (client)

- \[ \] Bid and accept flow (artisan + client)

- \[ \] MTN MoMo escrow payment

- \[ \] Booking status lifecycle + auto-confirm after 48h

- \[ \] Expo Push notifications for booking events

- \[ \] Basic star rating post-completion

- \[ \] Artisan availability toggle

- \[ \] Deploy: Railway.app (API + DB) + Vercel (web)

- \[ \] Kinyarwanda + English translations

### Phase 2 — Trust & Quality (Weeks 7–10)

- \[ \] Artisan ID verification flow + admin review dashboard

- \[ \] Verified badge display in search and profiles

- \[ \] In-app chat between client and artisan (post-acceptance only)

- \[ \] Dispute flow with evidence submission

- \[ \] Admin dispute resolution UI

- \[ \] Portfolio image upload

- \[ \] Africa's Talking SMS fallback for all critical events

- \[ \] Airtel Money integration

- \[ \] Location privacy enforcement (approximate distance only)

- \[ \] Rate limiting + input validation hardening

### Phase 3 — Monetisation (Weeks 11–14)

- \[ \] Premium artisan badge subscription + MoMo recurring payment

- \[ \] Featured placement in search results

- \[ \] Admin revenue dashboard with CSV export

- \[ \] Broadcast notification tool (admin)

- \[ \] Artisan earnings summary screen

- \[ \] Transaction receipt SMS to both parties

- \[ \] Referral system (artisan earns bonus for each referred artisan
  > who completes 5 jobs)

### Phase 4 — Scale & Expand (Month 4+)

- \[ \] USSD interface via Africa's Talking (no smartphone required)

- \[ \] Launch in secondary cities: Butare, Musanze, Rubavu, Huye

- \[ \] Artisan certification badges (TVET partnership)

- \[ \] Corporate / B2B subscription tier

- \[ \] French language support

- \[ \] Dynamic pricing suggestions (AI-assisted, based on category +
  > location + season)

- \[ \] Repeat booking / favourite artisan feature

- \[ \] Artisan scheduling calendar

## 15. Folder Structure

handyrwanda/

├── backend/ \# FastAPI application

│ ├── app/

│ │ ├── main.py \# App entry point

│ │ ├── config.py \# Settings from env vars

│ │ ├── database.py \# SQLAlchemy async engine

│ │ ├── dependencies.py \# Shared FastAPI deps (auth, db session)

│ │ ├── models/ \# SQLAlchemy ORM models

│ │ │ ├── user.py

│ │ │ ├── artisan.py

│ │ │ ├── job.py

│ │ │ ├── booking.py

│ │ │ ├── payment.py

│ │ │ └── review.py

│ │ ├── schemas/ \# Pydantic request/response schemas

│ │ │ ├── auth.py

│ │ │ ├── artisan.py

│ │ │ ├── booking.py

│ │ │ └── payment.py

│ │ ├── routers/ \# FastAPI route handlers

│ │ │ ├── auth.py

│ │ │ ├── users.py

│ │ │ ├── artisans.py

│ │ │ ├── jobs.py

│ │ │ ├── bookings.py

│ │ │ ├── payments.py

│ │ │ ├── reviews.py

│ │ │ ├── notifications.py

│ │ │ └── admin.py

│ │ ├── services/ \# Business logic layer

│ │ │ ├── auth_service.py

│ │ │ ├── booking_service.py

│ │ │ ├── payment_service.py

│ │ │ ├── notification_service.py

│ │ │ └── geo_service.py

│ │ └── integrations/ \# Third-party API wrappers

│ │ ├── mtn_momo.py

│ │ ├── airtel_money.py

│ │ ├── africas_talking.py

│ │ └── cloudinary_upload.py

│ ├── migrations/ \# Alembic migration files

│ ├── tests/

│ ├── requirements.txt

│ ├── Dockerfile

│ └── .env.example

│

├── mobile/ \# React Native (Expo) app

│ ├── app/ \# Expo Router file-based routing

│ │ ├── (auth)/ \# Unauthenticated screens

│ │ │ ├── index.tsx \# Splash / language picker

│ │ │ ├── phone.tsx \# Phone entry

│ │ │ └── otp.tsx \# OTP verification

│ │ ├── (client)/ \# Client tab navigator

│ │ │ ├── home.tsx

│ │ │ ├── search.tsx

│ │ │ ├── post-job.tsx

│ │ │ ├── bookings.tsx

│ │ │ └── profile.tsx

│ │ ├── (artisan)/ \# Artisan tab navigator

│ │ │ ├── home.tsx

│ │ │ ├── nearby-jobs.tsx

│ │ │ ├── my-bids.tsx

│ │ │ ├── earnings.tsx

│ │ │ └── profile.tsx

│ │ └── \_layout.tsx \# Root layout, auth gate

│ ├── components/ \# Shared UI components

│ │ ├── ArtisanCard.tsx

│ │ ├── BookingStatusBar.tsx

│ │ ├── StarRating.tsx

│ │ ├── MapView.tsx

│ │ └── OfflineBanner.tsx

│ ├── hooks/ \# Custom React hooks

│ │ ├── useAuth.ts

│ │ ├── useLocation.ts

│ │ └── useBookings.ts

│ ├── services/ \# API client and local DB

│ │ ├── api.ts \# Axios instance + interceptors

│ │ ├── storage.ts \# expo-sqlite helpers

│ │ └── notifications.ts \# Expo push token registration

│ ├── i18n/ \# Translation files

│ │ ├── translations/

│ │ │ ├── rw.json

│ │ │ ├── en.json

│ │ │ └── fr.json

│ │ └── index.ts

│ ├── store/ \# Zustand global state

│ │ ├── authStore.ts

│ │ └── bookingStore.ts

│ ├── app.json

│ ├── package.json

│ └── tsconfig.json

│

├── web/ \# Next.js admin + public web

│ ├── app/

│ │ ├── admin/ \# Admin dashboard pages

│ │ │ ├── page.tsx \# Overview

│ │ │ ├── verify/ \# Artisan verification queue

│ │ │ ├── disputes/ \# Dispute resolution

│ │ │ └── users/ \# User management

│ │ ├── artisan/\[id\]/ \# Public artisan profile

│ │ └── jobs/ \# Public job board

│ ├── components/

│ ├── package.json

│ └── tsconfig.json

│

├── docker-compose.yml \# Local dev: Postgres + Redis + API

└── README.md

## 16. Environment Variables

\# backend/.env

\# App

APP_SECRET_KEY=your-secret-key-here

DEBUG=false

ALLOWED_ORIGINS=https://handyrwanda.rw,exp://

\# Database

DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/handyrwanda

REDIS_URL=redis://localhost:6379

\# JWT

JWT_SECRET=your-jwt-secret

JWT_ALGORITHM=HS256

JWT_ACCESS_EXPIRE_MINUTES=15

JWT_REFRESH_EXPIRE_DAYS=30

\# Africa's Talking (OTP + SMS)

AT_USERNAME=handyrwanda

AT_API_KEY=your-at-api-key

AT_SENDER_ID=HandyRW

\# MTN MoMo

MTN_MOMO_SUBSCRIPTION_KEY=your-collection-key

MTN_MOMO_DISBURSEMENT_KEY=your-disbursement-key

MTN_MOMO_API_USER=your-api-user-uuid

MTN_MOMO_API_KEY=your-api-key

MTN_MOMO_ENVIRONMENT=production \# or sandbox for testing

\# Airtel Money

AIRTEL_CLIENT_ID=your-client-id

AIRTEL_CLIENT_SECRET=your-client-secret

AIRTEL_ENVIRONMENT=production

\# Cloudinary

CLOUDINARY_CLOUD_NAME=your-cloud-name

CLOUDINARY_API_KEY=your-api-key

CLOUDINARY_API_SECRET=your-api-secret

\# Platform

PLATFORM_MOMO_WALLET=2507XXXXXXXX \# Platform's MoMo number (escrow
wallet)

AUTO_CONFIRM_HOURS=48

## 17. Deployment Guide

### Local development

\# Clone and set up

git clone https://github.com/yourorg/handyrwanda.git

cd handyrwanda

\# Start Postgres + Redis with Docker

docker-compose up -d

\# Backend

cd backend

python -m venv venv && source venv/bin/activate

pip install -r requirements.txt

cp .env.example .env \# Fill in values

alembic upgrade head \# Run migrations

uvicorn app.main:app --reload --port 8000

\# Mobile app

cd ../mobile

npm install

npx expo start

\# Web / Admin

cd ../web

npm install

npm run dev

### Production deployment (Railway.app)

1.  Create a Railway project.

2.  Add a PostgreSQL plugin (automatically sets DATABASE_URL).

3.  Add a Redis plugin (automatically sets REDIS_URL).

4.  Connect your GitHub repo.

5.  Set all environment variables in Railway's dashboard.

6.  Railway auto-deploys on push to main.

7.  Enable the PostGIS extension: connect to the Railway Postgres
    > instance and run CREATE EXTENSION postgis;.

### Web deployment (Vercel)

1.  Connect the /web directory to a Vercel project.

2.  Set NEXT_PUBLIC_API_URL=https://api.handyrwanda.rw.

3.  Vercel auto-deploys on push to main.

### Custom domain

Point api.handyrwanda.rw to your Railway deployment via a custom domain
in Railway settings. Point handyrwanda.rw and www.handyrwanda.rw to
Vercel.

## 18. Third-Party Integrations

| Service          | Purpose                                        | Docs                                             |
|------------------|------------------------------------------------|--------------------------------------------------|
| Africa's Talking | OTP SMS + SMS notifications                    | https://developers.africastalking.com            |
| MTN MoMo API     | Collections (receive) + Disbursements (payout) | https://momodeveloper.mtn.com                    |
| Airtel Money API | Airtel subscriber payments                     | https://developers.airtel.africa                 |
| Cloudinary       | Photo storage (profiles, ID docs, portfolios)  | https://cloudinary.com/documentation             |
| Expo Push        | Mobile push notifications                      | https://docs.expo.dev/push-notifications         |
| OpenStreetMap    | Free map tiles                                 | https://wiki.openstreetmap.org/wiki/Tile_servers |
| Railway.app      | Backend hosting + managed PostgreSQL + Redis   | https://docs.railway.app                         |
| Vercel           | Next.js web hosting                            | https://vercel.com/docs                          |

## 19. Testing Strategy

### Backend (Python)

\# Run all backend tests

cd backend && pytest -v

\# Test coverage

pytest --cov=app --cov-report=html

Test categories:

- **Unit tests:** Service functions (commission calculation, OTP
  > generation, escrow logic).

- **Integration tests:** API routes with a test database (PostgreSQL +
  > PostGIS in Docker).

- **Payment tests:** Use MTN MoMo sandbox environment. Never run payment
  > tests against production.

### Mobile (React Native)

cd mobile && npm test

- **Component tests:** Expo Testing Library for UI components.

- **Hook tests:** Test custom hooks (useAuth, useLocation) with mocked
  > API.

- **E2E tests:** Detox for critical flows (login → search → book → pay).

### CI/CD (GitHub Actions)

On every pull request to main:

1.  Run backend tests against a PostgreSQL + PostGIS service container.

2.  Run frontend component tests.

3.  On merge to main, auto-deploy to Railway (backend) and Vercel (web).

## 20. Future Roadmap

| Feature                     | Timeline | Notes                                                      |
|-----------------------------|----------|------------------------------------------------------------|
| USSD interface              | Month 4  | Africa's Talking USSD; no smartphone needed                |
| Artisan scheduling calendar | Month 5  | Artisans set available time slots; clients book slots      |
| In-app video call           | Month 6  | Client discusses job before booking (WebRTC)               |
| Recurring job subscriptions | Month 6  | Monthly cleaner, weekly gardener, etc.                     |
| Dynamic pricing suggestions | Month 7  | ML model trained on historical jobs by category + location |
| TVET certificate badges     | Month 8  | Partner with Rwanda Polytechnic; verified graduate badge   |
| Expansion: Uganda, Kenya    | Year 2   | Airtel Uganda + Safaricom M-Pesa integration               |
| WhatsApp Business bot       | Year 2   | Book via WhatsApp for users who prefer messaging           |
| Artisan insurance product   | Year 2   | Partnership with local insurer for job liability cover     |

*This document is a living blueprint. Update version numbers and dates
as the product evolves.*

*Built for Rwanda. Built for Africa.*
