// File: web/src/components/ArtisanCard.tsx
import { Star, MapPin, ShieldCheck, Zap, Circle } from "lucide-react";
import { Link } from "@tanstack/react-router";

export interface ArtisanCardData {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  district?: string | null;
  sector?: string | null;
  average_rating?: number;
  total_reviews?: number;
  hourly_rate?: number | null;
  fixed_rate?: number | null;
  is_available?: boolean;
  verification_status?: string | null;
  // legacy fields kept for backwards compat
  verified?: boolean;
  pro?: boolean;
  categories?: { name_en: string; icon_emoji?: string }[];
}

interface Props {
  a: ArtisanCardData;
}

export function ArtisanCard({ a }: Props) {
  const rating = a.average_rating ?? 0;
  const reviews = a.total_reviews ?? 0;
  const isVerified = a.verification_status === "id_verified" || a.verified;
  const isPro = a.verification_status === "pro_verified" || a.pro;
  const location = [a.sector, a.district].filter(Boolean).join(", ") || a.district || "Rwanda";

  return (
    <Link
      to="/artisan/$id"
      params={{ id: a.id }}
      className="group block rounded-3xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md hover:-translate-y-0.5"
    >
      {/* Avatar + availability */}
      <div className="relative mb-3">
        <div className="mx-auto h-16 w-16 overflow-hidden rounded-full border-2 border-border bg-muted">
          {a.avatar_url ? (
            <img
              src={a.avatar_url}
              alt={`${a.full_name} avatar`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-muted-foreground">
              {a.full_name?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
        </div>
        {/* Online / available dot */}
        {a.is_available !== undefined && (
          <span className="absolute bottom-0 right-1/2 translate-x-6 translate-y-1">
            <Circle
              className={`h-3 w-3 fill-current ${a.is_available ? "text-green-500" : "text-muted-foreground"}`}
            />
          </span>
        )}
      </div>

      {/* Name */}
      <p className="truncate text-center text-sm font-bold text-foreground">{a.full_name}</p>

      {/* Location */}
      {location && (
        <p className="mt-0.5 flex items-center justify-center gap-1 truncate text-[11px] text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          {location}
        </p>
      )}

      {/* Badges */}
      <div className="mt-2 flex flex-wrap justify-center gap-1.5">
        {isVerified && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--verified)]/10 px-2 py-0.5 text-[11px] font-semibold text-[color:var(--verified)]">
            <ShieldCheck className="h-3 w-3" /> Verified
          </span>
        )}
        {isPro && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
            <Zap className="h-3 w-3" /> Pro Verified
          </span>
        )}
      </div>

      {/* Categories */}
      {a.categories && a.categories.length > 0 && (
        <p className="mt-2 truncate text-center text-[11px] text-muted-foreground">
          {a.categories
            .slice(0, 2)
            .map((c) => `${c.icon_emoji ?? "🛠️"} ${c.name_en}`)
            .join(" · ")}
        </p>
      )}

      {/* Rating + rate */}
      <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-[11px]">
        <span className="flex items-center gap-0.5">
          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
          <span className="font-semibold">{rating > 0 ? rating.toFixed(1) : "New"}</span>
          {reviews > 0 && <span className="text-muted-foreground">({reviews})</span>}
        </span>
        {(a.hourly_rate || a.fixed_rate) && (
          <span className="font-semibold text-primary">
            {a.hourly_rate
              ? `${a.hourly_rate.toLocaleString()} RWF/hr`
              : `${a.fixed_rate?.toLocaleString()} RWF`}
          </span>
        )}
      </div>
    </Link>
  );
}
