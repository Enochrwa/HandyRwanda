import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, ArrowRight, Calendar, ShieldCheck, Sparkles } from "lucide-react";
import { Header } from "@/components/Header";
import { ArtisanCard } from "@/components/ArtisanCard";
import { artisans, categories, categoryTint } from "@/services/artisanService";

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
  const [phIndex, setPhIndex] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPhIndex((i) => (i + 1) % placeholders.length), 2400);
    return () => clearInterval(t);
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-dvh">
      <Header />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pt-10">
        {/* Greeting + search */}
        <section>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            {greeting}, Amina 👋
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
        <section className="mt-6 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-accent/5 p-4 shadow-card">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Calendar className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground">Upcoming</p>
              <p className="font-semibold text-foreground">
                Your plumber Jean-Pierre is scheduled for tomorrow at 10:00 am.
              </p>
            </div>
            <Link
              to="/artisan/$id"
              params={{ id: "jean-pierre" }}
              className="hidden rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground sm:inline-block"
            >
              View
            </Link>
          </div>
        </section>

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
            {artisans.map((a) => (
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
