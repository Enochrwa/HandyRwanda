# HandyRwanda — Feature Sprint Plan
# Deep Technical Specification for All Planned Features
# Grounded in the actual codebase as of June 2025

---

## Reading Guide

Every section is written so a developer can open the codebase,
find the exact files mentioned, and know precisely what to add,
change, or create. No guesswork.

---

# SPRINT 1 — Real-Time Job Status Tracking
**Goal:** Client knows exactly what is happening to their job at every moment,
like watching a delivery on a map. This is the single most important
retention feature — it converts a "posted and waiting" anxiety into an
engaging experience.

## What Exists Today
- `app/integrations/ws_manager.py` — `NotificationManager` with `connect`,
  `disconnect`, `push`. Used only for generic notifications.
- `app/models/booking.py` — `BookingStatus` enum:
  `pending_payment → confirmed → in_progress → completed → cancelled → disputed`
- WebSocket endpoint in `app/main.py` accepts connections per user_id.
- Artisan has no "en route" state, no ETA, no location sharing.

## What to Build

### 1.1 New Booking Status Values
**File:** `app/models/booking.py`

Add to `BookingStatus` enum:
```python
artisan_accepted   = "artisan_accepted"   # artisan tapped Accept
artisan_en_route   = "artisan_en_route"   # artisan tapped "I'm on my way"
arrived            = "arrived"            # artisan tapped "I've arrived"
```

The full lifecycle becomes:
```
pending_payment
  → confirmed        (payment verified by admin)
  → artisan_accepted (artisan taps Accept in app — 15 min window)
  → artisan_en_route (artisan taps "On my way")
  → arrived          (artisan taps "I've arrived")
  → in_progress      (artisan taps "Job started")
  → completed        (client taps "Mark complete")
  → cancelled / disputed
```

Create a new Alembic migration for the enum addition.

### 1.2 New Booking Status Transition Endpoints
**File:** `app/routers/bookings.py`

Add these four POST endpoints, each guarded by `require_role(UserRole.artisan)`:

**POST /bookings/{id}/accept**
- Artisan confirms they saw and accept the booking.
- Guard: `booking.artisan_id == user_id`, status must be `confirmed`.
- Sets status → `artisan_accepted`.
- If artisan does NOT call this within 15 minutes, a background task
  (APScheduler) auto-cancels and re-matches. See Sprint 1.4.
- Push notification to client: "✅ [Artisan Name] accepted your job!
  They'll be on their way soon."
- WebSocket push: `{ "event": "booking_status", "status": "artisan_accepted",
  "booking_id": "...", "artisan_name": "..." }`

**POST /bookings/{id}/en-route**
- Artisan is travelling to the client.
- Guard: status must be `artisan_accepted`.
- Accepts optional body: `{ "eta_minutes": 20 }`
- Sets status → `artisan_en_route`, stores `eta_minutes` on booking
  (add `eta_minutes: int | None` column to Booking model).
- Push notification to client: "🚗 [Artisan Name] is on the way!
  Estimated arrival: 20 minutes."
- WebSocket push with `eta_minutes` field.

**POST /bookings/{id}/arrived**
- Artisan has arrived at the job site.
- Guard: status must be `artisan_en_route`.
- Sets status → `arrived`.
- Push notification to client: "📍 [Artisan Name] has arrived at your location!"
- Start a 3-minute countdown on client screen before auto-transitioning
  to `in_progress` (or let artisan tap "Start Job").

**POST /bookings/{id}/start**
- Job work has begun.
- Guard: status must be `arrived`.
- Sets status → `in_progress`, records `started_at` timestamp
  (add `started_at: datetime | None` column to Booking).
- Push to client: "🔧 Work has started on your job!"

### 1.3 WebSocket Status Events
**File:** `app/integrations/ws_manager.py`

Extend `NotificationManager.push()` to include a `type` field so clients
can distinguish status events from chat messages:

Every booking status change must call:
```python
await notification_manager.push(client_id, {
    "type": "booking_status_change",
    "booking_id": str(booking.id),
    "new_status": new_status,
    "artisan_name": artisan_name,
    "eta_minutes": eta_minutes,   # None if not applicable
    "timestamp": datetime.utcnow().isoformat(),
})
```

### 1.4 Auto-Cancel if Artisan Does Not Accept (15-Minute Window)
**File:** `app/services/matching_service.py` (new function)
**File:** `app/main.py` (register APScheduler job)

When a booking reaches `confirmed` status, schedule an APScheduler
`DateTrigger` job 15 minutes later that:
1. Checks if booking is still `confirmed` (not yet `artisan_accepted`).
2. If still `confirmed`: cancel booking, notify client with "artisan did
   not respond — finding another match", call `find_matching_artisans`
   for the next best artisan, create a new booking for them.
3. Log this event for admin analytics (new field `auto_cancelled_count`
   on ArtisanProfile).

APScheduler is already in `requirements.txt`. Use `AsyncIOScheduler`
with `AsyncSession` from `AsyncSessionLocal` (same pattern as
`_notify_artisans_async` in `jobs.py`).
ßßß
### 1.5 Mobile UI — Live Status Card
**File:** `mobile/app/(tabs)/index.tsx` (home screen) and
`mobile/app/messages/[bookingId].tsx`

Replace the static booking status badge with an animated live card:
- Use `useEffect` + WebSocket subscription (hook into the existing
  WS connection in `mobile/src/services/websocket.ts` if it exists,
  or create `mobile/src/hooks/useBookingStatus.ts`).
- The card shows a horizontal stepper:
  `Confirmed → Accepted → En Route → Arrived → In Progress → Done`
- When status is `artisan_en_route`, show a countdown timer using the
  `eta_minutes` field from the WS message.
- When status is `arrived`, show a pulsing green dot animation.
- All animations via `react-native-reanimated` (already in Expo SDK).

---

# SPRINT 2 — Artisan Review Reply (Activate Existing Feature)
**Goal:** Artisans can publicly respond to client reviews. This already has
full backend support. Only the UI is missing.

## What Exists Today
- `app/models/review.py` — `artisan_reply: str | None` column exists.
- `app/routers/reviews.py` — `PATCH /reviews/{review_id}/reply` endpoint exists.
- `GET /reviews/artisan/{artisan_id}` returns `artisan_reply` field.
- No mobile or web UI surfaces this endpoint.

## What to Build

### 2.1 Mobile — Reply Button on Artisan's Review List
**File:** `mobile/app/(artisan)/profile/portfolio.tsx` or a new
`mobile/app/(artisan)/reviews.tsx`

