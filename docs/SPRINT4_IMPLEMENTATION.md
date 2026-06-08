# Sprint 4 — Instant Booking (Alongside Bidding)

**Branch:** `Instant-Booking-(Alongside-Bidding)`  
**Implemented:** June 2025  
**Status:** ✅ Complete

---

## Overview

Sprint 4 introduces **Instant Booking** — a parallel booking pathway that allows clients to
re-book a previously trusted artisan with a single tap, completely bypassing the bidding flow.
This coexists with the existing bidding system: clients always retain the option to post an open
job and receive competitive bids instead.

---

## Architecture

```
Client (mobile/web)
  │
  ├── GET /artisans/previous        → "Book Again 🔄" section
  │
  └── POST /bookings/instant        → Instant booking created
          │
          ├── Job auto-created (status=booked)
          ├── Booking auto-created (status=pending_payment)
          ├── Artisan notified via DB notification + WebSocket push
          └── 10-minute timer started (asyncio.create_task)
                  │
                  ├── Artisan taps "Confirm" → POST /bookings/{id}/instant-confirm
                  │       └── status → confirmed, client notified
                  │
                  ├── Artisan taps "Decline" → POST /bookings/{id}/instant-decline
                  │       └── booking cancelled, job reverts to status=open for bids
                  │
                  └── No response in 10 min → auto-revert task fires
                          └── booking cancelled, job reverts to status=open for bids
                                  └── client notified: "Your job is open for bids"
```

---

## Backend Changes

### New Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/artisans/previous` | `client` JWT | Returns previous artisans with `instant_book_eligible` flag |
| `POST` | `/bookings/instant` | `client` JWT | Creates instant booking (no bidding) |
| `POST` | `/bookings/{id}/instant-confirm` | `artisan` JWT | Artisan confirms instant booking |
| `POST` | `/bookings/{id}/instant-decline` | `artisan` JWT | Artisan declines; job reverts to open |

### Files Modified

- `backend/app/routers/artisans.py` — `GET /artisans/previous` endpoint + `PreviousArtisanItem` schema
- `backend/app/routers/bookings.py` — `InstantBookCreate` schema + all 3 instant booking endpoints
- `backend/migrations/versions/s4a1b2c3d4e5_sprint4_instant_booking.py` — Sprint 4 migration marker

### `InstantBookCreate` Schema

```python
class InstantBookCreate(BaseModel):
    artisan_id:       UUID
    category_id:      UUID
    description:      str          # min 10, max 2000 chars
    scheduled_time:   datetime | None = None
    address_district: str | None = None
    address_detail:   str | None = None
    budget:           int          # agreed price in RWF
    use_last_price:   bool = False  # pre-fill from last booking
```

### Eligibility Rules (`instant_book_eligible`)

An artisan is eligible for instant booking when ALL of the following are true:

1. `artisan_profile.is_available = True`
2. `verification_status` is `id_verified` OR `pro_verified`
3. No `BlockedDate` entry for today
4. No active booking in status `artisan_en_route | arrived | in_progress | artisan_accepted`

### Auto-Revert Logic

If the artisan does not respond within **10 minutes**:
- The booking is cancelled with `cancelled_by=system`
- The job reverts to `status=open` for normal bidding
- The client receives a push notification explaining what happened

This is implemented as an `asyncio.create_task` background coroutine in `create_instant_booking`.

---

## Mobile Changes

### New Files

| File | Purpose |
|------|---------|
| `mobile/src/components/InstantBookSheet.tsx` | Bottom sheet for client instant booking |
| `mobile/src/hooks/usePreviousArtisans.ts` | React Query hook for previous artisans |
| `mobile/app/(artisan)/jobs/instant-booking-request.tsx` | Artisan confirm/decline screen |

### Modified Files

| File | Change |
|------|--------|
| `mobile/app/(tabs)/index.tsx` | Added `BookAgainSection` with `InstantBookSheet` |
| `mobile/app/(artisan)/jobs/index.tsx` | Added instant booking requests banner |
| `mobile/src/hooks/useNotificationSocket.ts` | Sprint 4 event routing + deep-links |

### UX Flow (Client)

1. Home screen shows **"Book Again 🔄"** horizontal scroll row with previous artisans
2. Each avatar has a `⚡` badge if eligible (pulsing animation) or a grey dot if not
3. Tapping an artisan opens **`InstantBookSheet`** bottom sheet:
   - Pre-filled artisan info, last job, last price
   - Description field (required, min 10 chars)
   - Budget: "Use last price" toggle (default on) or custom input
   - "**Book Now ⚡**" CTA → disabled if artisan not eligible
   - "Prefer to get bids instead? Post as open job →" fallback link
