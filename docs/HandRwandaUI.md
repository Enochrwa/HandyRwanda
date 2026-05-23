## The Design Philosophy

Before any individual trick: **your UI has one job — build trust fast.**
Every visual decision should make a stranger feel safe hiring another
stranger. Airbnb, Uber, and Thumbtack all learned this. Your UI does the
same work.

The aesthetic direction: **warm, human, and professional** — not the
cold blue-grey of a fintech app, not the loud primary colors of a telco.
Think warm off-white backgrounds, earthy greens and ambers, large human
faces, generous whitespace. Feels like a trusted neighbourhood notice
board, not a bank.

## Color System

Base the entire app on this palette:

**Primary:** Deep forest green \#1B5E3B — trust, growth, Rwanda's
landscape **Accent:** Warm amber \#E8A020 — energy, calls to action,
money **Background:** Warm off-white \#F7F5F0 — not pure white, feels
softer on cheap Android screens **Surface:** \#FFFFFF cards on the
off-white background **Text primary:** \#1A1A1A — near-black, not pure
black **Text secondary:** \#6B6B6B **Success:** \#2E7D4F **Danger:**
\#C0392B **Verified badge:** \#1565C0 blue — universally signals
"official"

Why green? It echoes Rwanda's flag, the landscape, and carries strong
trust associations. Amber as accent creates warmth without feeling
cheap.

## Typography

Use **Plus Jakarta Sans** (free on Google Fonts) — it is elegant, highly
legible at small sizes on cheap Android screens, and feels modern
without being cold. It has a distinctly human quality that Inter and
Roboto lack.

Scale:

- Display (hero numbers, ratings): 32–40px, weight 700

- Heading: 22px, weight 600

- Subheading: 16px, weight 600

- Body: 15px, weight 400, line-height 1.6

- Caption/label: 12px, weight 500, letter-spacing 0.3px

One rule: **never use weight 400 for anything interactive.** Buttons,
labels, tab bar items — always 600 minimum. Light text on interactive
elements feels broken on cheap screens.

## The Home Screen

This is where you either hook someone or lose them in 3 seconds.

**Top section — personal greeting:**

Good morning, Amina 👋

What do you need fixed today?

Show the user's name. Show the time-appropriate greeting. This single
line makes the app feel alive and personal. Below it, a single
full-width search bar with a placeholder that rotates: *"Find a
plumber..."* → *"Find an electrician..."* — gentle animation cycling
through service types.

