# Sprint 8 — Referral System

**Branch:** `Referral-System`  
**Status:** ✅ Complete  
**Date:** June 2026  

---

## Overview

Sprint 8 implements a full **end-to-end Referral & Wallet Credit System** across all three stack layers (FastAPI backend, React/TanStack Router web app, Expo/React Native mobile app).

Users can share a unique referral link. When a referred friend completes their **first booking**, both parties earn **500 RWF wallet credit** automatically. Credits are stored in the user's wallet and applied automatically on the next booking payment.

---

## Features Delivered

### Backend

| Feature | File | Details |
|---------|------|---------|
| Referral code generation | `services/referral_service.py` | `HW-{3 chars}-{4 chars}` format, collision-safe |
| Auto-generate code on registration | `routers/auth.py` | Every new user gets a unique code |
| Accept `?ref=CODE` on register | `routers/auth.py` | Creates `Referral(status=registered)` record |
| Qualify referral on booking completion | `routers/bookings.py` | Async background task after first booking completes |
| Wallet credit both parties | `services/referral_service.py` | `qualify_referral_and_reward()` — atomic, logged |
| In-app notifications | `services/referral_service.py` | Both referrer and referred get push-ready notifications |
| `GET /referrals/me` | `routers/referrals.py` | Full dashboard: code, link, counts, tier, wallet |
| `POST /referrals/validate` | `routers/referrals.py` | Validate code during onboarding — tri-lingual response |
| `GET /referrals/leaderboard` | `routers/referrals.py` | Top 10 referrers by qualified count (public) |
| `GET /referrals/history` | `routers/referrals.py` | Current user's referred contacts with status |
| `POST /referrals/apply-credit` | `routers/referrals.py` | Apply wallet credit to a booking payment |
| Alembic migration | `migrations/versions/s8_referral_system.py` | 4 schema changes, PostgreSQL + SQLite safe |

### Data Model Changes

**`users` table** (2 new columns):
```sql
ALTER TABLE users ADD COLUMN referral_code VARCHAR(20) UNIQUE;
ALTER TABLE users ADD COLUMN wallet_balance_rwf INTEGER NOT NULL DEFAULT 0;
```

**`transactions` table** (2 new enum values + description column):
- `TransactionType.credit` — referral reward credited
- `TransactionType.credit_applied` — wallet credit applied to a booking
- `description VARCHAR(300)` — human-readable label

### Referral Tiers (gamification)

| Tier | Icon | Qualified referrals |
|------|------|---------------------|
| Bronze Referrer | 🥉 | 1–2 |
| Silver Referrer | 🥈 | 3–5 |
| Gold Referrer | 🥇 | 6–10 |
| Platinum Referrer | 💎 | 11–20 |
| Legend Referrer | 🌟 | 21+ |

### Web Frontend

| Component | Path | Details |
|-----------|------|---------|
| Referral dashboard page | `web/src/routes/referrals.tsx` | Stats, code card, wallet, tier progress, leaderboard, history |
| Referral landing page | `web/src/routes/join.tsx` | `/join?ref=HW-XXX-XXXX` — incentive banner + auto-open register |
| Referral API service | `web/src/services/referralService.ts` | Typed client for all 5 endpoints |
| Header nav link | `web/src/components/Header.tsx` | 🎁 Referrals link for authenticated users |
| Auth modal — registration | `web/src/components/AuthModal.tsx` | Reads `?ref=` from URL, passes to backend |

### Mobile Frontend

| Component | Path | Details |
|-----------|------|---------|
| Referrals screen | `mobile/app/referrals.tsx` | Full screen with native Share sheet (EN/RW/FR) |
| Profile entry point | `mobile/app/(tabs)/profile.tsx` | Referral Program menu item with live wallet balance |
| Referral API service | `mobile/src/services/referralService.ts` | Typed client matching web service |
| Auth OTP mapping | `mobile/app/(auth)/otp.tsx` | Maps `referral_code` and `wallet_balance_rwf` from login response |

---

## Referral Flow (End-to-End)