For each review where `artisan_reply === null`:
- Show a "Reply to review" button below the review text.
- Tapping opens a bottom sheet with a `TextInput` (max 300 chars).
- On submit, call `PATCH /reviews/{review_id}/reply`.
- Optimistically update the UI to show the reply immediately.
- If the reply already exists, show it as a quoted block below the review.

For all reviews (with or without reply):
- Display the reply as: `"Your response: [artisan_reply text]"`
- Show reply in a visually distinct card (indented, lighter background).

### 2.2 Web — Same Feature in Web Artisan Dashboard
**File:** `web/src/routes/artisan/earnings.tsx` (repurpose or create
`web/src/routes/artisan/reviews.tsx`)

Same pattern as mobile — list reviews, inline reply form, optimistic update.

### 2.3 Public Artisan Profile — Show Replies
**File:** `mobile/app/artisan/[id].tsx` and `web/src/routes/artisan.$id.tsx`

On the public artisan profile, every review that has an `artisan_reply`
should display it below the review text, formatted as:
```
[Client review text]
  └ Artisan's response: [artisan_reply]
```
This is a trust signal — clients see that this artisan is responsive
and professional.

---

# SPRINT 3 — Client Job Dashboard (Web) + Bid Management
**Goal:** Web clients currently have no way to manage their jobs after posting.
This is a critical gap — web users hit a dead end.

## What Exists Today
- `web/src/routes/jobs/post.tsx` — job posting form exists.
- `GET /jobs/mine` — returns client's jobs with bid counts. ✅
- `GET /bids/jobs/{job_id}` — returns bids on a job. ✅
- `POST /bids/{bid_id}/accept` — accept a bid. ✅
- `POST /bids/{bid_id}/reject` — reject a bid. ✅
- No web route exists for any of this.

## What to Build

### 3.1 New Web Route: My Jobs Dashboard
**File:** `web/src/routes/jobs/mine.tsx` (new file)

A page accessible via `/jobs/mine`, showing:
- Tabs: `Open (3) | In Progress (1) | Completed (5) | Cancelled`
- Each job card shows: title, category emoji, posted date, bid count badge,
  status pill, and a "View Bids →" link.
- Uses `GET /jobs/mine?status=open` (status filter already supported).
- Uses TanStack Query for data fetching (already in web stack).
- Links from the existing nav or home screen.

### 3.2 New Web Route: Job Bids Detail
**File:** `web/src/routes/jobs/$jobId/bids.tsx` (new file)

Route: `/jobs/{jobId}/bids`

Shows all bids for a job. For each bid:
- Artisan name, avatar, star rating, verified badge
- Proposed price (bold, in RWF)
- Cover letter / message text
- Proposed start time, estimated hours
- "Accept" and "Decline" action buttons
- When user clicks Accept: confirmation dialog → POST /bids/{bid_id}/accept
  → redirect to booking detail page.

Sort order: by price ascending (cheapest first) by default,
with toggle for "By Rating" (highest rated first).

### 3.3 Price guidance on bid cards
**File:** Same bids page

Call `GET /jobs/{job_id}` which already returns `price_guidance` for artisans.
Repurpose the same endpoint to show the client:
"Market rate for this service in [district]: 8,000 – 25,000 RWF"
This helps clients evaluate bids fairly.

---

# SPRINT 4 — Instant Booking (Alongside Bidding)
**Goal:** Allow clients to book a previously used artisan with one tap,
skipping the bidding flow entirely. Bidding remains available for new
relationships. Both flows coexist.

## What Exists Today
- `app/routers/bookings.py` — `POST /bookings` (`DirectBookingCreate`) exists
  but is undocumented and not surfaced in mobile UI.
- `GET /bookings` — returns completed bookings with artisan info.
- `app/services/matching_service.py` — `get_recommended_artisans` exists
  but only recommends by category.
- `Booking` model stores `client_id` + `artisan_id` → past relationships
  are queryable.

## What to Build

### 4.1 Backend — "My Previous Artisans" Endpoint
**File:** `app/routers/artisans.py` (add new route)

**GET /artisans/previous** (requires client auth)

Returns the list of artisans a client has successfully worked with before,
ordered by most recent. Query:
```sql
SELECT DISTINCT ON (b.artisan_id)
    b.artisan_id, u.full_name, u.avatar_url,
    ap.average_rating, ap.total_reviews,
    ap.verification_status, ap.hourly_rate,
    ap.is_available,
    b.agreed_price AS last_price,
    b.created_at   AS last_booked_at,
    j.title        AS last_job_title,
    c.name_en      AS last_category
FROM bookings b
JOIN users u ON b.artisan_id = u.id
JOIN artisan_profiles ap ON b.artisan_id = ap.user_id
JOIN jobs j ON b.job_id = j.id
JOIN categories c ON j.category_id = c.id
WHERE b.client_id = :client_id
  AND b.status = 'completed'
ORDER BY b.artisan_id, b.created_at DESC
```

Response shape:
```json
[{
  "artisan_id": "...",
  "full_name": "Jean Baptiste",
  "avatar_url": "...",
  "average_rating": 4.8,
  "total_reviews": 23,
  "verification_status": "pro_verified",
  "is_available": true,
  "last_price": 15000,
  "last_booked_at": "2025-05-01T...",
  "last_job_title": "Fix kitchen sink",
  "last_category": "Plumbing",
  "instant_book_eligible": true
}]
```

`instant_book_eligible` is `true` when:
- `is_available == true`
- `verification_status` in `["id_verified", "pro_verified"]`
- Not blocked on today's date (check `artisan_blocked_dates`)
- No active booking conflicts in next 4 hours

### 4.2 Backend — Instant Book Endpoint
**File:** `app/routers/bookings.py` (new endpoint)

**POST /bookings/instant**

Request body:
```json
{
  "artisan_id": "uuid",
  "category_id": "uuid",
  "description": "Fix my bathroom tap",
  "scheduled_time": "2025-06-10T09:00:00Z",   // optional
  "address": { "district": "Gasabo", ... },
  "budget": 15000,
  "use_last_price": true   // pre-fills agreed_price from last booking
}
```

Logic:
1. Verify client has at least 1 completed booking with this artisan.
2. Auto-create a Job (status=`booked` immediately, skipping `open`).
3. Auto-create a Booking (status=`pending_payment`).
4. Skip the bid process entirely.
5. Notify artisan: "⚡ [Client Name] wants to book you again!
   Same service as last time. Confirm to accept."
