// File: web/src/routes/index.tsx
import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, ArrowRight, Calendar, ShieldCheck, Sparkles, Loader2 } from "lucide-react";
import { Header } from "@/components/Header";
import { ArtisanCard } from "@/components/ArtisanCard";
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
      // Assuming this endpoint exists or will be implemented.
      // Fallback to null if not found for now.
      try {
        const res = await api.get("/bookings/upcoming");
        return res.data;
      } catch {
        return null;
      }
    },
    enabled: isAuthenticated,
  });

  const { data: featuredArtisans } = useQuery({
    queryKey: ["featured-artisans"],
    queryFn: () =>
      api.get("/artisans/search", {
        params: { latitude: -1.9441, longitude: 30.0619, radius_km: 30, page: 1 },
      }).then((r) =>
        r.data.slice(0, 6).map((a: any) => ({
          id: a.id,
          name: a.full_name,
          category: a.category_name ?? "Artisan",
          categories: [a.category_name ?? "Artisan"],
          photo: a.avatar_url ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${a.id}`,
          rating: a.average_rating ?? 0,
          reviews: a.total_reviews ?? 0,
          jobs: a.total_reviews ?? 0,
          distanceKm: parseFloat(a.distance_km) || 0,
          startingPrice: a.hourly_rate ?? a.fixed_rate ?? 5000,
          hourlyRate: a.hourly_rate,
          verified: ["id_verified", "pro_verified"].includes(a.verification_status ?? ""),
          pro: a.verification_status === "pro_verified",
          availableNow: a.is_available,
          district: a.district ?? "Kigali",
          languages: [],
          experienceYears: 0,
          bio: "",
          responseTime: "Responds quickly",
          weeklyBookings: 0,
        }))
      ).catch(() => null),
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
                    Your {upcomingBooking.category} {upcomingBooking.artisan_name} is scheduled for{" "}
                    {upcomingBooking.time_label}.
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

        {/* Verified nearby */}
        <section className="mt-10">
          <div className="mb-1 flex items-end justify-between">
            <h2 className="text-xl font-bold">Akazi beza hafi yawe</h2>
            <Link to="/search" className="text-sm font-semibold text-primary hover:underline">
              See all
            </Link>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">Good workers near you</p>
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {(featuredArtisans ?? fallbackArtisans).map((a: any) => (
              <div key={a.id} className="w-[85%] shrink-0 snap-start sm:w-[360px]">
                <ArtisanCard a={a} />
              </div>
            ))}
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
