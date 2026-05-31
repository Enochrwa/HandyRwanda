// File: web/src/routes/artisan.$id.tsx
import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Star, MapPin, ShieldCheck, Briefcase, Clock, Languages, Award, ArrowRight,
  MessageCircle, CheckCircle2, Loader2, AlertCircle, Calendar,
} from "lucide-react";
import { Header } from "@/components/Header";
import { BookingSheet } from "@/components/BookingSheet";
import { formatRWF } from "@/services/artisanService";
import { useAuthStore } from "@/store/authStore";
import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import { toast } from "sonner";
import { AuthModal } from "@/components/AuthModal";
import heroWork from "@/assets/hero-work.jpg";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/artisan/$id")({
  head: () => ({
    meta: [{ title: "Artisan Profile — HandyRwanda" }],
  }),
  component: Profile,
});

function Profile() {
  const { id } = Route.useParams();
  const [open, setOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  const { data: artisan, isLoading, isError } = useQuery({
    queryKey: ["artisan-public", id],
    queryFn: () => api.get(`/artisans/${id}/public`).then((r) => r.data),
  });

  const { data: conversations } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.get("/messages/conversations").then((res) => res.data),
    enabled: isAuthenticated,
  });

  const handleMessageClick = () => {
    if (!isAuthenticated) { setIsAuthModalOpen(true); return; }
    const conversation = conversations?.find(
      (c: { other_user: { id: string }; booking_id: string }) => c.other_user.id === id,
    );
    if (conversation) {
      navigate({ to: "/messages", search: { booking: conversation.booking_id } });
    } else {
      toast.info("Book this artisan first to start a conversation.");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-dvh">
        <Header />
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (isError || !artisan) {
    return (
      <div className="min-h-dvh">
        <Header />
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Artisan not found</h1>
          <Link to="/search" className="text-primary font-semibold hover:underline">
            Browse artisans →
          </Link>
        </div>
      </div>
    );
  }

  const p = artisan.profile;
  const verificationBadge =
    p.verification_status === "pro_verified"
      ? { label: "Pro Verified", color: "text-purple-600 bg-purple-100" }
      : p.verification_status === "id_verified"
        ? { label: "ID Verified", color: "text-[color:var(--verified)] bg-[color:var(--verified)]/10" }
        : null;

  const spokenLangs = p.spoken_languages
    ? p.spoken_languages.split(",").map((l: string) => l.trim()).filter(Boolean)
    : [];

  const artisanForBooking = {
    id: artisan.id,
    name: artisan.full_name,
    photo: artisan.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${artisan.id}`,
    category: artisan.categories?.[0]?.name_en ?? "Artisan",
    categories: artisan.categories?.map((c: { name_en: string }) => c.name_en) ?? [],
    rating: p.average_rating,
    reviews: p.total_reviews,
    jobs: p.total_reviews,
    distanceKm: 0,
    startingPrice: p.hourly_rate ?? p.fixed_rate ?? 5000,
    hourlyRate: p.hourly_rate,
    verified: p.verification_status !== "unverified",
    pro: p.verification_status === "pro_verified",
    availableNow: p.is_available,
    district: artisan.district ?? "Rwanda",
    languages: spokenLangs,
    experienceYears: p.years_experience,
    bio: p.bio ?? "",
    responseTime: "Responds quickly",
    weeklyBookings: 0,
    momoPhone: artisan.phone_number,
  };

  return (
    <div className="min-h-dvh pb-28">
      <Header />

      {/* Hero */}
      <div className="relative h-[220px] w-full overflow-hidden sm:h-[280px]">
        <img src={heroWork} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      </div>

      <main className="mx-auto -mt-14 max-w-3xl px-4 sm:px-6">
        {/* Header card */}
        <div className="relative rounded-3xl border border-border bg-card p-6 shadow-lift">
          <img
            src={artisan.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${artisan.id}`}
            alt={artisan.full_name}
            className="absolute -top-10 left-6 h-20 w-20 rounded-full object-cover ring-4 ring-card shadow-card"
          />
          <div className="ml-24">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-extrabold leading-tight">{artisan.full_name}</h1>
              <button
                onClick={handleMessageClick}
                className="p-2 rounded-full bg-muted hover:bg-muted/80 text-foreground transition-colors"
                aria-label="Message artisan"
              >
                <MessageCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {artisan.categories?.map((c: { id: string; name_en: string; icon_emoji?: string }) => (
                <span key={c.id} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  {c.icon_emoji} {c.name_en}
                </span>
              ))}
              {verificationBadge && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${verificationBadge.color}`}>
                  <ShieldCheck className="h-3.5 w-3.5" /> {verificationBadge.label}
                </span>
              )}
              {p.is_available && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-bold text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Available Now
                </span>
              )}
            </div>
          </div>

          {/* Trust metrics */}
          <div className="mt-6 grid grid-cols-3 gap-3 rounded-2xl bg-muted/50 p-4">
            <Stat icon={<Star className="h-4 w-4 fill-accent text-accent" />} value={p.average_rating.toFixed(1)} label="Rating" />
            <Stat icon={<Briefcase className="h-4 w-4 text-success" />} value={p.total_reviews} label="Completed" />
            <Stat icon={<MapPin className="h-4 w-4 text-primary" />} value={artisan.district ?? "Rwanda"} label="District" />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-4 w-4" /> Responds quickly
            </span>
            {p.completion_rate > 0 && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                ✅ {Math.round(p.completion_rate * 100)}% completion rate
              </span>
            )}
          </div>
        </div>

        {/* About */}
        <section className="mt-6">
          <h2 className="text-lg font-bold">About</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-foreground">
            {p.bio || "No bio provided yet."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {p.years_experience > 0 && (
              <Badge icon={<Award className="h-3.5 w-3.5" />}>{p.years_experience} years experience</Badge>
            )}
            {artisan.district && (
              <Badge icon={<MapPin className="h-3.5 w-3.5" />}>From {artisan.district}</Badge>
            )}
            {spokenLangs.map((l: string) => (
              <Badge key={l} icon={<Languages className="h-3.5 w-3.5" />}>Speaks {l}</Badge>
            ))}
            {p.verification_status !== "unverified" && (
              <Badge icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
                {p.verification_status === "pro_verified" ? "Pro Verified" : "ID Verified"}
              </Badge>
            )}
            {p.service_radius_km && (
              <Badge icon={<MapPin className="h-3.5 w-3.5" />}>Travels up to {p.service_radius_km}km</Badge>
            )}
          </div>
        </section>

        {/* Portfolio */}
        {artisan.portfolio?.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-bold">Imirimo yakoze <span className="text-muted-foreground text-sm font-normal">(Past work)</span></h2>
            <div className="-mx-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
              {artisan.portfolio.map((p: { id: string; image_url: string; job_type?: string }) => (
                <div key={p.id} className="relative aspect-[4/3] w-[78%] shrink-0 snap-start overflow-hidden rounded-2xl bg-muted sm:w-72">
                  <img src={p.image_url} alt={p.job_type ?? "Past work"} loading="lazy" className="h-full w-full object-cover" />
                  {p.job_type && (
                    <div className="absolute bottom-2 left-2 rounded-lg bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
                      {p.job_type}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Reviews */}
        <section className="mt-8 mb-4">
          <div className="flex items-end justify-between">
            <h2 className="text-lg font-bold">Reviews ({p.total_reviews})</h2>
          </div>
          {artisan.reviews?.length > 0 ? (
            <div className="mt-3 space-y-3">
              {artisan.reviews.map((r: {
                id: string; client_name: string; client_avatar?: string;
                rating: number; comment?: string; artisan_reply?: string; created_at: string;
              }) => (
                <article key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/20 font-bold text-foreground overflow-hidden">
                      {r.client_avatar
                        ? <img src={r.client_avatar} alt="" className="h-full w-full object-cover" />
                        : r.client_name[0]}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold">{r.client_name}</p>
                        <span className="text-xs text-muted-foreground">
                          {r.created_at ? formatDistanceToNow(new Date(r.created_at), { addSuffix: true }) : ""}
                        </span>
                      </div>
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-accent text-accent" : "text-muted"}`} />
                        ))}
                      </div>
                    </div>
                  </div>
                  {r.comment && <p className="mt-2 text-[15px] text-foreground">{r.comment}</p>}
                  {r.artisan_reply && (
                    <div className="mt-3 rounded-xl border-l-4 border-primary bg-muted/40 p-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-primary">
                        <MessageCircle className="h-3.5 w-3.5" /> {artisan.full_name.split(" ")[0]} replied
                      </div>
                      <p className="mt-1 text-sm text-foreground">{r.artisan_reply}</p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center">
              <Star className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">No reviews yet. Be the first!</p>
            </div>
          )}
        </section>
      </main>

      {/* Sticky booking footer */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Starting from</div>
            <div className="text-lg font-extrabold text-foreground">
              {formatRWF(artisanForBooking.startingPrice)}{" "}
              <span className="text-sm font-semibold text-muted-foreground">RWF</span>
            </div>
          </div>
          <button
            onClick={() => {
              if (!isAuthenticated) { setIsAuthModalOpen(true); return; }
              setOpen(true);
            }}
            className="flex min-h-12 items-center gap-2 rounded-2xl bg-accent px-6 py-3.5 font-bold text-accent-foreground transition hover:brightness-95"
          >
            Book Now <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <BookingSheet a={artisanForBooking} open={open} onClose={() => setOpen(false)} />
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: React.ReactNode; label: string }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1.5">
        {icon}
        <div className="text-2xl font-extrabold leading-none">{value}</div>
      </div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function Badge({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-foreground">
      {icon} {children}
    </span>
  );
}
