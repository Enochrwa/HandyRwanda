import { createFileRoute } from "@tanstack/react-router";
import { TrendingUp, Star, MapPin, Clock, Award, Flame, Trophy, ArrowRight } from "lucide-react";
import { Header } from "@/components/Header";
import { formatRWF } from "@/services/artisanService";
import { useState } from "react";

export const Route = createFileRoute("/pro")({
  head: () => ({
    meta: [
      { title: "Artisan dashboard — HandyRwanda" },
      {
        name: "description",
        content: "Track your earnings, schedule, and nearby jobs. Built for working artisans.",
      },
    ],
  }),
  component: Pro,
});

function Pro() {
  const [online, setOnline] = useState(true);

  return (
    <div className="min-h-dvh">
      <Header />
      <main className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">
          Muraho, Jean-Pierre 👋
        </p>
        <h1 className="mt-1 text-3xl font-extrabold">Today’s dashboard</h1>

        {/* Availability toggle */}
        <button
          onClick={() => setOnline((o) => !o)}
          className={[
            "mt-5 flex w-full items-center justify-between rounded-2xl border-2 p-5 text-left transition",
            online ? "border-success/30 bg-success/10" : "border-border bg-muted",
          ].join(" ")}
        >
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {online ? "You’re visible to clients" : "You’re hidden from search"}
            </div>
            <div className="mt-1 text-lg font-bold">
              {online ? "Available now" : "Tap to go online"}
            </div>
          </div>
          <div
            className={[
              "relative h-9 w-16 rounded-full transition",
              online ? "bg-success" : "bg-muted-foreground/30",
            ].join(" ")}
          >
            <span
              className={[
                "absolute top-1 h-7 w-7 rounded-full bg-card shadow-card transition-all",
                online ? "left-8" : "left-1",
              ].join(" ")}
            />
          </div>
        </button>

        {/* Earnings */}
        <section className="mt-5 rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            This month
          </div>
          <div className="mt-1 text-4xl font-extrabold text-success">
            {formatRWF(47500)}{" "}
            <span className="text-lg font-semibold text-muted-foreground">RWF</span>
          </div>
          <div className="mt-1 text-sm font-medium text-muted-foreground">8 jobs · ⭐ 4.9 avg</div>

          {/* Sparkline */}
          <svg viewBox="0 0 200 50" className="mt-4 h-14 w-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.55 0.13 152)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="oklch(0.55 0.13 152)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0,38 L25,30 L50,32 L75,18 L100,22 L125,12 L150,16 L175,8 L200,14 L200,50 L0,50 Z"
              fill="url(#g)"
            />
            <path
              d="M0,38 L25,30 L50,32 L75,18 L100,22 L125,12 L150,16 L175,8 L200,14"
              fill="none"
              stroke="oklch(0.42 0.1 152)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>

          {/* Achievements */}
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { icon: Trophy, label: "10 jobs done" },
              { icon: Star, label: "5-star streak" },
              { icon: Flame, label: "3 jobs this week" },
              { icon: Award, label: "Verified pro" },
            ].map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1.5 text-xs font-bold"
              >
                <Icon className="h-3.5 w-3.5 text-accent" /> {label}
              </span>
            ))}
          </div>
        </section>

        {/* Today's schedule */}
        <section className="mt-6">
          <h2 className="text-lg font-bold">Today’s schedule</h2>
          <div className="mt-3 space-y-2">
            <ScheduleRow time="09:00" title="Plumbing · Kimironko" status="confirmed" />
            <ScheduleRow time="14:00" title="Free" status="free" />
            <ScheduleRow time="16:30" title="Electrical · Remera" status="pending" />
          </div>
        </section>

        {/* Booking timeline */}
        <section className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="text-lg font-bold">Job timeline · Amina’s kitchen</h2>
          <p className="text-sm text-muted-foreground">Tomorrow · 10:00 am</p>
          <ol className="mt-4 space-y-3">
            <Step done label="Booking confirmed" />
            <Step done label="Payment secured" />
            <Step active label="Artisan on the way" />
            <Step label="Job started" />
            <Step label="Job completed" />
            <Step label="Payment released" />
          </ol>
        </section>

        {/* Nearby open jobs */}
        <section className="mt-8">
          <h2 className="text-lg font-bold">Open jobs nearby</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[
              { cat: "Plumbing", area: "Kicukiro", dist: 1.2, budget: 10000 },
              { cat: "Electrical", area: "Nyamirambo", dist: 2.4, budget: 15000 },
              { cat: "Plumbing", area: "Remera", dist: 3.1, budget: 8000 },
            ].map((j, i) => (
              <article key={i} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> {j.area} · {j.dist} km
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-success">
                    <Clock className="h-3 w-3" /> New
                  </span>
                </div>
                <h3 className="mt-2 font-bold">{j.cat} job</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Client budget:{" "}
                  <span className="font-semibold text-foreground">{formatRWF(j.budget)} RWF</span>
                </p>
                <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 font-bold text-primary-foreground hover:bg-primary/90">
                  Submit Bid <ArrowRight className="h-4 w-4" />
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/10 p-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-primary" />
            <h2 className="text-lg font-bold">
              Artisans on HandyRwanda earn on average {formatRWF(120000)} RWF / month
            </h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Complete your profile to start receiving jobs.
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-3/4 bg-primary" />
          </div>
          <p className="mt-2 text-xs font-semibold text-muted-foreground">
            Profile 75% complete · add a portfolio photo to finish
          </p>
        </section>
      </main>
    </div>
  );
}

function ScheduleRow({
  time,
  title,
  status,
}: {
  time: string;
  title: string;
  status: "confirmed" | "pending" | "free";
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
      <div className="w-14 shrink-0">
        <div className="text-base font-extrabold">{time}</div>
      </div>
      <div className="flex-1 font-semibold">{title}</div>
      <span
        className={[
          "rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
          status === "confirmed" && "bg-success/15 text-success",
          status === "pending" && "bg-accent/20 text-foreground",
          status === "free" && "bg-muted text-muted-foreground",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {status}
      </span>
    </div>
  );
}

function Step({ label, done, active }: { label: string; done?: boolean; active?: boolean }) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={[
          "grid h-6 w-6 place-items-center rounded-full border-2",
          done
            ? "border-success bg-success text-card"
            : active
              ? "border-success bg-success/20 animate-pulse-dot"
              : "border-border bg-card",
        ].join(" ")}
      >
        {done && <span className="text-[10px] font-extrabold">✓</span>}
      </span>
      <span
        className={[
          "text-sm",
          done
            ? "font-semibold text-foreground line-through decoration-success/40"
            : active
              ? "font-bold text-foreground"
              : "text-muted-foreground",
        ].join(" ")}
      >
        {label}
      </span>
    </li>
  );
}