6. Artisan has 10 minutes to confirm or decline (APScheduler).
   If they decline, client is notified and the job reverts to `open`
   for normal bidding.

### 4.3 Mobile UI — "Book Again" Section on Home Screen
**File:** `mobile/app/(tabs)/index.tsx`

At the top of the client home screen, above the "Post a Job" button:
- Section titled "Book again 🔄"
- Horizontal scrollable row of artisan avatars (max 5)
- Each avatar shows: photo, name (truncated), star rating, online dot
  (if `is_available`), last category emoji
- Tapping an artisan opens the Instant Book bottom sheet

**Instant Book Bottom Sheet:**
`mobile/src/components/InstantBookSheet.tsx` (new component)
- Pre-filled artisan info at top
- Description textarea
- Scheduled time picker (optional)
- Budget field (pre-filled with `last_price`, editable)
- "Book Now ⚡" CTA button
- Below the CTA: "Prefer to get bids instead? Post as open job →" link
  (so both flows are always available)

### 4.4 Web UI — "Book Again" on Artisan Profile Page
**File:** `web/src/routes/artisan.$id.tsx`

If the viewing client has a completed booking with this artisan,
show a prominent "Book Again ⚡" button at the top of the profile,
alongside the existing "Get a Quote / Request Bid" button.

---

# SPRINT 5 — Community Safety Score (Activate + Display)
**Goal:** Every artisan has a visible, trusted safety/quality score computed
from multiple signals. This is the platform's key trust mechanism and
primary competitive moat.

## What Exists Today
- `app/models/artisan.py` — `community_score: int` column exists (default 0).
- `app/models/artisan.py` — `response_rate`, `on_time_rate`,
  `repeat_client_rate`, `completion_rate` columns exist but are never updated.
- `app/routers/admin.py` — `cron_pro_upgrade` runs nightly but only checks
  a few criteria. No score calculation.
- No function computes the score. The column just sits at 0 for everyone.

## What to Build

### 5.1 Score Calculation Service
**File:** `app/services/safety_score_service.py` (new file)

The Community Safety Score is a weighted integer from 0 to 1000.

**Components and weights:**

| Signal | Max Points | Source |
|--------|-----------|--------|
| ID Verified | 200 | `verification_status >= id_verified` |
| Pro Verified | +100 bonus | `verification_status == pro_verified` |
| Average Rating (≥4.0 to get full) | 200 | `average_rating / 5.0 * 200` |
| Completion Rate | 150 | `completion_rate * 150` |
| Response Rate | 100 | `response_rate * 100` |
| On-Time Rate | 100 | `on_time_rate * 100` |
| Repeat Client Rate | 100 | `repeat_client_rate * 100` |
| Zero Disputes (last 6 months) | 50 | No `disputed` bookings |
| Account Age (max 1 year = full) | 50 | `min(days_active / 365, 1) * 50` |

**Score calculation function:**
```python
async def compute_safety_score(artisan_id: UUID, db: AsyncSession) -> int:
    # Fetches artisan_profile + dispute count + account age
    # Returns integer 0-1000
```

**Score tiers (displayed as badges):**
- 0–299:  ⭕ Unranked (grey)
- 300–499: 🥉 Bronze — "Registered"
- 500–699: 🥈 Silver — "Trusted"
- 700–849: 🥇 Gold — "Highly Trusted"
- 850–999: 💎 Platinum — "Elite"
- 1000:    🌟 Legend (rare, shown prominently)

### 5.2 Rate Fields That Are Currently Never Updated
**File:** `app/routers/bookings.py` + `app/services/safety_score_service.py`

These fields exist but are always 0.0. Wire them up:

**`response_rate`** — Updated when booking transitions to `artisan_accepted`:
```
response_rate = (bookings_accepted / bookings_assigned) in last 90 days
```

**`on_time_rate`** — Updated when `arrived` status is set:
```
If arrived_at <= scheduled_time + 15 minutes: on_time += 1
on_time_rate = on_time_count / total_completed
```
Requires: `arrived_at` timestamp on Booking (add column).

**`repeat_client_rate`** — Recalculated after every completed booking:
```
unique_repeat_clients = clients who booked this artisan 2+ times
repeat_client_rate = unique_repeat_clients / total_unique_clients
```

**`completion_rate`** — Recalculated after status changes:
```
completion_rate = completed_bookings / (completed + cancelled_by_artisan)
```
Note: need to track WHO cancelled (artisan vs client). Add
`cancelled_by: "client" | "artisan" | "system"` to Booking model.

### 5.3 Nightly Score Recalculation Cron
**File:** `app/main.py` (APScheduler `CronTrigger`)
**File:** `app/services/safety_score_service.py`

Every night at 2am Kigali time (UTC+2, so 00:00 UTC):
```python
async def recalculate_all_scores(db: AsyncSession) -> None:
    artisan_ids = await db.scalars(select(ArtisanProfile.user_id))
    for aid in artisan_ids:
        score = await compute_safety_score(aid, db)
        await db.execute(
            update(ArtisanProfile)
            .where(ArtisanProfile.user_id == aid)
            .values(community_score=score)
        )
    await db.commit()
```

Use batch processing — calculate 50 artisans at a time to avoid
memory pressure if the artisan base grows.

### 5.4 Mobile — Score Badge on Artisan Card
**File:** `mobile/app/artisan/[id].tsx` and all artisan list cards

Show the badge tier prominently:
- On the artisan profile page: large badge below the avatar
  "💎 Platinum — Score 876/1000"
- On artisan cards in search results and home screen: small badge icon
  next to the name (just the emoji + score number)
- Include a "What is this?" info tap that explains the scoring criteria

### 5.5 Admin Score Override
**File:** `app/routers/admin.py`

**PATCH /admin/artisans/{artisan_id}/score**
Admin can manually adjust a score by ±points with a reason note.
Useful for handling edge cases (artisan was robbed, had a family
emergency, etc.) without permanently damaging their score.

---

# SPRINT 6 — Artisan Income Intelligence Dashboard
**Goal:** Artisans can see their earnings data clearly, understand their
performance, and be motivated by visible growth. This is the #1
supply-side retention driver.

## What Exists Today
- `app/models/escrow.py` — `ArtisanEarnings` model (check its fields).
- `app/routers/analytics.py` — admin-only analytics. Nothing for artisans.
- `mobile/app/(artisan)/earnings.tsx` — screen exists but likely placeholder.
- `app/models/transaction.py` — `Transaction` with `payout_out`, `payment_in`.
- `ArtisanProfile` has `average_rating`, `total_reviews`, `completion_rate`.

