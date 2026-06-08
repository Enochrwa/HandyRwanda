// File: web/src/routes/jobs/$jobId/bids.tsx
// Sprint 3.2 + 3.3 — Job Bid Detail & Price Guidance
// Route: /jobs/{jobId}/bids
// Shows all bids for a client's job with accept/decline actions, sort options,
// artisan details, and market price guidance.

import { useState, useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import {
  ChevronLeft,
  Star,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  MapPin,
  MessageSquare,
  Award,
  ShieldCheck,
  Hammer,
  RefreshCw,
  Calendar,
  Info,
  BarChart3,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import api from "@/services/api";
import { formatRWF } from "@/services/artisanService";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/jobs/$jobId/bids")({
  head: () => ({ meta: [{ title: "Job Bids — HandyRwanda" }] }),
  component: JobBids,
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface PriceGuidance {
  district?: string;
  min?: number;
  median?: number;
  max?: number;
  sample_size?: number;
  category_name?: string;
}

interface JobData {
  id: string;
  title: string;
  description: string;
  status?: string;
  urgency?: string;
  budget?: number;
  budget_negotiable?: boolean;
  location_label?: string;
  created_at?: string;
  scheduled_time?: string;
  bid_count?: number;
  category?: { id?: string; name_en: string; icon_emoji?: string };
  address?: {
    district?: string;
    province?: string;
    sector?: string;
  };
}

interface Bid {
  id: string;
  artisan_id: string;
  artisan_name?: string;
  artisan_avatar?: string;
  artisan_rating?: number;
  artisan_total_reviews?: number;
  artisan_verification_status?: string;
  artisan_experience_years?: number;
  artisan_district?: string;
  proposed_price: number;
  cover_letter?: string;
  message?: string;
  estimated_duration_hours?: number;
  proposed_start_time?: string;
  status?: string;
  created_at?: string;
}

type SortMode = "price_asc" | "price_desc" | "rating_desc" | "newest";

// ─── Helper: Verification badge ───────────────────────────────────────────────

function VerifBadge({ status }: { status?: string }) {
  if (!status || status === "unverified") return null;
  const config =
    status === "pro_verified"
      ? { label: "PRO", bg: "bg-purple-100 text-purple-700 border-purple-200" }
      : status === "id_verified"
        ? { label: "ID Verified", bg: "bg-blue-100 text-blue-700 border-blue-200" }
        : { label: "Verified", bg: "bg-green-100 text-green-700 border-green-200" };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${config.bg}`}>
      <ShieldCheck className="h-2.5 w-2.5" />
      {config.label}
    </span>
  );
}

// ─── Star Rating ─────────────────────────────────────────────────────────────

function StarRating({ rating, count }: { rating?: number; count?: number }) {
  if (!rating) return <span className="text-xs text-muted-foreground">No reviews yet</span>;
  return (
    <span className="flex items-center gap-1">
      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
      <span className="text-sm font-bold">{rating.toFixed(1)}</span>
      {count != null && <span className="text-xs text-muted-foreground">({count})</span>}
    </span>
  );
}

// ─── Price Guidance Banner ────────────────────────────────────────────────────

function PriceGuidanceBanner({ guidance, jobBudget }: { guidance?: PriceGuidance; jobBudget?: number }) {
  if (!guidance || !guidance.sample_size || guidance.sample_size === 0) return null;

  const min = guidance.min ?? 0;
  const max = guidance.max ?? 0;
  const median = guidance.median ?? 0;
  const range = max - min;

  // Bar visualization: budget position relative to min-max
  const budgetPct =
    jobBudget && range > 0
      ? Math.min(100, Math.max(0, ((jobBudget - min) / range) * 100))
      : null;
  const medianPct = range > 0 ? Math.min(100, Math.max(0, ((median - min) / range) * 100)) : 50;

  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-blue-50/50 p-5 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="h-4 w-4 text-primary" />
        <p className="text-sm font-bold text-primary">
          Market Rate in {guidance.district ?? "your area"}
          {guidance.category_name && ` · ${guidance.category_name}`}
        </p>
        <span className="ml-auto text-[10px] text-muted-foreground">{guidance.sample_size} recent jobs</span>
      </div>

      {/* Price range */}
      <div className="flex justify-between text-sm font-bold mb-2">
        <span className="text-muted-foreground">{formatRWF(min)} RWF</span>
        <span className="text-primary">{formatRWF(median)} RWF typical</span>
        <span className="text-muted-foreground">{formatRWF(max)} RWF</span>
      </div>

      {/* Range bar */}
      <div className="relative h-2 rounded-full bg-primary/10 overflow-visible mb-2">
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-green-400 to-primary opacity-30" />
        {/* Median marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-1 h-4 rounded-full bg-primary shadow-sm"
          style={{ left: `${medianPct}%` }}
          title={`Typical: ${formatRWF(median)} RWF`}
        />
        {/* Budget marker */}
        {budgetPct != null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-white shadow-sm"
            style={{ left: `${budgetPct}%` }}
            title={`Your budget: ${formatRWF(jobBudget!)} RWF`}
          />
        )}
      </div>

      <div className="flex items-center gap-4 text-[10px] text-muted-foreground mt-1">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-primary" /> Typical price
        </span>
        {budgetPct != null && (
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500" /> Your budget
          </span>
        )}
        <span className="ml-auto text-[10px]">Use this to evaluate bids fairly</span>
      </div>
    </div>
  );
}

// ─── Bid Card ─────────────────────────────────────────────────────────────────

function BidCard({
  bid,
  jobStatus,
  priceMin,
  priceMax,
  onAccept,
  onDecline,
  isAccepting,
  isDeclining,
}: {
  bid: Bid;
  jobStatus?: string;
  priceMin: number;
  priceMax: number;
  onAccept: (bid: Bid) => void;
  onDecline: (bid: Bid) => void;
  isAccepting: boolean;
  isDeclining: boolean;
}) {
  const accepted = bid.status === "accepted";
  const rejected = bid.status === "rejected";
  const canAct = jobStatus === "open" && !accepted && !rejected;
  const range = priceMax - priceMin;
  const pricePct = range > 0 ? Math.min(100, Math.max(0, ((bid.proposed_price - priceMin) / range) * 100)) : 50;
  const isCheapest = bid.proposed_price === priceMin;
  const isExpensive = bid.proposed_price === priceMax;

  return (
    <div
      className={`rounded-2xl border bg-card shadow-sm transition-all duration-200 overflow-hidden ${
        accepted
          ? "border-green-300 ring-2 ring-green-200"
          : rejected
            ? "border-border opacity-60"
            : "border-border hover:shadow-md hover:border-primary/30"
      }`}
    >
      {/* Accepted / Rejected banner */}
      {accepted && (
        <div className="flex items-center gap-2 bg-green-600 px-4 py-2 text-white text-xs font-bold">
          <CheckCircle2 className="h-3.5 w-3.5" /> Bid Accepted — Booking Created
        </div>
      )}
      {rejected && (
        <div className="flex items-center gap-2 bg-muted px-4 py-2 text-muted-foreground text-xs font-semibold">
          <XCircle className="h-3.5 w-3.5" /> Declined
        </div>
      )}

      <div className="p-5">
        {/* Artisan row */}
        <div className="flex items-start gap-3 mb-4">
          <Avatar className="h-12 w-12 rounded-xl shrink-0">
            <AvatarImage src={bid.artisan_avatar} alt={bid.artisan_name} />
            <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-bold text-lg">
              {bid.artisan_name?.charAt(0).toUpperCase() ?? "A"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                to="/artisan/$id"
                params={{ id: bid.artisan_id }}
                className="font-bold text-foreground hover:text-primary transition-colors"
              >
                {bid.artisan_name ?? "Artisan"}
              </Link>
              <VerifBadge status={bid.artisan_verification_status} />
              {isCheapest && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700 border border-green-200">
                  <TrendingDown className="h-2.5 w-2.5" /> Lowest Price
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <StarRating rating={bid.artisan_rating} count={bid.artisan_total_reviews} />
              {bid.artisan_district && (
                <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {bid.artisan_district}
                </span>
              )}
              {bid.artisan_experience_years && (
                <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                  <Award className="h-3 w-3" /> {bid.artisan_experience_years}yr exp.
                </span>
              )}
            </div>
          </div>
          {/* Price — prominent */}
          <div className="shrink-0 text-right">
            <p className="text-xl font-extrabold text-foreground">{formatRWF(bid.proposed_price)}</p>
            <p className="text-[10px] text-muted-foreground font-medium">RWF</p>
          </div>
        </div>

        {/* Price position bar */}
        {range > 0 && (
          <div className="mb-4">
            <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 rounded-full ${isCheapest ? "bg-green-500" : isExpensive ? "bg-red-400" : "bg-primary"}`}
                style={{ width: `${Math.max(4, pricePct)}%` }}
              />
            </div>
            <div className="flex justify-between mt-0.5 text-[10px] text-muted-foreground">
              <span>{formatRWF(priceMin)} RWF</span>
              <span>{formatRWF(priceMax)} RWF</span>
            </div>
          </div>
        )}

        {/* Details */}
        <div className="space-y-2 mb-4">
          {bid.estimated_duration_hours && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>Estimated duration: <strong className="text-foreground">{bid.estimated_duration_hours}h</strong></span>
            </div>
          )}
          {bid.proposed_start_time && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>
                Start:{" "}
                <strong className="text-foreground">
                  {new Date(bid.proposed_start_time).toLocaleDateString("en-RW", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </strong>
              </span>
            </div>
          )}
          {bid.message && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Hammer className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <p className="line-clamp-3 text-foreground/80">{bid.message}</p>
            </div>
          )}
          {bid.cover_letter && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <p className="italic line-clamp-2 text-foreground/70">"{bid.cover_letter}"</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-[10px] text-muted-foreground">
            {bid.created_at ? formatDistanceToNow(new Date(bid.created_at), { addSuffix: true }) : ""}
          </span>

          {canAct && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onDecline(bid)}
                disabled={isDeclining || isAccepting}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-40"
              >
                {isDeclining ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                Decline
              </button>
              <button
                onClick={() => onAccept(bid)}
                disabled={isAccepting || isDeclining}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground hover:brightness-95 transition disabled:opacity-40"
              >
                {isAccepting ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                Accept Bid
              </button>
            </div>
          )}

          {accepted && (
            <Link
              to="/messages"
              className="flex items-center gap-1.5 rounded-xl bg-green-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-green-700 transition"
            >
              <MessageSquare className="h-3 w-3" /> Open Chat
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

function JobBids() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAuthenticated } = useAuthStore();

  const [sortMode, setSortMode] = useState<SortMode>("price_asc");
  const [acceptTarget, setAcceptTarget] = useState<Bid | null>(null);
  const [declineTarget, setDeclineTarget] = useState<Bid | null>(null);

  // Fetch job + price guidance
  const {
    data: jobResp,
    isLoading: jobLoading,
    isError: jobError,
  } = useQuery({
    queryKey: ["job-detail-client", jobId],
    queryFn: () => api.get(`/jobs/${jobId}`).then((r) => r.data),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  // Fetch bids for this job
  const {
    data: bids = [],
    isLoading: bidsLoading,
    isError: bidsError,
    refetch: refetchBids,
    isFetching,
  } = useQuery<Bid[]>({
    queryKey: ["job-bids", jobId],
    queryFn: () => api.get(`/bids/jobs/${jobId}`).then((r) => r.data),
    enabled: isAuthenticated,
    staleTime: 20_000,
    retry: 2,
  });

  // Accept bid mutation
  const acceptMutation = useMutation({
    mutationFn: (bidId: string) => api.post(`/bids/${bidId}/accept`),
    onSuccess: (_, bidId) => {
      toast.success("Bid accepted! 🎉 The artisan has been notified and a booking was created.");
      qc.invalidateQueries({ queryKey: ["job-bids", jobId] });
      qc.invalidateQueries({ queryKey: ["my-jobs"] });
      qc.invalidateQueries({ queryKey: ["job-detail-client", jobId] });
      setAcceptTarget(null);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof msg === "string" ? msg : "Failed to accept bid. Please try again.");
      setAcceptTarget(null);
    },
  });

  // Decline bid mutation
  const declineMutation = useMutation({
    mutationFn: (bidId: string) => api.post(`/bids/${bidId}/reject`),
    onSuccess: () => {
      toast.info("Bid declined.");
      qc.invalidateQueries({ queryKey: ["job-bids", jobId] });
      setDeclineTarget(null);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof msg === "string" ? msg : "Failed to decline bid.");
      setDeclineTarget(null);
    },
  });

  const job: JobData | undefined = jobResp?.job ?? jobResp;
  const priceGuidance: PriceGuidance | undefined = jobResp?.price_guidance;

  // Sort bids
  const sortedBids = useMemo(() => {
    const arr = [...bids];
    if (sortMode === "price_asc") arr.sort((a, b) => a.proposed_price - b.proposed_price);
    else if (sortMode === "price_desc") arr.sort((a, b) => b.proposed_price - a.proposed_price);
    else if (sortMode === "rating_desc") arr.sort((a, b) => (b.artisan_rating ?? 0) - (a.artisan_rating ?? 0));
    else arr.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
    return arr;
  }, [bids, sortMode]);

  // Price extremes for bid bars
  const priceMin = useMemo(() => Math.min(...bids.map((b) => b.proposed_price)), [bids]);
  const priceMax = useMemo(() => Math.max(...bids.map((b) => b.proposed_price)), [bids]);

  const isLoading = jobLoading || bidsLoading;

  if (!isAuthenticated) {
    return (
      <div className="min-h-dvh bg-muted/30">
        <Header />
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <p className="text-muted-foreground">Please log in to view bids.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-muted/30 pb-16">
      <Header />
      <main className="mx-auto max-w-4xl px-4 pt-8 sm:pt-12">
        {/* Back nav */}
        <button
          onClick={() => navigate({ to: "/jobs/mine" })}
          className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Back to My Jobs
        </button>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Loading bids…</p>
          </div>
        ) : jobError || bidsError ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="font-bold">Failed to load bids</p>
            <button
              onClick={() => refetchBids()}
              className="rounded-xl border border-border bg-card px-4 py-2 text-sm hover:bg-muted transition"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Job summary header card */}
            <div className="rounded-2xl border border-border bg-card p-5 mb-6 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl shrink-0">
                  {job?.category?.icon_emoji ?? "🛠️"}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-extrabold text-foreground leading-tight line-clamp-2">
                    {job?.title ?? "Job"}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    {job?.category && (
                      <Badge variant="secondary" className="text-xs">
                        {job.category.name_en}
                      </Badge>
                    )}
                    {job?.status && (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                          job.status === "open"
                            ? "bg-blue-100 text-blue-700 border-blue-200"
                            : job.status === "in_progress"
                              ? "bg-amber-100 text-amber-700 border-amber-200"
                              : "bg-gray-100 text-gray-600 border-gray-200"
                        }`}
                      >
                        {job.status.replace("_", " ")}
                      </span>
                    )}
                    {job?.location_label && (
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {job.location_label}
                      </span>
                    )}
                    {job?.budget && (
                      <span className="text-xs font-semibold text-foreground">
                        Budget: {formatRWF(job.budget)} RWF
                        {job.budget_negotiable && (
                          <span className="font-normal text-muted-foreground"> (negotiable)</span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => refetchBids()}
                  disabled={isFetching}
                  className="rounded-xl border border-border bg-card p-2 text-muted-foreground hover:bg-muted transition disabled:opacity-40"
                  aria-label="Refresh bids"
                >
                  <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                </button>
              </div>

              {bids.length > 0 && (
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground border-t border-border pt-3">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span>
                    <strong className="text-foreground">{bids.length}</strong> bid{bids.length !== 1 ? "s" : ""} received
                  </span>
                  {bids.length > 1 && (
                    <span className="text-xs">
                      · Range:{" "}
                      <strong className="text-foreground">{formatRWF(priceMin)}</strong> –{" "}
                      <strong className="text-foreground">{formatRWF(priceMax)}</strong> RWF
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Price guidance */}
            <PriceGuidanceBanner guidance={priceGuidance} jobBudget={job?.budget} />

            {/* Sort controls */}
            {bids.length > 1 && (
              <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
                <span className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground font-medium">
                  <ArrowUpDown className="h-3.5 w-3.5" /> Sort:
                </span>
                {(
                  [
                    { key: "price_asc", label: "Cheapest First", icon: TrendingDown },
                    { key: "price_desc", label: "Highest First", icon: TrendingUp },
                    { key: "rating_desc", label: "Highest Rated", icon: Star },
                    { key: "newest", label: "Most Recent", icon: Clock },
                  ] as { key: SortMode; label: string; icon: React.ElementType }[]
                ).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setSortMode(key)}
                    className={`shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold border transition ${
                      sortMode === key
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border bg-card text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Bids list */}
            {sortedBids.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center text-3xl mx-auto mb-4">
                  📋
                </div>
                <h3 className="font-bold text-lg mb-2">No bids yet</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Verified artisans in your area will see this job and start bidding. Check back soon!
                </p>
                <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5" />
                  <span>Most jobs receive their first bid within 2 hours.</span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedBids.map((bid) => (
                  <BidCard
                    key={bid.id}
                    bid={bid}
                    jobStatus={job?.status}
                    priceMin={priceMin}
                    priceMax={priceMax}
                    onAccept={(b) => setAcceptTarget(b)}
                    onDecline={(b) => setDeclineTarget(b)}
                    isAccepting={acceptMutation.isPending && acceptMutation.variables === bid.id}
                    isDeclining={declineMutation.isPending && declineMutation.variables === bid.id}
                  />
                ))}
              </div>
            )}

            {/* Guidance footer */}
            {sortedBids.length > 0 && job?.status === "open" && (
              <div className="mt-6 flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-sm">
                <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Tips for choosing the right bid</p>
                  <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                    <li>✓ Check the artisan's profile and past reviews before accepting</li>
                    <li>✓ The lowest price isn't always the best — consider rating and experience</li>
                    <li>✓ Price guidance above shows the typical market rate for this service</li>
                    <li>✓ Payment is held securely until you confirm the job is done</li>
                  </ul>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Accept confirmation dialog */}
      <AlertDialog open={!!acceptTarget} onOpenChange={(open) => !open && setAcceptTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Accept this bid?</AlertDialogTitle>
            <AlertDialogDescription>
              You're accepting{" "}
              <strong>{acceptTarget?.artisan_name ?? "this artisan"}</strong>'s bid of{" "}
              <strong>{acceptTarget ? formatRWF(acceptTarget.proposed_price) : ""} RWF</strong>. A booking will be
              created and the artisan will be notified immediately. Other bids will be automatically
              declined.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => acceptTarget && acceptMutation.mutate(acceptTarget.id)}
              className="bg-primary text-primary-foreground hover:brightness-95"
            >
              {acceptMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Accept Bid"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Decline confirmation dialog */}
      <AlertDialog open={!!declineTarget} onOpenChange={(open) => !open && setDeclineTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline this bid?</AlertDialogTitle>
            <AlertDialogDescription>
              You're declining{" "}
              <strong>{declineTarget?.artisan_name ?? "this artisan"}</strong>'s bid. They will be notified.
              You can still accept other bids on this job.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => declineTarget && declineMutation.mutate(declineTarget.id)}
              className="bg-destructive text-destructive-foreground hover:brightness-95"
            >
              {declineMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Decline Bid"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