**Category grid:** 8 service categories in a 4×2 grid. Each cell has a
large illustrated icon (not a stock icon — commission simple flat
illustrations in Rwanda's green/amber palette), the category name in
Kinyarwanda with English subtitle, and a faint count: *"23 nearby."* The
count is a powerful trust signal — emptiness kills marketplaces.

Make the category icons slightly oversized for their containers so they
bleed out slightly at the top — gives the grid a sense of energy and
depth.

**"Verified nearby" horizontal scroll:** Below the grid, a horizontal
scroll strip of artisan cards. Label it *"Akazi beza hafi yawe"* (Good
workers near you). Each card: artisan photo (large, circular, 56px),
name, category, star rating, distance, and a green verified checkmark if
verified. The cards have a very slight drop shadow (2px blur, 8% opacity
black) — enough to lift them off the background without looking cheap.

**Recent activity strip:** If the user has bookings, show the most
recent one as a contextual card: *"Your plumber Jean-Pierre is scheduled
for tomorrow at 10am."* This makes the app feel like a companion, not
just a directory.

## Artisan Profile Screen — Your Most Important Screen

This screen is where the booking decision happens. Design it like a mix
of a LinkedIn profile and an Airbnb host page.

**Hero section:** Full-width photo of the artisan at the top (not a
small avatar — go big, at least 200px tall, edge-to-edge). Their avatar
floats as a large circle (80px) overlapping the bottom edge of the hero
photo. Name in 22px bold below. Category tags as small green pills:
Plumbing Electrical. Verified badge as a blue shield with "Verified"
text next to it — make this visually prominent.

**Trust metrics bar:** A single horizontal row of three stat boxes right
below the name:

⭐ 4.8 ✅ 47 jobs 📍 2.3 km

Rating Completed Distance

These three numbers answer the three questions every client has before
booking. Make them large (24px), bold, and center-aligned.

**"About" section:** Short bio text. Below it, a row of experience
badges — small rounded rectangles: 8 years experience Speaks Kinyarwanda
Speaks English. These are scannable trust signals.

**Portfolio carousel:** Horizontal swipeable image strip. Real photos of
past work — a fixed tap before/after photo, a tiled bathroom, rewired
switchboard. Label the strip *"Imirimo yakoze"* (Work done). If the
artisan has no portfolio yet, show a gentle nudge: *"No portfolio yet —
check their reviews below."*

**Review section:** Show the 3 most recent reviews. Each review:
reviewer avatar (generated initial circle if no photo), reviewer first
name only (privacy), star rating, time ago ("3 days ago"), and comment
text. A "See all 47 reviews" link at the bottom. The artisan's reply, if
any, is shown indented with a green left border — makes it feel like a
conversation thread.

**Sticky booking footer:** Pinned to the bottom of the screen at all
times while scrolling the profile:

\[ Starting from 8,000 RWF \] \[ Book Now → \]

The Book Now button is full-width amber, weight 700, with a subtle
right-pointing arrow. Never let the user hunt for the booking button.

## Search Results Screen

**List / Map toggle:** Two view modes. Default to list. Map view shows
artisan pins on OSM tiles — use a custom teardrop pin in your brand
green with the artisan's avatar photo inside the pin circle. Tapping a
pin slides up a bottom sheet with the artisan summary card without
leaving the map.

**Artisan list card:** Each card in the list has:

- Circular photo (48px) left-aligned

- Name + category + distance on the right

- Star rating + review count on a second line

- A row of small pills at the bottom: Verified ✓ Pro ⚡ Available now 🟢

- The card background subtly changes for Pro artisans: a very faint
  > amber tint (#FFF8EE) with a thin amber left border — makes premium
  > artisans stand out without screaming at you

**Sort bar:** A single horizontal chip row just below the search bar:
Nearest Top Rated Available Now Verified Only. Active chip is filled
green; inactive is outlined. These are single-tap filters — no modal, no
drawer.

**Empty state:** If no artisans are found, never show a blank screen.
Show the illustrated mascot (a friendly cartoon artisan with a toolbelt)
with the text: *"Nta bantu bagaragara hano ubu"* ("No one here right
now") and two action buttons: *Post a Job* and *Expand search radius.*

## Booking Flow — Reduce Friction to Zero

The booking flow is a 3-step bottom sheet (slides up from the bottom,
does not navigate to a new screen). This keeps the artisan profile
visible underneath, maintaining confidence during the commitment moment.

**Step 1 — Details:**

Book Jean-Pierre

─────────────────────────

Describe your job briefly

\[\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\]

When do you need this done?

\[ Tomorrow ▾ \] \[ Morning ▾ \]

Your budget (optional)

\[ RWF \_\_\_\_\_\_\_\_\_ \]

\[ Continue → \]

**Step 2 — Confirm:** Summary card showing artisan photo, name, your job
description, date. A price range suggested by the platform based on
category averages: *"Typical price for plumbing in Kigali: 5,000–15,000
RWF."* This anchors expectations and reduces post-booking disputes.

**Step 3 — Pay:**

Amount: 8,000 RWF

Pay with: \[ MTN MoMo ● \] \[ Airtel Money ○ \]

Your MoMo number: +2507X XXX XXXX

\[Change\]

You'll receive a MoMo prompt on your phone.

Your payment is held safely until the job is done.

\[ Confirm & Pay → \]

The line *"Your payment is held safely until the job is done"* is the
most important copy on this screen. Say it explicitly. Users who
understand escrow convert at 2–3x the rate of those who don't.

After tapping Confirm, show a full-screen loading state with animated
MoMo logo and the text *"Waiting for your MoMo confirmation..."* — this
is the moment the user picks up their phone and enters their PIN. Make
it obvious what they should be doing.

## Micro-interactions and Motion

These are the small details that make the app feel premium rather than
cheap.

**Rating stars:** When a user taps to submit a rating, each star fills
with a satisfying pop animation — scale up to 1.2 then settle to 1.0
with a spring easing. The unfilled stars are outlined in amber; filled
stars are solid amber with a faint glow.

**Booking status timeline:** The booking detail screen has a vertical
stepper timeline (like a delivery tracker). Each step has a circle
indicator that fills with a smooth progress animation when reached:

● Booking confirmed ✓

● Payment secured ✓

● Artisan on the way ← (pulsing green dot)

○ Job started

○ Job completed

○ Payment released

The current step has a pulsing green dot (CSS keyframe, 0.8s loop). This
is deeply reassuring for anxious clients.

**Availability toggle (artisan home):** A large, prominent toggle switch
— bigger than a standard toggle, occupying a full-width card. When
toggled on, the card background transitions from grey to a soft green
with the text *"You're visible to clients"*. When off, it's grey with
*"You're hidden from search."* Artisans check this every time they open
the app — make it feel satisfying.

**Pull to refresh:** Use a custom refresh indicator — your mascot
artisan swings a wrench instead of the default spinner.

**Haptic feedback:** Light haptic on booking confirmation, medium haptic
on payment success, heavy haptic on payment failure. Use expo-haptics.
Costs nothing, makes critical moments feel real.

**Skeleton loading screens:** Never show a blank white screen or a
generic spinner while data loads. Show skeleton cards — grey animated
shimmer placeholders in the exact shape of the content that will appear.
This makes the app feel instantaneous even on slow 3G.

**Bottom sheet physics:** All bottom sheets (booking flow, artisan quick
view, filter panel) use spring physics — they snap open and have a
satisfying resistance when dragging to dismiss. Use @gorhom/bottom-sheet
library which handles this natively.

## Trust-Building UI Patterns

These are specific design decisions that directly increase booking
conversion.

**Verified badge placement:** Show the blue verified shield in three
places — search result card, artisan profile header, and the booking
confirmation screen. Repetition builds confidence.

**"X people booked this week" social proof:** Below the artisan's stats,
add a small line: *"Booked 6 times this week."* Pull this from the
database. Even a count of 2 is reassuring. This is the same trick
Booking.com uses (*"7 people looking at this right now"*) but less
manipulative — it's just honest activity data.

**Response time indicator:** Show how quickly the artisan typically
responds: *"Usually replies within 2 hours."* Calculate this from
historical booking response data. Fast response time is a major booking
driver.

**Identity signals:** On the artisan card and profile, show small text
indicators — *"From Nyarugenge"*, *"Speaks Kinyarwanda"*, *"ID
verified"*. These are neighbourhood-level familiarity signals that are
particularly important in Rwanda's trust culture.

**Job completion photo:** After marking a job complete, prompt the
artisan to upload a "job done" photo. This photo appears on their
profile tagged to that review. Before/after photos are the single most
powerful portfolio content.

**Escrow explanation tooltip:** On the payment screen, the question mark
icon next to "funds held in escrow" opens a single-screen explainer in
plain Kinyarwanda: *"Amafaranga yanyu abikwa kugeza igihe akazi
karangiye. Niba ikibazo kibaye, turabafasha."* ("Your money is held
until the job is done. If there's a problem, we help you.") Never assume
users understand escrow — explain it every time.

## Artisan Home Screen — Make Them Feel Like Pros

Artisans are the harder side of a marketplace to keep engaged. Their
home screen should feel like a professional dashboard, not a job board.

**Earnings card at the top:**

This month

47,500 RWF earned

─────────────────

8 jobs · ⭐ 4.9 avg

Big number, green text, prominent. Seeing their earnings immediately is
motivating. Below it, a small sparkline chart showing earnings per week
this month (simple, no axes needed).

**Today's schedule:** A card showing confirmed bookings for today in a
timeline format: 9:00am — Plumbing at Kimironko → 2:00pm — Free. Gives
artisans a sense of the day without navigating away from home.

**Nearby open jobs:** A feed below showing the 3 nearest open jobs in
their categories. Each job card has category, distance, client's posted
budget, and a single "Submit Bid" button. No need to navigate —
quick-action from home.

**Streak / achievement badges (gamification):** Small horizontal badge
strip: 🏆 10 jobs done ⭐ 5-star streak 🔥 3 jobs this week. These are
earned and displayed on the profile. Artisans chase them. Gamification
dramatically increases platform retention on the supply side.

## Empty States — Design the Zeros

Every screen that can be empty needs a designed empty state. Never a
blank white void.

**No bookings yet (client):** Illustrated scene of a living room with a
question mark above a leaky pipe. Text: *"Post your first job — it takes
2 minutes."* Large primary CTA button.

**No reviews yet (artisan):** *"Complete your first job to earn your
first review. Your reputation starts here."* — motivating, not
apologetic.

**No jobs nearby (artisan):** *"No open jobs in your area right now.
We'll notify you the moment one arrives."* With a toggle to expand their
service radius.

## Onboarding — First 60 Seconds Are Everything

**For clients (3 screens, can be skipped):**

Screen 1: Full illustration of a Rwandan home, tools floating around it.
*"Find trusted help for your home, today."*

Screen 2: Three icons in a row — magnifying glass → handshake →
checkmark. *"Search. Book. Pay when it's done."* — three words
explaining the entire model.

Screen 3: MoMo logo + lock icon. *"Pay safely with MTN MoMo. Your money
is protected until the job is done."* — address the payment fear before
it becomes a reason not to sign up.

**For artisans (separate onboarding flow):** Focus on the earning
opportunity. Show a sample earnings card: *"Artisans on HandyRwanda earn
an average of 120,000 RWF/month."* Show the profile setup as a progress
bar: *"Complete your profile to start receiving jobs."* Get them to fill
in categories and location before they leave — an incomplete artisan
profile receives zero jobs.

## Notification Design

Notifications are your most valuable re-engagement tool. Make them
specific and human, never generic.

Bad: *"You have a new booking."* Good: *"Jean-Pierre submitted a bid of
9,000 RWF for your plumbing job. Tap to review."*

Bad: *"Payment received."* Good: *"💰 12,000 RWF has been paid to your
MoMo account for the Kimironko cleaning job."*

Bad: *"New job nearby."* Good: *"🔧 Plumbing job posted 1.2km away in
Kicukiro — budget 10,000 RWF. Be first to bid."*

Always include the specific number, location, and a clear action. Vague
notifications get ignored; specific ones get tapped.

## Dark Mode

Support it from day one using React Native's useColorScheme hook. Your
warm off-white background becomes \#1A1A18 (warm dark, not cold pure
black). Cards go to \#242420. Green accent stays the same — it works
beautifully on dark. Amber becomes slightly brighter. Most of your
artisan users will use phones on battery saver with dark mode — support
it and it signals quality.

## Accessibility Essentials

- Minimum tap target size: 44×44px on every interactive element. Cheap
  > touchscreens have low precision.

- All text meets WCAG AA contrast ratio (4.5:1 minimum). Test
  > specifically on your off-white/green combination.

- All images have accessibilityLabel props.

- The OTP input auto-focuses and advances cursor on each digit — never
  > make users tap between boxes.

- The booking confirm button has a 1-second delay before becoming
  > tappable (prevents accidental double-tap confirmation of a payment).

## Small Details That Signal Quality

These cost almost nothing to build but communicate craftsmanship:

- The app icon is the letter H shaped as a wrench — recognisable at 48px
  > on a home screen

- Loading screens show a subtle animated pattern of tools in your brand
  > green — never a generic spinner

- Success screens (payment confirmed, booking accepted) use confetti
  > animation via react-native-confetti-cannon — a tiny delight at a big
  > moment

- Phone number input field auto-formats as the user types: +250 78 XXX
  > XXXX — local formatting, not international

- The price input field shows RWF prefix and formats with commas as you
  > type: 10,000 not 10000

- Timestamps are human: *"2 hours ago"*, *"Yesterday at 3pm"*, never
  > 2024-11-14T15:03:22Z

- Artisan cards in search show a faint category color tint in the
  > top-right corner — plumbing is blue, electrical is yellow, cleaning
  > is teal — scannable without reading

- The dispute button is intentionally smaller and less prominent than
  > the confirm button — you want confirmations, not disputes — the
  > visual hierarchy guides behavior

The throughline in all of this: **every pixel either builds trust or
destroys it.** In a market where hiring a stranger is genuinely risky,
your UI is your product's most important trust signal. A polished, warm,
human interface will convert users that a functional-but-ugly one never
would.
