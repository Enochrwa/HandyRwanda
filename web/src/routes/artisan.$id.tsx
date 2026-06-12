// File: web/src/routes/artisan.$id.tsx
/**
 * Sprint 4 + 5 enhanced Artisan Profile Page.
 *
 * Sprint 4 additions:
 *  - "Book Again ⚡" button prominently shown when the viewing client
 *    has a completed booking with this artisan
 *  - InstantBookModal: inline modal for instant re-booking (no bid flow)
 *  - 10-minute countdown shown after instant booking is submitted
 *  - Fallback "Get Bids Instead" link always visible in instant book modal
 *  - Previous booking details pre-filled (last price, last job title)
 *
 * Sprint 5 additions:
 *  - Community Safety Score badge (full variant) below artisan avatar
 *  - Score breakdown fetched from /artisans/{id}/score and shown in info modal
 *  - Score tier displayed on the artisan hero section
 */

import { useState, useEffect, useCallback } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Star,
  MapPin,
  ShieldCheck,
  Briefcase,
  Clock,
  Languages,
  Award,
  ArrowRight,
  MessageCircle,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Calendar,
  Zap,
  X,
  Timer,
  RefreshCw,
  Play,
  Eye,
  Video,
} from "lucide-react";
import { Header } from "@/components/Header";
import { BookingSheet } from "@/components/BookingSheet";
import { formatRWF } from "@/services/artisanService";
import { useAuthStore, type User } from "@/store/authStore";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import { toast } from "sonner";
import { AuthModal } from "@/components/AuthModal";
import heroWork from "@/assets/hero-work.jpg";
import { formatDistanceToNow } from "date-fns";
import { SafetyScoreBadge, type ScoreBreakdown } from "@/components/SafetyScoreBadge";

export const Route = createFileRoute("/artisan/$id")({
  head: () => ({
    meta: [{ title: "Artisan Profile — HandyRwanda" }],
  }),
  component: Profile,
});

// ── Types ─────────────────────────────────────────────────────────────────────

interface PreviousArtisanInfo {
  artisan_id: string;
  last_price: number;
  last_job_title: string;
  last_category: string;
  last_booked_at: string;
  instant_book_eligible: boolean;
  is_available: boolean;
  verification_status: string;
}

interface InstantBookResult {
  id: string;
  job_id: string;
  status: string;
  agreed_price: number;
  artisan_name: string;
  message: string;
  expires_at: string;
}

// ── Countdown timer component ─────────────────────────────────────────────────

function ExpiryCountdown({ expiresAt }: { expiresAt: string }) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)),
  );

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally once — functional updater needs no dep

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const expired = secondsLeft <= 0;
  const urgent = secondsLeft <= 120; // last 2 min

  if (expired) {
    return (
      <p className="mt-2 text-sm text-amber-600 font-medium">
        Response time expired. Your job has been opened for bids.
      </p>
    );
  }

  return (
    <div className="mt-3 flex flex-col items-center">
      <p className="text-xs text-muted-foreground mb-1">Artisan has</p>
      <div
        className={`text-3xl font-extrabold tabular-nums tracking-widest transition-colors ${
          urgent ? "text-red-500" : "text-primary"
        }`}
      >
        {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </div>
      <p className="text-xs text-muted-foreground mt-1">to confirm your booking</p>
    </div>
  );
}

// ── Instant Book Modal ────────────────────────────────────────────────────────

