import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search as SearchIcon, SlidersHorizontal, MapPin } from "lucide-react";
import { Header } from "@/components/Header";
import { ArtisanCard } from "@/components/ArtisanCard";
import { artisans } from "@/services/artisanService";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Browse artisans near you — HandyRwanda" },
      {
        name: "description",
        content: "Search verified plumbers, electricians, cleaners and more across Kigali.",
      },
      { property: "og:title", content: "Browse artisans near you — HandyRwanda" },
    ],
  }),
  component: SearchPage,
});

const filters = ["Nearest", "Top Rated", "Available Now", "Verified Only", "Pro"] as const;

function SearchPage() {
  const [q, setQ] = useState("");
  const [active, setActive] = useState<(typeof filters)[number]>("Nearest");
  const [view, setView] = useState<"list" | "map">("list");

  const results = artisans
    .filter((a) =>
      q ? (a.name + a.category + a.district).toLowerCase().includes(q.toLowerCase()) : true,
    )
    .filter((a) =>
      active === "Available Now"
        ? a.availableNow
        : active === "Verified Only"
          ? a.verified
          : active === "Pro"
            ? a.pro
            : true,
    )
    .sort((a, b) => (active === "Top Rated" ? b.rating - a.rating : a.distanceKm - b.distanceKm));

  return (
    <div className="min-h-dvh">
      <Header />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
        {/* Search bar */}
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-card">
          <SearchIcon className="h-5 w-5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search plumbing, cleaning, electrician..."
            className="flex-1 bg-transparent text-base font-medium outline-none placeholder:text-muted-foreground"
          />
          <button
            aria-label="Filters"
            className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-foreground"
          >
            <SlidersHorizontal className="h-5 w-5" />
          </button>
        </div>

        {/* Sort chips + view toggle */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {filters.map((f) => {
              const isActive = active === f;
              return (
                <button
                  key={f}
                  onClick={() => setActive(f)}
                  className={[
                    "shrink-0 rounded-full border-2 px-4 py-2 text-sm font-semibold transition",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:bg-muted",
                  ].join(" ")}
                >
                  {f}
                </button>
              );
            })}
          </div>
          <div className="hidden shrink-0 overflow-hidden rounded-xl border border-border bg-card sm:flex">
            {(["list", "map"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={[
                  "px-4 py-2 text-sm font-bold capitalize",
                  view === v
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted",
                ].join(" ")}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-4 text-sm font-medium text-muted-foreground">
          {results.length} artisan{results.length === 1 ? "" : "s"} near Nyarugenge, Kigali
        </p>

        {view === "map" ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="relative h-[520px] overflow-hidden rounded-2xl border border-border bg-[oklch(0.92_0.02_140)] shadow-card">
              <div
                className="absolute inset-0 opacity-50"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 30% 40%, oklch(0.85 0.06 140) 0, transparent 35%), radial-gradient(circle at 70% 60%, oklch(0.88 0.05 195) 0, transparent 40%)",
                }}
              />
              {results.map((a, i) => (
                <div
                  key={a.id}
                  className="absolute"
                  style={{ left: `${20 + i * 18}%`, top: `${30 + (i % 2) * 25}%` }}
                >
                  <div className="relative grid h-12 w-12 place-items-center rounded-full border-4 border-primary bg-card shadow-lift">
                    <img src={a.photo} alt="" className="h-full w-full rounded-full object-cover" />
                    <span className="absolute -bottom-2 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[6px] border-t-[8px] border-x-transparent border-t-primary" />
                  </div>
                </div>
              ))}
              <div className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-card/90 px-3 py-2 text-xs font-semibold backdrop-blur">
                <MapPin className="h-4 w-4 text-primary" /> Kigali · Nyarugenge
              </div>
            </div>
            <div className="space-y-3">
              {results.map((a) => (
                <ArtisanCard key={a.id} a={a} />
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {results.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-border bg-card p-10 text-center">
                <div className="text-5xl">🛠️</div>
                <h3 className="mt-3 text-lg font-bold">Nta bantu bagaragara hano ubu</h3>
                <p className="text-sm text-muted-foreground">
                  No one matches your search right now.
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  <button className="rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground">
                    Post a job
                  </button>
                  <button className="rounded-xl border border-border bg-card px-4 py-2.5 font-semibold">
                    Expand radius
                  </button>
                </div>
              </div>
            ) : (
              results.map((a) => <ArtisanCard key={a.id} a={a} />)
            )}
          </div>
        )}
      </main>
    </div>
  );
}