```
User A (referrer)
  │
  ├─ Visits /referrals  →  sees their code  HW-JEA-X7K2
  ├─ Taps "Share with Friends"
  │      └─ WhatsApp / SMS / copy: "Use HW-JEA-X7K2 for 500 RWF off!"
  │
User B (referred)
  │
  ├─ Opens  https://handyrwanda.com/join?ref=HW-JEA-X7K2
  ├─ Sees banner: "Alice invited you — earn 500 RWF on first booking"
  ├─ Registers (code auto-applied)
  │      └─ backend: Referral(status=registered) created
  │
  ├─ Books & completes first job
  │      └─ bookings.py: asyncio.create_task(_qualify_referral(client_id))
  │            └─ qualify_referral_and_reward()
  │                  ├─ Referral.status → qualified
  │                  ├─ User A wallet += 500 RWF  +  Transaction(type=credit)
  │                  ├─ User B wallet += 500 RWF  +  Transaction(type=credit)
  │                  └─ Notification → User A: "🎉 You earned 500 RWF!"
  │                     Notification → User B: "🎁 You earned 500 RWF!"
```

---

## Configuration

All reward amounts are configurable via environment variables (no redeploy needed):

```bash
REFERRAL_REFERRER_REWARD_RWF=500   # reward for the person who referred
REFERRAL_REFERRED_REWARD_RWF=500   # reward for the person who was referred
APP_BASE_URL=https://handyrwanda.com
```

---

## Tests

**File:** `backend/tests/test_sprint8_referral_system.py`  
**Count:** 32 tests across 7 test classes

```
TestReferralCodeGeneration   (4 tests)  — code format, HW- prefix, length
TestReferralTiers            (9 tests)  — every tier boundary, icons, progress
TestApplyWalletCredit        (3 tests)  — full, partial, zero balance
TestQualifyReferral          (4 tests)  — happy path, no record, already qualified, missing user
TestGetReferralStats         (4 tests)  — counts, tier, link format, unknown user
TestGetLeaderboard           (3 tests)  — ordering, limit, empty result
TestReferralEndpointsHTTP    (7 tests)  — auth guards, validation, public endpoints
TestRewardConstants          (3 tests)  — default values, positive amounts
```

Run tests:
```bash
cd backend
pytest tests/test_sprint8_referral_system.py -v
```

---

## API Reference

### `GET /referrals/me` 🔒

Returns the authenticated user's full referral dashboard.

```json
{
  "referral_code": "HW-JEA-X7K2",
  "referral_link": "https://handyrwanda.com/join?ref=HW-JEA-X7K2",
  "total_referred": 5,
  "qualified": 3,
  "pending": 2,
  "total_earned_rwf": 1500,
  "wallet_balance_rwf": 1000,
  "tier": {
    "name": "Bronze Referrer",
    "icon": "🥉",
    "next_tier": { "name": "Silver Referrer", "icon": "🥈", "min": 3 },
    "needed_for_next": 0
  },
  "reward_referrer_rwf": 500,
  "reward_referred_rwf": 500
}
```

### `POST /referrals/validate`

```json
// Request
{ "code": "HW-JEA-X7K2" }

// Response 200
{
  "valid": true,
  "referrer_first_name": "James",
  "reward_rwf": 500,
  "message_en": "You were referred by James! Complete your first booking to earn 500 RWF credit.",
  "message_rw": "Watumwe na James! Uzuza inama yawe ya mbere ubone amafaranga 500 RWF.",
  "message_fr": "Vous avez été référé par James! Terminez votre première réservation pour gagner 500 RWF."
}
```

### `GET /referrals/leaderboard?limit=10`

Public endpoint. Returns top referrers ordered by qualified count.

### `GET /referrals/history` 🔒

Returns current user's referred contacts with anonymised names and status.

### `POST /referrals/apply-credit` 🔒

```json
// Request
{ "booking_id": "uuid", "amount": 500 }

// Response 200
{ "applied_rwf": 500, "new_wallet_balance_rwf": 0, "message": "500 RWF credit applied to your booking." }
```
