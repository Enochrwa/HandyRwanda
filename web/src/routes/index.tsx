// File: web/src/routes/index.tsx
import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, ArrowRight, Calendar, ShieldCheck, Sparkles, Loader2 } from "lucide-react";
import { Header } from "@/components/Header";
import { ArtisanCard } from "@/components/ArtisanCard";
import type { Artisan } from "@/types/artisan";
import { artisans as fallbackArtisans, categories, categoryTint } from "@/services/artisanService";
import { useAuthStore } from "@/store/authStore";
import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HandyRwanda — Trusted artisans, booked in minutes" },
      {
        name: "description",
        content:
          "Find verified plumbers, electricians, cleaners and more across Rwanda. Pay safely with MoMo, money held until the job is done.",
      },
      { property: "og:title", content: "HandyRwanda — Trusted artisans, booked in minutes" },
      {
        property: "og:description",
        content: "Verified workers near you. Pay safely with MTN MoMo or Airtel Money.",
      },
    ],
  }),
  component: Home,
});

const placeholders = [
  "Find a plumber...",
  "Find an electrician...",
  "Find a cleaner...",
  "Find a carpenter...",
];

function Home() {
  const { user, isAuthenticated } = useAuthStore();
  const [phIndex, setPhIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setPhIndex((i) => (i + 1) % placeholders.length), 2400);
    return () => clearInterval(t);
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const { data: upcomingBooking, isLoading: isLoadingUpcoming } = useQuery({
    queryKey: ["upcoming-booking"],
    queryFn: async () => {
      try {
        const res = await api.get("/bookings/upcoming");
        // Backend returns an array; we show the most imminent one
        const list = Array.isArray(res.data) ? res.data : [];
        return list.length > 0 ? list[0] : null;
      } catch {
        return null;
      }
    },
    enabled: isAuthenticated,
  });

  // Sprint 9 — ML-ranked artisan recommendations (personalised when authenticated)
  const { data: recommendedArtisans, isLoading: isLoadingRecommended } = useQuery({
    queryKey: ["recommended-artisans", isAuthenticated],
    queryFn: async () => {
      if (isAuthenticated) {
        try {
          const res = await api.get("/jobs/recommended-artisans", { params: { limit: 6 } });
          const items: unknown[] = Array.isArray(res.data?.artisans) ? res.data.artisans : [];
          return items.map((a: unknown) => {
            const art = a as Record<string, unknown>;
            return {
              id: (art.artisan_id ?? "") as string,
              full_name: (art.full_name ?? "Unknown") as string,
              avatar_url: (art.avatar_url ?? null) as string | null,
              average_rating: (art.average_rating ?? 0) as number,
              total_reviews: (art.total_reviews ?? 0) as number,
              hourly_rate: (art.hourly_rate ?? null) as number | null,
              verification_status: (art.verification_status ?? null) as string | null,
              district: (art.district ?? "Rwanda") as string,
              is_available: true,
              community_score: (art.community_score ?? 0) as number,
              // Sprint 9 ML signals
              ml_score: (art.ml_score ?? null) as number | null,
              rank_source: (art.rank_source ?? null) as "ml" | "heuristic" | null,
              district_match: (art.district_match ?? 0) as number,
            };
          });
        } catch {
          // fall through to featured artisans
        }
      }
      // Unauthenticated: show featured nearby artisans
      const r = await api.get("/artisans/search", {
        params: { latitude: -1.9441, longitude: 30.0619, radius_km: 30, page: 1 },
      });
      const items: unknown[] = Array.isArray(r.data) ? r.data : (r.data?.items ?? []);
      return items.slice(0, 6).map((a: unknown) => {
        const art = a as Record<string, unknown>;
        return {
          id: (art.id ?? "") as string,
          full_name: (art.full_name ?? "Unknown") as string,
          avatar_url: (art.avatar_url ?? null) as string | null,
          average_rating: (art.average_rating ?? 0) as number,
          total_reviews: (art.total_reviews ?? 0) as number,
          hourly_rate: (art.hourly_rate ?? null) as number | null,
          verification_status: (art.verification_status ?? null) as string | null,
          district: (art.district ?? "Rwanda") as string,
          is_available: (art.is_available ?? true) as boolean,
          community_score: (art.community_score ?? 0) as number,
          ml_score: null,
          rank_source: null,
          district_match: 0,
        };
      });
    },
    staleTime: 3 * 60 * 1000, // 3 minutes
  });

  return (
    <div className="min-h-dvh">
      <Header />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pt-10">
        {/* Greeting + search */}
        <section>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            {greeting}
            {isAuthenticated ? `, ${user?.fullName.split(" ")[0]}` : ""} 👋
          </p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight text-foreground sm:text-4xl">
            What do you need fixed today?
          </h1>

          <Link
            to="/search"
            className="mt-5 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-4 shadow-card transition hover:shadow-lift"
          >
            <Search className="h-5 w-5 text-muted-foreground" />
            <span
              key={phIndex}
              className="flex-1 truncate text-base font-medium text-muted-foreground animate-in fade-in slide-in-from-bottom-1"
            >
              {placeholders[phIndex]}
            </span>
            <span className="hidden rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground sm:inline-block">
              Search
            </span>
          </Link>
        </section>

        {/* Recent activity */}
        {isAuthenticated ? (
          upcomingBooking ? (
            <section className="mt-6 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-accent/5 p-4 shadow-card">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Upcoming</p>
                  <p className="font-semibold text-foreground">
                    {upcomingBooking.title} with {upcomingBooking.artisan_name}
                    {upcomingBooking.scheduled_at
                      ? ` — ${new Date(upcomingBooking.scheduled_at).toLocaleDateString("en-RW", { weekday: "short", month: "short", day: "numeric" })}`
                      : ""}
                  </p>
                </div>
                <Link
                  to="/messages"
                  search={{ booking: upcomingBooking.id }}
                  className="hidden rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground sm:inline-block"
                >
                  Message
                </Link>
              </div>
            </section>
          ) : (
            !isLoadingUpcoming && (
              <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-muted text-muted-foreground">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground">Upcoming</p>
                    <p className="font-semibold text-foreground">You have no upcoming bookings.</p>
                  </div>
                  <Link
                    to="/search"
                    className="hidden rounded-lg border border-border px-3 py-2 text-xs font-bold sm:inline-block"
                  >
                    Browse
                  </Link>
                </div>
              </section>
            )
          )
        ) : (
          <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-muted text-muted-foreground">
                <Calendar className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">HandyRwanda</p>
                <p className="font-semibold text-foreground">
                  Log in to see your upcoming bookings and messages.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Category grid */}
        <section className="mt-10">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-xl font-bold">Browse services</h2>
            <Link to="/search" className="text-sm font-semibold text-primary hover:underline">
              See all
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-3 sm:gap-4">
            {categories.map((c) => (
              <Link
                key={c.name}
                to="/search"
                className="group relative flex flex-col items-center rounded-2xl border border-border bg-card p-3 pt-5 text-center shadow-card transition hover:-translate-y-0.5 hover:shadow-lift sm:p-4 sm:pt-7"
              >
                <span
                  aria-hidden
                  className="absolute -top-3 grid h-12 w-12 place-items-center rounded-2xl text-2xl shadow-card transition group-hover:-translate-y-0.5 sm:h-14 sm:w-14 sm:text-3xl"
                  style={{ background: categoryTint[c.name] }}
                >
                  {c.icon}
                </span>
                <div className="mt-4 text-sm font-bold text-foreground sm:mt-5">{c.rw}</div>
                <div className="text-[11px] font-medium text-muted-foreground">{c.name}</div>
                <div className="mt-1.5 text-[11px] font-semibold text-primary">
                  {c.count} nearby
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Sprint 9 — ML-ranked artisan recommendations */}
        <section className="mt-10">
          <div className="mb-1 flex items-end justify-between">
            <div>
              <h2 className="text-xl font-bold">
                {isAuthenticated ? "Recommended for you" : "Akazi beza hafi yawe"}
              </h2>
              {isAuthenticated && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="text-violet-500">✦</span>
                  Ranked by our matching algorithm based on your history
                </p>
              )}
              {!isAuthenticated && (
                <p className="mt-0.5 text-sm text-muted-foreground">Good workers near you</p>
              )}
            </div>
            <Link to="/search" className="text-sm font-semibold text-primary hover:underline">
              See all
            </Link>
          </div>
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 mt-4">
            {isLoadingRecommended
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-[85%] shrink-0 snap-start sm:w-[200px] h-64 rounded-3xl bg-muted/50 animate-pulse"
                  />
                ))
              : (recommendedArtisans ?? (fallbackArtisans as unknown[]))?.map((a) => {
                  const art = a as import("@/components/ArtisanCard").ArtisanCardData;
                  return (
                    <div key={art.id} className="w-[85%] shrink-0 snap-start sm:w-[200px]">
                      <ArtisanCard a={art} />
                    </div>
                  );
                })}
          </div>
        </section>

        {/* Trust strip */}
        <section className="mt-10 grid gap-3 sm:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: "Verified workers",
              body: "Every artisan is ID-checked before they can take a booking.",
            },
            {
              icon: Sparkles,
              title: "Money held safely",
              body: "We hold your payment in escrow until you confirm the job is done.",
            },
            {
              icon: ArrowRight,
              title: "Pay with MoMo",
              body: "MTN MoMo and Airtel Money — no card, no bank account needed.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-3 font-bold text-foreground">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