## What to Build

### 6.1 New Artisan Earnings API
**File:** `app/routers/artisans.py` (add routes) or new
`app/routers/artisan_stats.py`

**GET /artisans/me/earnings?period=week|month|year**

Single comprehensive endpoint returning:
```json
{
  "period": "month",
  "total_earned": 185000,
  "total_jobs": 12,
  "avg_job_value": 15416,
  "best_day": { "date": "2025-05-15", "earned": 45000, "jobs": 3 },
  "by_category": [
    { "category": "Plumbing", "jobs": 7, "earned": 105000, "pct": 56.7 },
    { "category": "Masonry",  "jobs": 5, "earned": 80000,  "pct": 43.2 }
  ],
  "by_day": [
    { "date": "2025-05-01", "earned": 0 },
    { "date": "2025-05-02", "earned": 15000 },
    ...31 days
  ],
  "prev_period_total": 142000,
  "growth_pct": 30.3,
  "pending_payout": 45000,
  "projected_monthly": 220000,
  "rating_this_period": 4.7,
  "on_time_rate": 0.91
}
```

SQL strategy: join `bookings` + `escrow_transactions` + `jobs` + `categories`
filtering by `artisan_id` and `created_at` range. Group by date and category
in one query each. No N+1.

**GET /artisans/me/earnings/leaderboard**