4. On success: sheet transitions to success state with **10-minute countdown**
5. Booking confirmed / declined / expired → real-time toast + cache invalidation

### UX Flow (Artisan)

1. Instant booking request arrives → **WebSocket** fires immediately
2. Artisan is **deep-linked** to `instant-booking-request.tsx` screen
3. Screen shows: client info, job description, agreed price, **10-minute countdown**
4. Two CTAs: **"Confirm Booking ✅"** and **"Decline — Open for Bidding"**
5. On artisan jobs screen: prominent **"⚡ X Instant Booking Request(s)"** banner with live count

---

## Web Changes

### New Files

| File | Purpose |
|------|---------|
| `web/src/routes/bookings/$bookingId.tsx` | Booking detail page (confirm/decline + status stepper) |

### Modified Files

| File | Change |
|------|--------|
| `web/src/routes/artisan.$id.tsx` | "Book Again ⚡" prompt + `InstantBookModal` |
| `web/src/routes/artisans/jobs.tsx` | Instant booking requests panel at top of feed |
| `web/src/hooks/useNotificationSocket.ts` | Sprint 4 toast notifications + cache invalidation |
| `web/src/routeTree.gen.ts` | Registered `/bookings/$bookingId` route |
| `web/src/services/artisanService.ts` | `PreviousArtisan`, `InstantBookPayload`, `InstantBookResult` types |

### UX Flow (Client, Web)

1. Visiting an artisan's profile page shows:
   - **"You've worked together before"** panel with last booking details
   - **"Book Again ⚡"** button (prominent, primary colour)
   - In sticky footer: secondary "Book Again" button if eligible
2. Clicking opens **`InstantBookModal`** (full-screen overlay):
   - Same fields as mobile: description, budget, last-price toggle
   - 10-minute countdown shown in success state
   - "Prefer to get bids? Post as open job →" fallback

### UX Flow (Artisan, Web)

1. **Artisan job feed** (`/artisans/jobs`) shows a highlighted panel at the top
   listing instant booking requests with a **"Respond Now"** link
2. `/bookings/$bookingId` page shows full booking detail + sticky confirm/decline footer
3. Real-time Sonner toast fires on `instant_booking_request` with "Respond Now ⚡" action

---

## Notification Events (Sprint 4)

| Event Type | Recipient | Trigger |
|-----------|-----------|---------|
| `instant_booking_request` | Artisan | Client creates instant booking |
| `instant_booking_confirmed` | Client | Artisan confirms booking |
| `instant_booking_declined` | Client | Artisan declines booking |
| `instant_book_expired` | Client | 10-minute window expires without response |

---

## Testing Checklist

### Happy Path
- [ ] Client with 1+ completed bookings sees "Book Again" section on home
- [ ] Only verified + available artisans show ⚡ badge
- [ ] Submitting instant booking creates job (status=booked) + booking (status=pending_payment)
- [ ] Artisan receives real-time notification + is deep-linked to request screen
- [ ] Artisan confirms → booking status=confirmed, client notified
- [ ] 10-minute countdown is accurate on both sides

### Edge Cases
- [ ] Client with zero prior bookings: "Book Again" section hidden entirely
- [ ] Artisan unavailable / unverified: CTA disabled, warning shown, fallback link visible
- [ ] Artisan declines: job reverts to `open`, client notified with job link
- [ ] 10 minutes expire without response: auto-revert fires, client notified
- [ ] Artisan already has active booking: ineligible (no double booking)
- [ ] Artisan blocked today: ineligible

### API
- [ ] `GET /artisans/previous` returns correct `instant_book_eligible` flag
- [ ] `POST /bookings/instant` rejects if no prior completed booking (403)
- [ ] `POST /bookings/{id}/instant-confirm` only works for artisan who owns the booking
- [ ] `POST /bookings/{id}/instant-decline` correctly opens job for bids

---

## Design Decisions

**Why 10 minutes?**
Short enough to feel "instant" (client expects a quick response), long enough for an artisan
to notice and react to a push notification.

**Why skip bidding entirely?**
Trust is already established. Forcing the client to wait for bids when they want the same
artisan they liked before creates unnecessary friction.

**Why keep bidding as fallback?**
Not all artisans will be available or eligible. The fallback ensures the client is never stuck.

**Why `asyncio.create_task` for auto-revert?**
Keeps the POST /bookings/instant response fast. The 10-minute timer runs in the background.
For production, a Celery beat task or APScheduler would be more robust.