function InstantBookModal({
  artisan,
  previousInfo,
  open,
  onClose,
  onSuccess,
}: {
  artisan: {
    id: string;
    full_name: string;
    avatar_url?: string;
    categories?: { name_en: string }[];
  };
  previousInfo: PreviousArtisanInfo;
  open: boolean;
  onClose: () => void;
  onSuccess: (result: InstantBookResult) => void;
}) {
  const queryClient = useQueryClient();
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState(String(previousInfo.last_price));
  const [useLastPrice, setUseLastPrice] = useState(true);
  const [descError, setDescError] = useState("");
  const [result, setResult] = useState<InstantBookResult | null>(null);

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setDescription("");
        setBudget(String(previousInfo.last_price));
        setUseLastPrice(true);
        setDescError("");
        setResult(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open, previousInfo.last_price]);

  const mutation = useMutation<InstantBookResult, Error, object>({
    mutationFn: (body) => api.post("/bookings/instant", body).then((r) => r.data),
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      onSuccess(data);
      toast.success(`⚡ Instant booking sent to ${data.artisan_name}!`);
    },
    onError: (err: unknown) => {
      const apiErr = err as { response?: { data?: { detail?: string } } };
      toast.error(apiErr?.response?.data?.detail ?? "Booking failed. Please try again.");
    },
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = description.trim();
      if (trimmed.length < 10) {
        setDescError("Please describe what you need done (at least 10 characters).");
        return;
      }
      setDescError("");

      const agreedPrice = useLastPrice
        ? previousInfo.last_price
        : parseInt(budget.replace(/[^0-9]/g, ""), 10);

      if (!useLastPrice && (!agreedPrice || agreedPrice < 1)) {
        toast.error("Please enter a valid budget amount.");
        return;
      }

      mutation.mutate({
        artisan_id: artisan.id,
        category_id: "00000000-0000-0000-0000-000000000000",
        description: trimmed,
        budget: agreedPrice,
        use_last_price: useLastPrice,
      });
    },
    [artisan.id, description, budget, useLastPrice, previousInfo.last_price, mutation],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-card border border-border shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-4 pb-0">
          <div>
            <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Book Again
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Skip the bidding — instant re-booking
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 rounded-full bg-muted p-2 text-muted-foreground hover:bg-muted/80 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pb-6 overflow-y-auto max-h-[80vh]">
          {/* ── SUCCESS STATE ──────────────────────────────────────────── */}
          {result ? (
            <div className="py-4 flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-9 w-9 text-primary" />
              </div>
              <h3 className="text-xl font-extrabold text-foreground">Booking Sent! ⚡</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {result.artisan_name} has been notified and must confirm within:
              </p>
              <ExpiryCountdown expiresAt={result.expires_at} />
              <div className="mt-5 w-full space-y-2">
                <Link
                  to="/messages"
                  search={{ booking: result.id }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 font-bold text-white hover:brightness-95 transition"
                  onClick={onClose}
                >
                  View Booking <ArrowRight className="h-4 w-4" />
                </Link>
                <button
                  onClick={onClose}
                  className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            /* ── FORM STATE ──────────────────────────────────────────── */
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              {/* Artisan summary card */}
              <div className="rounded-2xl bg-primary/5 border border-primary/15 p-4">
                <div className="flex items-center gap-3">
                  <img
                    src={
                      artisan.avatar_url ??
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${artisan.id}`
                    }
                    alt={artisan.full_name}
                    className="h-12 w-12 rounded-xl object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground truncate">{artisan.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {previousInfo.last_category} ·{" "}
                      {formatDistanceToNow(new Date(previousInfo.last_booked_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-primary/10 flex justify-between text-sm">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Last Job
                    </p>
                    <p className="font-semibold text-foreground truncate max-w-[160px]">
                      {previousInfo.last_job_title}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Last Price
                    </p>
                    <p className="font-bold text-primary">{formatRWF(previousInfo.last_price)}</p>
                  </div>
                </div>
              </div>

              {/* Eligibility warning */}
              {!previousInfo.instant_book_eligible && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 flex items-start gap-2 text-sm text-amber-800">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>
                    {!previousInfo.is_available
                      ? `${artisan.full_name} is currently unavailable.`
                      : "This artisan is not eligible for instant booking right now."}{" "}
                    You can still post an open job to receive bids.
                  </p>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="text-sm font-semibold text-foreground block mb-1.5">
                  Describe your job <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (e.target.value.trim().length >= 10) setDescError("");
                  }}
                  placeholder={`What do you need ${artisan.full_name.split(" ")[0]} to do?`}
                  rows={4}
                  maxLength={2000}
                  className={`w-full rounded-2xl border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 transition ${
                    descError ? "border-red-400" : "border-border"
                  }`}
                />
                {descError ? (
                  <p className="mt-1 text-xs text-red-500">{descError}</p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground text-right">
                    {description.length}/2000
                  </p>
                )}
              </div>

              {/* Budget */}
              <div>
                <label className="text-sm font-semibold text-foreground block mb-1.5">
                  Agreed Price
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setUseLastPrice(!useLastPrice);
                    if (!useLastPrice) setBudget(String(previousInfo.last_price));
                  }}
                  className={`w-full flex items-center justify-between rounded-2xl border p-3 text-left transition-colors ${
                    useLastPrice
                      ? "border-primary/30 bg-primary/5"
                      : "border-border bg-background hover:bg-muted/30"
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">Use last price</p>
                    <p className="text-xs text-muted-foreground">
                      {formatRWF(previousInfo.last_price)} — same as your last booking
                    </p>
                  </div>
                  <div
                    className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      useLastPrice ? "border-primary bg-primary" : "border-border bg-background"
                    }`}
                  >
                    {useLastPrice && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                </button>

                {!useLastPrice && (
                  <div className="mt-2 flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2.5">
                    <span className="text-sm font-semibold text-muted-foreground">RWF</span>
                    <input
                      type="number"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      placeholder="Enter amount"
                      min={1}
                      className="flex-1 bg-transparent text-sm text-foreground focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Schedule note */}
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                Scheduled time is optional — {artisan.full_name.split(" ")[0]} will contact you to
                confirm a time.
              </p>

              {/* CTAs */}
              <button
                type="submit"
                disabled={mutation.isPending || !previousInfo.instant_book_eligible}
                className={`w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 font-bold text-base transition ${
                  previousInfo.instant_book_eligible && !mutation.isPending
                    ? "bg-primary text-white hover:brightness-95"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
              >
                {mutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Zap className="h-5 w-5" />
                    {previousInfo.instant_book_eligible ? "Book Now ⚡" : "Not Available Right Now"}
                  </>
                )}
              </button>

              <Link
                to="/jobs/post"
                className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors py-2"
                onClick={onClose}
              >
                Prefer to get bids instead?
                <span className="font-semibold text-primary"> Post as open job</span>
                <ArrowRight className="h-3.5 w-3.5 text-primary" />
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Profile Component ────────────────────────────────────────────────────

function Profile() {
  const { id } = Route.useParams();
  const [open, setOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [instantBookOpen, setInstantBookOpen] = useState(false);
  const [instantBookResult, setInstantBookResult] = useState<InstantBookResult | null>(null);
  const [playingSkillVideo, setPlayingSkillVideo] = useState<{
    id: string;
    video_url: string;
    title: string;
    category_name?: string;
    description?: string;
    view_count: number;
    duration_seconds?: number;
  } | null>(null);
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();

  const isClient = isAuthenticated && (user as User | null)?.role !== "artisan";

  const {
    data: artisan,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["artisan-public", id],
    queryFn: () => api.get(`/artisans/${id}/public`).then((r) => r.data),
  });

  const { data: conversations } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.get("/messages/conversations").then((res) => res.data),
    enabled: isAuthenticated,
  });

  // Sprint 4: fetch previous artisans to see if this artisan qualifies for instant book
  const { data: previousArtisans } = useQuery<PreviousArtisanInfo[]>({
    queryKey: ["previous-artisans"],
    queryFn: () => api.get("/artisans/previous").then((r) => r.data),
    enabled: isClient,
    staleTime: 5 * 60 * 1000,
  });

  // Find if this artisan was previously used by this client
  const previousInfo = previousArtisans?.find((a) => a.artisan_id === id);
  const hasWorkedBefore = !!previousInfo;

  // Sprint 5: fetch safety score breakdown for this artisan
  const { data: scoreBreakdown } = useQuery<ScoreBreakdown>({
    queryKey: ["artisan-score", id],
    queryFn: () => api.get(`/artisans/${id}/score`).then((r) => r.data),
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // score changes at most once a night
  });

  const handleMessageClick = () => {
    if (!isAuthenticated) {
      setIsAuthModalOpen(true);
      return;
    }
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
        ? {
            label: "ID Verified",
            color: "text-[color:var(--verified)] bg-[color:var(--verified)]/10",
          }
        : null;

  const spokenLangs = p.spoken_languages
    ? p.spoken_languages
        .split(",")
        .map((l: string) => l.trim())
        .filter(Boolean)
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
            src={
              artisan.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${artisan.id}`
            }
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
              {artisan.categories?.map(
                (c: { id: string; name_en: string; icon_emoji?: string }) => (
                  <span
                    key={c.id}
                    className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary"
                  >
                    {c.icon_emoji} {c.name_en}
                  </span>
                ),
              )}
              {verificationBadge && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${verificationBadge.color}`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> {verificationBadge.label}
                </span>
              )}
              {p.is_available && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-bold text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Available
                  Now
                </span>
              )}
            </div>
          </div>

          {/* ── Sprint 4: "Book Again" prompt (shown if client has prior relationship) */}
          {isClient && hasWorkedBefore && previousInfo && (
            <div className="mt-4 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <RefreshCw className="h-4 w-4 text-primary" />
                    <span className="text-sm font-extrabold text-primary">
                      You've worked together before
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last booked{" "}
                    {formatDistanceToNow(new Date(previousInfo.last_booked_at), {
                      addSuffix: true,
                    })}{" "}
                    · {previousInfo.last_category} · {formatRWF(previousInfo.last_price)}
                  </p>
                  {previousInfo.instant_book_eligible ? (
                    <p className="text-xs text-primary font-semibold mt-1">
                      ⚡ Available for instant booking right now
                    </p>
                  ) : (
                    <p className="text-xs text-amber-600 font-semibold mt-1">
                      ⚠️ Currently unavailable for instant booking
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (!isAuthenticated) {
                      setIsAuthModalOpen(true);
                      return;
                    }
                    setInstantBookOpen(true);
                  }}
                  className={`flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                    previousInfo.instant_book_eligible
                      ? "bg-primary text-white hover:brightness-95 shadow-sm"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Zap className="h-4 w-4" />
                  Book Again
                </button>
              </div>
            </div>
          )}

          {/* Trust metrics */}
          <div className="mt-6 grid grid-cols-3 gap-3 rounded-2xl bg-muted/50 p-4">
            <Stat
              icon={<Star className="h-4 w-4 fill-accent text-accent" />}
              value={p.average_rating.toFixed(1)}
              label="Rating"
            />
            <Stat
              icon={<Briefcase className="h-4 w-4 text-success" />}
              value={p.total_reviews}
              label="Completed"
            />
            <Stat
              icon={<MapPin className="h-4 w-4 text-primary" />}
              value={artisan.district ?? "Rwanda"}
              label="District"
            />
          </div>

          {/* Sprint 5: Community Safety Score Badge */}
          {(p.community_score > 0 || scoreBreakdown) && (
            <div className="mt-4">
              <SafetyScoreBadge
                score={scoreBreakdown?.total_score ?? p.community_score ?? 0}
                breakdown={scoreBreakdown}
                variant="full"
                showInfo={true}
              />
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {p.hourly_rate && (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-4 w-4" />
                {formatRWF(p.hourly_rate)}/hr
              </span>
            )}
            {p.years_experience > 0 && (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Award className="h-4 w-4" />
                {p.years_experience} yrs experience
              </span>
            )}
            {artisan.district && (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {artisan.district}
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
              <Badge icon={<Award className="h-3.5 w-3.5" />}>
                {p.years_experience} years experience
              </Badge>
            )}
            {artisan.district && (
              <Badge icon={<MapPin className="h-3.5 w-3.5" />}>From {artisan.district}</Badge>
            )}
            {spokenLangs.map((l: string) => (
              <Badge key={l} icon={<Languages className="h-3.5 w-3.5" />}>
                Speaks {l}
              </Badge>
            ))}
            {p.verification_status !== "unverified" && (
              <Badge icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
                {p.verification_status === "pro_verified" ? "Pro Verified" : "ID Verified"}
              </Badge>
            )}
            {p.service_radius_km && (
              <Badge icon={<MapPin className="h-3.5 w-3.5" />}>
                Travels up to {p.service_radius_km}km
              </Badge>
            )}
          </div>
        </section>

        {/* Portfolio */}
        {artisan.portfolio?.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-bold">
              Imirimo yakoze{" "}
              <span className="text-muted-foreground text-sm font-normal">(Past work)</span>
            </h2>
            <div className="-mx-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
              {artisan.portfolio.map((p: { id: string; image_url: string; job_type?: string }) => (
                <div
                  key={p.id}
                  className="relative aspect-[4/3] w-[78%] shrink-0 snap-start overflow-hidden rounded-2xl bg-muted sm:w-72"
                >
                  <img
                    src={p.image_url}
                    alt={p.job_type ?? "Past work"}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
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

        {/* Sprint 10: Skill Videos */}
        {artisan.skill_videos?.length > 0 && (
          <section className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Video className="h-5 w-5 text-primary" />
                Skill Videos
              </h2>
              <span className="text-xs bg-emerald-100 text-emerald-700 font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                {artisan.skill_videos.length} verified
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Watch {artisan.full_name.split(" ")[0]} demonstrate their skills before hiring.
            </p>
            <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
              {artisan.skill_videos.map(
                (v: {
                  id: string;
                  video_url: string;
                  thumbnail_url?: string;
                  title: string;
                  category_name?: string;
                  description?: string;
                  view_count: number;
                  duration_seconds?: number;
                }) => (
                  <button
                    key={v.id}
                    onClick={async () => {
                      setPlayingSkillVideo(v);
                      try {
                        await api.post(`/artisans/skill-videos/${v.id}/view`);
                      } catch (_e) {
                        /* view count is fire-and-forget */
                      }
                    }}
                    className="group relative aspect-video w-[78%] shrink-0 snap-start overflow-hidden rounded-2xl bg-zinc-900 sm:w-64 text-left"
                  >
                    {v.thumbnail_url ? (
                      <img
                        src={v.thumbnail_url}
                        alt={v.title}
                        className="h-full w-full object-cover opacity-90 group-hover:opacity-75 transition-opacity"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Video className="h-10 w-10 text-zinc-600" />
                      </div>
                    )}
                    {/* Play overlay */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-black/60 group-hover:bg-black/50 flex items-center justify-center transition-colors">
                        <Play className="h-5 w-5 text-white fill-white ml-0.5" />
                      </div>
                    </div>
                    {/* Duration */}
                    {v.duration_seconds && (
                      <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
                        {Math.floor(v.duration_seconds / 60)}:
                        {String(v.duration_seconds % 60).padStart(2, "0")}
                      </div>
                    )}
                    {/* Info bar */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-6">
                      <p className="text-white text-xs font-semibold truncate">{v.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {v.category_name && (
                          <span className="text-white/70 text-[10px]">{v.category_name}</span>
                        )}
                        <div className="flex items-center gap-0.5 text-white/60 text-[10px]">
                          <Eye className="h-2.5 w-2.5" />
                          {v.view_count.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </button>
                ),
              )}
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
              {artisan.reviews.map(
                (r: {
                  id: string;
                  client_name: string;
                  client_avatar?: string;
                  rating: number;
                  comment?: string;
                  artisan_reply?: string;
                  created_at: string;
                }) => (
                  <article
                    key={r.id}
                    className="rounded-2xl border border-border bg-card p-4 shadow-card"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/20 font-bold text-foreground overflow-hidden">
                        {r.client_avatar ? (
                          <img
                            src={r.client_avatar}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          r.client_name[0]
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold">{r.client_name}</p>
                          <span className="text-xs text-muted-foreground">
                            {r.created_at
                              ? formatDistanceToNow(new Date(r.created_at), { addSuffix: true })
                              : ""}
                          </span>
                        </div>
                        <div className="flex">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3.5 w-3.5 ${i < r.rating ? "fill-accent text-accent" : "text-muted"}`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    {r.comment && <p className="mt-2 text-[15px] text-foreground">{r.comment}</p>}
                    {r.artisan_reply && (
                      <div className="mt-3 rounded-xl border-l-4 border-primary bg-muted/40 p-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-primary">
                          <MessageCircle className="h-3.5 w-3.5" />{" "}
                          {artisan.full_name.split(" ")[0]} replied
                        </div>
                        <p className="mt-1 text-sm text-foreground">{r.artisan_reply}</p>
                      </div>
                    )}
                  </article>
                ),
              )}
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
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Starting from
            </div>
            <div className="text-lg font-extrabold text-foreground">
              {formatRWF(artisanForBooking.startingPrice)}{" "}
              <span className="text-sm font-semibold text-muted-foreground">RWF</span>
            </div>
          </div>

          {/* Sprint 4: Show "Book Again" button in footer if eligible */}
          {isClient && hasWorkedBefore && previousInfo?.instant_book_eligible && (
            <button
              onClick={() => {
                if (!isAuthenticated) {
                  setIsAuthModalOpen(true);
                  return;
                }
                setInstantBookOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-2xl border-2 border-primary bg-primary/10 px-4 py-3 font-bold text-primary transition hover:bg-primary/20"
            >
              <Zap className="h-4 w-4" />
              Book Again
            </button>
          )}

          <button
            onClick={() => {
              if (!isAuthenticated) {
                setIsAuthModalOpen(true);
                return;
              }
              setOpen(true);
            }}
            className="flex min-h-12 items-center gap-2 rounded-2xl bg-accent px-6 py-3.5 font-bold text-accent-foreground transition hover:brightness-95"
          >
            {hasWorkedBefore ? "Get a Quote" : "Book Now"} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Sprint 10: Video Playback Modal */}
      {playingSkillVideo && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col"
          onClick={() => setPlayingSkillVideo(null)}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 pt-5 pb-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <p className="text-white font-bold text-base">{playingSkillVideo.title}</p>
              {playingSkillVideo.category_name && (
                <p className="text-zinc-400 text-sm mt-0.5">{playingSkillVideo.category_name}</p>
              )}
            </div>
            <button
              onClick={() => setPlayingSkillVideo(null)}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors ml-4"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {/* Player */}
          <div
            className="flex-1 flex items-center justify-center px-4 pb-4"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              key={playingSkillVideo.id}
              src={playingSkillVideo.video_url}
              controls
              autoPlay
              className="max-h-[70vh] max-w-full rounded-2xl shadow-2xl"
            />
          </div>
          {/* Footer */}
          <div
            className="bg-zinc-900/80 backdrop-blur border-t border-zinc-800 px-5 py-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-4">
              {playingSkillVideo.description && (
                <p className="text-zinc-300 text-sm flex-1 truncate">
                  {playingSkillVideo.description}
                </p>
              )}
              <div className="flex items-center gap-1.5 text-zinc-400 text-sm ml-auto">
                <Eye className="h-4 w-4" />
                <span>{playingSkillVideo.view_count.toLocaleString()} views</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <BookingSheet a={artisanForBooking} open={open} onClose={() => setOpen(false)} />
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      {/* Sprint 4: Instant Book Modal */}
      {previousInfo && (
        <InstantBookModal
          artisan={artisan}
          previousInfo={previousInfo}
          open={instantBookOpen}
          onClose={() => setInstantBookOpen(false)}
          onSuccess={(result) => {
            setInstantBookResult(result);
            // Keep modal open to show success state
          }}
        />
      )}
    </div>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
}) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1.5">
        {icon}
        <div className="text-2xl font-extrabold leading-none">{value}</div>
      </div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
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