Shows the artisan their rank among all artisans in their district
(not exposing other artisans' absolute earnings, just rank):
```json
{
  "your_rank": 3,
  "total_in_district": 47,
  "top_10_pct": false,
  "district": "Gasabo"
}
```

### 6.2 sklearn — Earnings Forecast (Lightweight ML)
**File:** `app/services/earnings_forecast_service.py` (new file)
**Package:** `scikit-learn` (add to requirements.txt)

Use `sklearn.linear_model.LinearRegression` to project monthly earnings:
```python
from sklearn.linear_model import LinearRegression
import numpy as np

async def forecast_earnings(artisan_id: UUID, db: AsyncSession) -> dict:
    # Fetch last 12 weeks of weekly earnings from DB
    # X = [0, 1, 2, ..., 11] (week index)
    # y = [8000, 12000, 15000, ...] (weekly earnings)
    X = np.array(range(len(weekly_earnings))).reshape(-1, 1)
    y = np.array(weekly_earnings)
    model = LinearRegression().fit(X, y)
    # Predict next 4 weeks
    future_X = np.array(range(len(X), len(X) + 4)).reshape(-1, 1)
    forecast = model.predict(future_X)
    return {
        "next_4_weeks_forecast": forecast.tolist(),
        "trend": "up" if model.coef_[0] > 0 else "down",
        "projected_monthly": float(sum(forecast)),
    }
```

This is extremely lightweight — `LinearRegression` on 12 data points
runs in microseconds. No GPU, no heavy inference. Falls back to
`average of last 4 weeks * 4` if fewer than 6 data points.

### 6.3 Mobile UI — Earnings Screen
**File:** `mobile/app/(artisan)/earnings.tsx`

Replace placeholder with:
- **Header card:** Total earned this month + growth badge
  (e.g. "+30% vs last month 📈")
- **Bar chart:** Earnings by day (use `react-native-gifted-charts`
  or `victory-native` — both work with Expo)
- **Category breakdown:** Pie or horizontal bar showing which services
  earn most
- **Forecast card:** "At your current pace, you'll earn ~220,000 RWF
  this month" (from the LinearRegression endpoint)
- **Leaderboard:** "You rank #3 in Gasabo 🏆"
- **Best times to work:** Show which days/hours have highest completion
  rates (derived from the by_day data)

Period toggle: This Week / This Month / This Year

### 6.4 "Insights" Push Notifications
**File:** `app/services/safety_score_service.py` or new notification service

Weekly insight notification to artisans (every Monday 8am Kigali):
- "Last week you earned 42,000 RWF across 3 jobs — that's your best week yet! 🎉"
- "Your busiest day is Saturday. Consider staying available on Saturdays."
- "3 clients viewed your profile this week but didn't hire. Consider updating
  your portfolio."

---

# SPRINT 7 — Voice Messages in Chat
**Goal:** Activate the `voice_note_url` column that already exists on the
Message model. Voice messages are critical for users more comfortable
speaking than typing — especially in Kinyarwanda.

## What Exists Today
- `app/models/message.py` — `voice_note_url: str | None` column exists.
- `app/routers/messages.py` — `POST /messages/{booking_id}` accepts `content`
  text only. `voice_note_url` is never populated.
- Upload infrastructure (`/uploads/presign`) is fully working.

## What to Build

### 7.1 Backend — Voice Message Support
**File:** `app/routers/messages.py`

Extend `MessageCreate` schema:
```python
class MessageCreate(BaseModel):
    content: str = ""                    # now optional (empty for voice-only)
    voice_note_url: str | None = None    # presigned-uploaded URL
    sender_lang: str = "auto"

    @model_validator(mode="after")
    def must_have_content_or_voice(self) -> "MessageCreate":
        if not self.content.strip() and not self.voice_note_url:
            raise ValueError("Message must have text content or a voice note.")
        return self
```

In `send_message`, set `message.voice_note_url = payload.voice_note_url`.

Skip translation for voice-only messages (can't translate audio — set
`translated_content = None`, `detected_lang = "audio"`).

**Add to uploads router (`app/routers/uploads.py`):**
Add `"voice_note"` to `ALLOWED_FOLDERS` mapping to `"voice-notes"`.
Add `"audio/m4a"`, `"audio/aac"`, `"audio/mp4"` to `ALLOWED_MIME_TYPES`.
(Expo Audio records as `.m4a` on iOS, `.mp4` audio on Android.)

Max file size for voice notes: 10MB (extend the presign response).

### 7.2 Mobile — Voice Recording UI
**File:** `mobile/app/messages/[bookingId].tsx`

**Recording flow:**
1. Add a microphone button (🎤) to the left of the text input,
   next to the existing send button.
2. Long-press the mic button → starts recording using `expo-av`
   (`Audio.Recording`). Show a pulsing red indicator + elapsed time.
3. Release → stops recording, shows a preview waveform card with
   Play, Delete, and Send buttons.
4. On Send:
   - Call `POST /uploads/presign` with `upload_type="voice_note"`,
     `content_type="audio/m4a"`.
   - Upload the `.m4a` file to the presigned URL via `fetch` PUT.
   - Call `POST /messages/{bookingId}` with `{ voice_note_url: publicUrl, content: "" }`.

**Playback in message list:**
- When a message has `voice_note_url`, render a compact audio player card
  instead of a text bubble.
- Show: play button, waveform bars (static/decorative is fine — actual
  waveform analysis is unnecessary overhead), duration.
- Use `expo-av` `Audio.Sound` to play.
- Autoplay is OFF by default (data costs in Rwanda).

**Permissions:**
Request `Audio` recording permission on first mic tap using
`Audio.requestPermissionsAsync()`.

---

# SPRINT 8 — Referral System (Activate + Reward Logic)
**Goal:** Turn every satisfied user into an acquisition channel.
The data model is ready — only the business logic and UI are missing.

## What Exists Today
- `app/models/referral.py` — `Referral` model with `referrer_id`,
  `referred_id`, `referral_code`, `status` (`registered | qualified`).
- No router for referrals exists.
- No referral code is generated on registration.
- No reward is given.
- `app/models/transaction.py` — has `refund` type which can be repurposed
  as credit, or add a new `credit` type.

## What to Build

### 8.1 Referral Code Generation on Registration
**File:** `app/routers/auth.py`

When a user registers (POST /auth/register), auto-generate a unique referral
code. Format: `HW-{3 chars of name}-{4 random uppercase}` e.g. `HW-JEA-X7K2`.

```python
import secrets, string
def generate_referral_code(full_name: str) -> str:
    prefix = full_name[:3].upper().replace(" ", "")
    suffix = "".join(secrets.choice(string.ascii_uppercase + string.digits)
                     for _ in range(4))
    return f"HW-{prefix}-{suffix}"
```

Store on `User` model — add `referral_code: str | None` column.

If the registration request includes `?ref=HW-JEA-X7K2` query param:
- Validate the code → look up referrer.
- Create a `Referral(referrer_id=referrer.id, referred_id=new_user.id,
  referral_code=code, status="registered")`.

### 8.2 Referral Qualification Event
**File:** `app/routers/bookings.py`

When a booking transitions to `completed`:
- Check if the `client_id` has a `Referral` record with `status="registered"`.
- If yes: update to `status="qualified"`.
- Trigger reward for both parties (see 8.3).

### 8.3 Reward System
**File:** `app/services/referral_service.py` (new file)

Reward amounts (configurable via env vars so you can change without deploy):
```
REFERRAL_REFERRER_REWARD_RWF = 500
REFERRAL_REFERRED_REWARD_RWF = 500
```

When a referral qualifies:
1. Create a `Transaction(type="credit", amount=500, user_id=referrer_id)`.
2. Create a `Transaction(type="credit", amount=500, user_id=referred_id)`.
3. Store credits in `ArtisanEarnings.pending_amount` (for artisans) or as
   a separate `user_credits` balance on the `User` model (add column:
   `wallet_balance_rwf: int, default=0`).
4. Send push notification to both:
   - Referrer: "🎉 Your friend [name] completed their first booking!
     You've earned 500 RWF credit."
   - Referred: "🎁 You've earned 500 RWF credit for your first booking!"

Credits are applied automatically against the next booking payment.
Track credit usage in `Transaction` with `type="credit_applied"`.

### 8.4 New Referral Router
**File:** `app/routers/referrals.py` (new file)

**GET /referrals/me** — Returns user's referral stats:
```json
{
  "referral_code": "HW-IVY-X7K2",
  "referral_link": "https://handyrwanda.com/join?ref=HW-IVY-X7K2",
  "total_referred": 5,
  "qualified": 3,
  "pending": 2,
  "total_earned_rwf": 1500,
  "wallet_balance_rwf": 500
}
```

**POST /referrals/validate** — Validate a referral code (used during
onboarding to show "You'll get 500 RWF credit when you complete your
first booking!").

### 8.5 Mobile — Referral Screen
**File:** `mobile/app/(tabs)/pro.tsx` (existing "Pro" tab) or new screen

- Show referral code in a large copyable card
- Share button: native share sheet with pre-written message in
  Kinyarwanda, English, and French:
  ```
  EN: "Join HandyRwanda! Find trusted artisans near you. 
      Use my code HW-IVY-X7K2 for 500 RWF off your first booking."
  RW: "Injira muri HandyRwanda! Bonera abakozi bizewe hafi yawe.
      Koresha kode yanjye HW-IVY-X7K2 ubone amafaranga 500 RWF."
  ```
- Leaderboard section: "You've referred 5 people — Top 10%! 🏆"
- Progress tracker: "2 more referrals to unlock Gold Referrer badge"

---

# SPRINT 9 — sklearn-Powered Smart Matching Upgrade
**Goal:** Replace the current simple "same category + district" matching
with a lightweight ML ranking model that learns which artisans actually
get hired and complete jobs well.

## What Exists Today
- `app/services/matching_service.py` — `find_matching_artisans` sorts by
  `average_rating DESC, completion_rate DESC`. Simple, non-learning.
- All the data needed to train a better model already exists in the DB:
  historical bids, acceptance rates, completion rates, review scores,
  response times, district match, repeat hire rate.

## What to Build

### 9.1 Feature Engineering
**File:** `app/services/matching_service.py`

For each candidate artisan, compute a feature vector:

| Feature | Source | Notes |
|---------|--------|-------|
| `category_match` | `artisan_skills` | 1.0 always (already filtered) |
| `district_match` | Compare artisan district vs job district | 1.0/0.5/0.0 |
| `avg_rating_norm` | `average_rating / 5.0` | |
| `completion_rate` | Direct from profile | |
| `response_rate` | Direct from profile | |
| `on_time_rate` | Direct from profile | |
| `repeat_client_rate` | Direct from profile | |
| `experience_years_norm` | `min(years_experience / 10, 1.0)` | |
| `community_score_norm` | `community_score / 1000.0` | |
| `price_delta` | `abs(artisan.hourly_rate - job.budget) / job.budget` | |
| `is_verified` | `verification_status in [id_verified, pro_verified]` | |

### 9.2 The Ranking Model
**File:** `app/services/ml_ranking_service.py` (new file)
**Package:** `scikit-learn` (add to requirements.txt)

Use `sklearn.ensemble.GradientBoostingClassifier` or the lighter
`sklearn.linear_model.LogisticRegression` to predict P(artisan will be
hired AND complete the job successfully).

**Training data:**
- Label = 1 if: artisan was hired AND booking completed (success)
- Label = 0 if: artisan bid but was not selected, OR booking was disputed/cancelled

**Training pipeline:**
```python
# app/services/ml_ranking_service.py

from sklearn.ensemble import GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
import joblib
import numpy as np

MODEL_PATH = "/tmp/handyrwanda_ranking_model.pkl"
SCALER_PATH = "/tmp/handyrwanda_scaler.pkl"

async def train_ranking_model(db: AsyncSession) -> None:
    """
    Trains on historical bid→booking→outcome data.
    Runs nightly (APScheduler). Serialises model to disk with joblib.
    Only trains if >= 100 labelled examples exist.
    """
    rows = await db.execute(text("""
        SELECT
            ap.average_rating / 5.0           AS avg_rating,
            ap.completion_rate,
            ap.response_rate,
            ap.on_time_rate,
            ap.repeat_client_rate,
            ap.years_experience::float / 10.0 AS exp_norm,
            ap.community_score / 1000.0        AS score_norm,
            CASE WHEN u.district = j.district THEN 1.0
                 ELSE 0.0 END                  AS district_match,
            CASE WHEN b.status = 'completed' THEN 1 ELSE 0 END AS label
        FROM bids bid
        JOIN artisan_profiles ap ON bid.artisan_id = ap.user_id
        JOIN users u ON bid.artisan_id = u.id
        JOIN jobs j ON bid.job_id = j.id
        LEFT JOIN bookings b ON b.job_id = j.id AND b.artisan_id = bid.artisan_id
        WHERE bid.created_at > NOW() - INTERVAL '6 months'
    """))
    data = rows.fetchall()
    if len(data) < 100:
        return  # not enough data yet — use heuristic fallback

    X = np.array([[r[:-1]] for r in data]).reshape(len(data), -1)
    y = np.array([r[-1] for r in data])

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    model = GradientBoostingClassifier(
        n_estimators=50,    # lightweight — trains in milliseconds
        max_depth=3,
        learning_rate=0.1,
    )
    model.fit(X_scaled, y)

    joblib.dump(model, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)


def rank_artisans_ml(candidates: list[dict]) -> list[dict]:
    """
    Re-rank candidate artisans using the trained model.
    Falls back to heuristic sort if model not trained yet.
    """
    try:
        model = joblib.load(MODEL_PATH)
        scaler = joblib.load(SCALER_PATH)
    except FileNotFoundError:
        # Model not trained yet — use existing heuristic sort
        return sorted(candidates,
                      key=lambda x: (x["average_rating"], x["completion_rate"]),
                      reverse=True)

    features = np.array([[
        c["average_rating"] / 5.0,
        c["completion_rate"],
        c["response_rate"],
        c["on_time_rate"],
        c["repeat_client_rate"],
        min(c.get("years_experience", 0) / 10.0, 1.0),
        c.get("community_score", 0) / 1000.0,
        c.get("district_match", 0.0),
    ] for c in candidates])

    scores = model.predict_proba(scaler.transform(features))[:, 1]
    for i, c in enumerate(candidates):
        c["ml_score"] = float(scores[i])

    return sorted(candidates, key=lambda x: x["ml_score"], reverse=True)
```

### 9.3 AI Job Description Assistant (sklearn TF-IDF)
**File:** `app/services/category_classifier.py` (extend existing)
**Package:** `scikit-learn`

Upgrade the current pure-Python TF-IDF with `sklearn.feature_extraction.text.TfidfVectorizer`
fitted on all past job descriptions in the DB:

```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

async def build_tfidf_index(db: AsyncSession):
    """
    Fit a TF-IDF vectorizer on all historical job titles + descriptions.
    Store the fitted vectorizer and transformed category vectors in memory.
    Refresh nightly.
    """
    jobs = await db.execute(select(Job.title, Job.description, Job.category_id))
    # Group text by category, fit vectorizer, store as module-level cache
    ...
```

**Job Description Suggestions Endpoint:**
**POST /jobs/suggest** (new route in `app/routers/jobs.py`)

```json
Request:  { "partial_description": "my toilet is leaking" }
Response: {
  "suggested_category": { "id": "...", "name_en": "Plumbing", "emoji": "🚿" },
  "confidence": 0.91,
  "related_suggestions": [
    "Also mention: is it the tank or the bowl? Is there water on the floor?",
    "Clients who posted similar jobs also requested: pipe replacement"
  ],
  "typical_price_range": { "min": 5000, "max": 20000, "currency": "RWF" }
}
```

The `related_suggestions` come from finding the top-3 most similar historical
job descriptions (cosine similarity on TF-IDF vectors) and extracting the
additional details those clients mentioned. Pure sklearn, zero external API.

---

# SPRINT 10 — Artisan Skill Verification via Video
**Goal:** Artisans submit a 60-second proof-of-skill video. Clients can watch
before hiring. This is a transformational trust feature that no competitor
has built in this market.

## What Exists Today
- `app/models/artisan.py` — `PortfolioPhoto` model (images only).
- `app/routers/uploads.py` — handles image uploads via presigned URL.
  Does NOT support video.
- `app/routers/artisans.py` — portfolio management for photos.

## What to Build

### 10.1 Video Upload Support
**File:** `app/routers/uploads.py`

Add to `ALLOWED_FOLDERS`: `"skill_video": "skill-videos"`
Add to `ALLOWED_MIME_TYPES`: `"video/mp4"`, `"video/quicktime"` (.mov)
Increase max size for video type: return `max_size_bytes: 50 * 1024 * 1024` (50MB).

### 10.2 New Skill Video Model
**File:** `app/models/artisan.py`

```python
class SkillVideo(Base):
    __tablename__ = "skill_videos"

    id: UUID primary key
    artisan_id: UUID FK → artisan_profiles.user_id
    category_id: UUID FK → categories.id (which skill is being demonstrated)
    video_url: str (Supabase storage URL)
    thumbnail_url: str | None (generated or first frame)
    title: str (max 100) e.g. "Fixing a leaking pipe in 5 steps"
    description: str | None (max 300)
    duration_seconds: int | None
    is_approved: bool = False  # admin must approve before public display
    rejection_reason: str | None
    view_count: int = 0
    created_at: datetime
```

### 10.3 Video Router
**File:** `app/routers/artisans.py` (add endpoints)

**POST /artisans/me/skill-videos**
- Artisan submits a video (URL from presign upload + metadata).
- Sets `is_approved = False` (pending admin review).
- Notifies admin: "New skill video submitted by [name] for [category]."

**GET /artisans/{artisan_id}/skill-videos**
- Public: returns only `is_approved = True` videos.

**POST /admin/skill-videos/{video_id}/approve|reject**
- Admin approves or rejects with optional `rejection_reason`.
- On approval: notify artisan "✅ Your [Plumbing] skill video is now live!"
- On rejection: notify artisan with reason.

### 10.4 Mobile — Video Submission UI
**File:** `mobile/app/(artisan)/profile/portfolio.tsx`

Tab switcher: "Photos | Videos"

In Videos tab:
- Grid of uploaded videos with play overlay.
- Each pending video shows a "⏳ Awaiting Review" badge.
- Each approved video shows view count.
- "Add Skill Video" button → opens camera/gallery picker using
  `expo-image-picker` with `mediaTypes: ["videos"]`.
- Video recording limited to 60 seconds (use `videoMaxDuration: 60`).
- After selection: title + category selector + description fields.
- Upload flow identical to photos (presign → PUT to Supabase → POST to API).

### 10.5 Mobile — Video Playback on Artisan Profile
**File:** `mobile/app/artisan/[id].tsx`

Below portfolio photos, add a "Skill Videos" section.
Use `expo-video` (SDK 54+) or `expo-av` Video component for playback.
Thumbnails in a horizontal scroll; tap to full-screen play.

### 10.6 View Count Tracking
**File:** `app/routers/artisans.py`

**POST /artisans/skill-videos/{video_id}/view** (no auth required)
Increments `view_count` atomically:
```python
await db.execute(
    update(SkillVideo)
    .where(SkillVideo.id == video_id)
    .values(view_count=SkillVideo.view_count + 1)
)
```
Called automatically when the video starts playing in the client app.
Rate-limited per IP (via Upstash Redis) to prevent inflation.

---

# SPRINT 11 — Price Negotiation / Counter-Offer Flow
**Goal:** Formalise the negotiation that currently happens off-platform.
Keep both parties in the app throughout the entire deal.

## What Exists Today
- `app/models/job.py` — `Bid` model: `proposed_price`, `status` (pending/accepted/rejected).
- `app/routers/bids.py` — accept/reject only. No counter-offer.
- Negotiation currently happens via WhatsApp or phone call (lost data, lost trust).

## What to Build

### 11.1 Bid Model Extension
**File:** `app/models/job.py`

Add to `Bid`:
```python
counter_price: int | None       # client's counter-offer amount
counter_message: str | None     # client's counter-offer message (max 300)
counter_at: datetime | None     # when counter was made
artisan_counter_price: int | None   # artisan's response to counter
artisan_counter_at: datetime | None
negotiation_round: int = 0      # increments each counter (max 3)
```

### 11.2 New Negotiation Endpoints
**File:** `app/routers/bids.py`

**POST /bids/{bid_id}/counter** (client only)
- Client proposes a lower price.
- Guard: bid status must be `pending`, `negotiation_round < 3`.
- Sets `counter_price`, `counter_message`, `counter_at`.
- Sets bid status → `countered_by_client` (new enum value).
- Notifies artisan: "💬 [Client Name] would like to discuss your bid.
  They're suggesting [counter_price] RWF. What do you think?"

**POST /bids/{bid_id}/counter-accept** (artisan only)
- Artisan accepts the client's counter price.
- Sets `proposed_price = counter_price` (overwrite with agreed amount).
- Status → `accepted` (reuse existing accept flow).
- Creates booking at `counter_price`.

**POST /bids/{bid_id}/counter-reject** (artisan only)
- Artisan rejects the counter without offering anything else.
- Status → `rejected`.

**POST /bids/{bid_id}/artisan-counter** (artisan only)
- Artisan proposes a middle ground.
- Sets `artisan_counter_price`, increments `negotiation_round`.
- Notifies client: "[Artisan Name] suggests [artisan_counter_price] RWF."

**Max 3 rounds** then the system shows: "Maximum negotiation rounds reached.
Accept or decline the current offer."

### 11.3 Mobile — Counter-Offer UI in Bid Detail
**File:** `mobile/app/(artisan)/jobs/[jobId]/index.tsx` and client bid view

When a bid has `status == "countered_by_client"`:
- Artisan sees the counter card: "Client suggests: 12,000 RWF (you asked 15,000)"
- Three action buttons: ✅ Accept Counter | ❌ Decline | 🔄 Propose Middle Ground
- "Propose Middle Ground" opens a number input pre-filled with
  `(proposed_price + counter_price) / 2`

When a bid has `status == "artisan_counter"`:
- Client sees: "[Artisan] is willing to do it for 13,000 RWF"
- Two buttons: ✅ Accept | ❌ Decline

All negotiation history is shown as a timeline of offers in the bid detail screen.

---

# SPRINT 12 — Recurring Job Subscriptions
**Goal:** "Clean my house every Saturday" — recurring bookings with
automatic re-matching. Subscription revenue is the most stable model
for a marketplace.

## What Exists Today
- `app/models/booking.py` — no recurrence fields.
- `app/models/job.py` — `Job` has `scheduled_time` (single datetime).
- `APScheduler` is available.
- Nothing in the codebase supports recurring jobs.

## What to Build

### 12.1 Recurrence Model
**File:** `app/models/job.py` (add new model)

```python
class RecurringSchedule(Base):
    __tablename__ = "recurring_schedules"

    id: UUID primary key
    client_id: UUID FK → users.id
    preferred_artisan_id: UUID | None FK → artisan_profiles.user_id
    category_id: UUID FK → categories.id
    title: str
    description: str
    address_district: str
    address_detail: str | None
    budget_per_session: int
    frequency: Enum ["weekly", "biweekly", "monthly"]
    day_of_week: int | None    # 0=Mon, 6=Sun (for weekly/biweekly)
    day_of_month: int | None   # 1-28 (for monthly)
    preferred_time: time | None
    is_active: bool = True
    next_run_at: datetime      # APScheduler trigger target
    total_sessions: int = 0    # how many times this has run
    created_at: datetime
```

### 12.2 Recurring Job Creation Logic
**File:** `app/services/recurring_service.py` (new file)

**`spawn_session(schedule_id, db)`** — called by APScheduler:
1. Fetch the `RecurringSchedule`.
2. If `preferred_artisan_id` is set and artisan is available:
   - Create Job (status=`booked`) + Booking (status=`pending_payment`).
   - Notify artisan: "🔄 Recurring booking from [Client Name] —
     [Title], [Date]."
   - Notify client: "✅ Your recurring booking has been auto-scheduled
     with [Artisan Name]."
3. If preferred artisan is NOT available:
   - Create Job (status=`open`) and run `notify_matching_artisans`.
   - Notify client: "⚠️ Your regular artisan is unavailable this week.
     We're finding you a replacement."
4. Calculate `next_run_at` based on frequency + day_of_week/month.
5. Update `schedule.next_run_at` and `schedule.total_sessions`.
6. APScheduler reschedules itself for the next occurrence.

### 12.3 Recurring Schedule Router
**File:** `app/routers/recurring.py` (new file)

**POST /recurring** — Create a recurring schedule
**GET /recurring/mine** — List client's active schedules
**PATCH /recurring/{id}** — Update (change day, budget, preferred artisan)
**DELETE /recurring/{id}** — Cancel (sets `is_active = False`, stops APScheduler job)

### 12.4 Mobile UI — Recurring Job Toggle
**File:** `mobile/app/(client)/post-job/details.tsx`

Add a "Make this recurring" toggle below the scheduled time picker.
When toggled on:
- Show frequency selector: Weekly | Every 2 Weeks | Monthly
- Show day-of-week picker (for weekly/biweekly)
- Show preferred time picker
- Show "Prefer same artisan each time" toggle (stores `preferred_artisan_id`
  from last completed booking of this category)

On confirm: calls `POST /recurring` instead of `POST /jobs`.

---

# SPRINT 13 — Offline-First Job Posting
**Goal:** A client in Musanze or Rubavu with spotty connectivity can draft
and queue a job while offline. It auto-posts when connection returns.
Rwanda has connectivity gaps outside Kigali — this is a real user need.

## What Exists Today
- Rwanda address data is already fully offline (`rwanda-address.json`).
- Mobile uses Expo/React Native — `@react-native-community/netinfo` works.
- No offline queue exists.

## What to Build

### 13.1 Mobile — Offline Job Queue
**File:** `mobile/src/services/offlineQueue.ts` (new file)

Use `expo-file-system` + a simple JSON file as a persistent queue
(MMKV or AsyncStorage also work):

```typescript
interface QueuedJob {
  id: string;               // local UUID
  payload: JobCreatePayload;
  created_at: string;
  status: "pending" | "uploading" | "failed";
  retry_count: number;
}

export const offlineQueue = {
  async add(job: JobCreatePayload): Promise<string>,
  async getAll(): Promise<QueuedJob[]>,
  async remove(id: string): Promise<void>,
  async flush(apiClient: AxiosInstance): Promise<void>,  // called on reconnect
};
```

**`flush()`** is called when `NetInfo.addEventListener` fires a
`isConnected: true` event. It iterates queued jobs, posts them to
`POST /jobs`, removes successful ones, increments `retry_count` on failures.

### 13.2 Mobile — Offline-Aware Job Post UI
**File:** `mobile/app/(client)/post-job/confirm.tsx`

When user taps "Post Job" and `NetInfo.isConnected === false`:
- Do NOT show an error.
- Save to the offline queue.
- Show: "📶 You're offline. Your job has been saved and will post
  automatically when you reconnect."
- Show a queue indicator badge on the home tab when jobs are pending.

When connection returns:
- Show a brief toast: "✅ Your queued job has been posted!"
- The queue badge disappears.

### 13.3 Conflict Handling
If a queued job is older than 24 hours when it finally goes online,
prompt the user: "This job has been waiting 24 hours. Is it still needed?"
with "Post it" / "Discard" options.

---

# Technical Cross-Cutting Concerns

## sklearn Integration Summary
Add `scikit-learn>=1.5.0` and `joblib>=1.4.0` to `requirements.txt`.

| Use Case | Algorithm | Why |
|----------|-----------|-----|
| Artisan ranking | `GradientBoostingClassifier` | Best accuracy for tabular hire data |
| Earnings forecast | `LinearRegression` | Perfect for time-series trend with few points |
| Job suggestion (TF-IDF upgrade) | `TfidfVectorizer` + `cosine_similarity` | Learns from actual job history |
| Job description similarity | `NearestNeighbors` | Fast lookup for "similar jobs" |

All models are trained on < 10k rows initially — training completes in
< 1 second on CPU. No GPU required. Models serialised with `joblib.dump()`
to a local path (or Supabase Storage for persistence across deploys).

## Database Migrations Needed
Each sprint that touches models needs a new Alembic migration file.
Use sequential IDs: `j1k2l3m4n5o6`, `k1l2m3n4o5p6`, etc.

## WebSocket Event Types (Standardise)
All WS pushes should use a consistent `type` field:
```
booking_status_change | new_message | new_bid | new_notification |
referral_qualified | score_updated | earnings_update
```

## APScheduler Jobs Register in main.py lifespan
```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

scheduler = AsyncIOScheduler(timezone="Africa/Kigali")
scheduler.add_job(recalculate_all_scores, CronTrigger(hour=0, minute=0))
scheduler.add_job(train_ranking_model, CronTrigger(hour=1, minute=0))
scheduler.add_job(send_weekly_insights, CronTrigger(day_of_week="mon", hour=8))
scheduler.start()
```

---

# Sprint Priority Order

| # | Sprint | Impact | Effort | Do First? |
|---|--------|--------|--------|-----------|
| 1 | Real-Time Status Tracking | ⭐⭐⭐⭐⭐ | Medium | ✅ Yes |
| 5 | Community Safety Score | ⭐⭐⭐⭐⭐ | Medium | ✅ Yes |
| 4 | Instant Booking | ⭐⭐⭐⭐⭐ | Medium | ✅ Yes |
| 2 | Review Reply (UI only) | ⭐⭐⭐⭐ | Low | ✅ Yes — easy win |
| 3 | Web Client Dashboard | ⭐⭐⭐⭐ | Low | ✅ Yes — critical gap |
| 8 | Referral System | ⭐⭐⭐⭐⭐ | Medium | Next |
| 6 | Income Intelligence | ⭐⭐⭐⭐ | Medium | Next |
| 7 | Voice Messages | ⭐⭐⭐⭐ | Medium | Next |
| 9 | sklearn Matching | ⭐⭐⭐ | Medium | After data exists |
| 11 | Price Negotiation | ⭐⭐⭐⭐ | Medium | After |
| 10 | Skill Videos | ⭐⭐⭐⭐⭐ | High | After |
| 12 | Recurring Jobs | ⭐⭐⭐⭐⭐ | High | After |
| 13 | Offline Job Posting | ⭐⭐⭐ | Low | After |
