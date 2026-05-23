import { Link } from "@tanstack/react-router";
import { Star, MapPin, ShieldCheck, Zap, Circle } from "lucide-react";
import { categoryTint, formatRWF } from "@/services/artisanService";
import type { Artisan } from "@/types/artisan";

export function ArtisanCard({ a }: { a: Artisan }) {
  return (
    <Link
      to="/artisan/$id"
      params={{ id: a.id }}
      className={[
        "group relative block overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift",
        a.pro ? "border-l-4" : "",
      ].join(" ")}
      style={
        a.pro ? { backgroundColor: "var(--pro-tint)", borderLeftColor: "var(--accent)" } : undefined
      }
    >
      <span
        aria-hidden
        className="absolute right-0 top-0 h-16 w-16 rounded-bl-3xl opacity-25"
        style={{ background: categoryTint[a.category] ?? "var(--accent)" }}
      />
      <div className="flex gap-3">
        <img
          src={a.photo}
          alt={a.name}
          loading="lazy"
          width={96}
          height={96}
          className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-background"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate font-semibold leading-tight text-foreground">{a.name}</h3>
              <p className="mt-0.5 text-sm font-medium text-muted-foreground">
                {a.category} · {a.distanceKm} km away
              </p>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                From
              </div>
              <div className="font-bold text-foreground">
                {formatRWF(a.startingPrice)}
                <span className="ml-1 text-xs text-muted-foreground">RWF</span>
              </div>
            </div>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-sm">
            <Star className="h-4 w-4 fill-accent text-accent" />
            <span className="font-semibold">{a.rating}</span>
            <span className="text-muted-foreground">({a.reviews})</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {a.verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--verified)]/10 px-2 py-0.5 text-[11px] font-semibold text-[color:var(--verified)]">
                <ShieldCheck className="h-3 w-3" /> Verified
              </span>
            )}
            {a.pro && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-foreground">
                <Zap className="h-3 w-3" /> Pro
              </span>
            )}
            {a.availableNow && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
                <Circle className="h-2 w-2 fill-success text-success" /> Available now
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              <MapPin className="h-3 w-3" /> {a.district}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
