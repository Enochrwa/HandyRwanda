// File: web/src/routes/jobs/$jobId/bids.tsx
// Sprint 11 — Price Negotiation / Counter-Offer Flow
// Route: /jobs/{jobId}/bids
// Full negotiation UX: counter-offers, artisan middle-ground proposals,
// negotiation timeline, round tracker, and all existing bid features.

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
  ArrowLeftRight,
  Minus,
  Plus,
  History,
  ChevronDown,
  ChevronUp,
  Zap,
  AlertTriangle,
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
  address?: { district?: string; province?: string; sector?: string };
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
  // Sprint 11: negotiation fields
  negotiation_round?: number;
  max_negotiation_rounds?: number;
  counter_price?: number;
  counter_message?: string;
  counter_at?: string;
  artisan_counter_price?: number;
  artisan_counter_message?: string;
  artisan_counter_at?: string;
  current_offer_price?: number;
  is_negotiable?: boolean;
}

interface NegotiationEvent {
  event_type: string;
  actor: string;
  role: "client" | "artisan";
  price: number;
  message?: string;
  timestamp: string;
  is_accepted: boolean;
}

interface NegotiationHistory {
  bid_id: string;
  job_id: string;
  job_title: string;
  status: string;
  negotiation_round: number;
  max_rounds: number;
  rounds_remaining: number;
  is_negotiation_active: boolean;
  timeline: NegotiationEvent[];
  summary: { original_ask: number; current_offer: number; savings: number };
}

type SortMode = "price_asc" | "price_desc" | "rating_desc" | "newest";

const MAX_ROUNDS = 3;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isNegotiationStatus(status?: string): boolean {
  return status === "countered_by_client" || status === "artisan_countered";
}

function isBidActive(status?: string): boolean {
  return (
    !status ||
    status === "pending" ||
    status === "countered_by_client" ||
    status === "artisan_countered"
  );
}

function getNegotiationStatusLabel(status?: string): { label: string; color: string } | null {
  switch (status) {
    case "countered_by_client":
      return { label: "⏳ Awaiting artisan response", color: "amber" };
    case "artisan_countered":
      return { label: "💬 Artisan proposed a price", color: "blue" };
    case "negotiation_expired":
      return { label: "⌛ Negotiation expired", color: "red" };
    default:
      return null;
  }
}

// ─── Verification badge ───────────────────────────────────────────────────────

function VerifBadge({ status }: { status?: string }) {
  if (!status || status === "unverified") return null;
  const config =
    status === "pro_verified"
      ? { label: "PRO", bg: "bg-purple-100 text-purple-700 border-purple-200" }
      : status === "id_verified"
        ? {
            label: "ID Verified",
            bg: "bg-blue-100 text-blue-700 border-blue-200",
          }
        : {
            label: "Verified",
            bg: "bg-green-100 text-green-700 border-green-200",
          };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${config.bg}`}
    >
      <ShieldCheck className="h-2.5 w-2.5" />
      {config.label}
    </span>
  );
}

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

function PriceGuidanceBanner({
  guidance,
  jobBudget,
}: {
  guidance?: PriceGuidance;
  jobBudget?: number;
}) {
  if (!guidance || !guidance.sample_size || guidance.sample_size === 0) return null;

  const min = guidance.min ?? 0;
  const max = guidance.max ?? 0;
  const median = guidance.median ?? 0;
  const range = max - min;

  const budgetPct =
    jobBudget && range > 0 ? Math.min(100, Math.max(0, ((jobBudget - min) / range) * 100)) : null;
  const medianPct = range > 0 ? Math.min(100, Math.max(0, ((median - min) / range) * 100)) : 50;

  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-blue-50/50 p-5 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="h-4 w-4 text-primary" />
        <p className="text-sm font-bold text-primary">
          Market Rate in {guidance.district ?? "your area"}
          {guidance.category_name && ` · ${guidance.category_name}`}
        </p>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {guidance.sample_size} recent jobs
        </span>
      </div>
      <div className="flex justify-between text-sm font-bold mb-2">
        <span className="text-muted-foreground">{formatRWF(min)} RWF</span>
        <span className="text-primary">{formatRWF(median)} RWF typical</span>
        <span className="text-muted-foreground">{formatRWF(max)} RWF</span>
      </div>
      <div className="relative h-2 rounded-full bg-primary/10 overflow-visible mb-2">
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-green-400 to-primary opacity-30" />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-1 h-4 rounded-full bg-primary shadow-sm"
          style={{ left: `${medianPct}%` }}
        />
        {budgetPct != null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-white shadow-sm"
            style={{ left: `${budgetPct}%` }}
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

// ─── Negotiation Round Indicator ──────────────────────────────────────────────

function RoundIndicator({ round, max }: { round: number; max: number }) {
  const remaining = max - round;
  const pct = (round / max) * 100;
  const color = remaining === 0 ? "bg-red-500" : remaining === 1 ? "bg-amber-500" : "bg-primary";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.max(pct, 8)}%` }}
        />
      </div>
      <span className="text-[10px] font-semibold text-muted-foreground shrink-0">
        Round {round}/{max}
      </span>
      {remaining === 1 && <span className="text-[10px] font-bold text-amber-600">Last round</span>}
      {remaining === 0 && <span className="text-[10px] font-bold text-red-600">Expired</span>}
    </div>
  );
}

// ─── Negotiation Timeline ────────────────────────────────────────────────────

function NegotiationTimeline({
  history,
  isLoading,
}: {
  history?: NegotiationHistory;
  isLoading: boolean;
}) {
  if (isLoading)
    return (
      <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading history…
      </div>
    );
  if (!history || history.timeline.length <= 1) return null;

  const savings = history.summary.savings;

  return (
    <div className="mt-4 rounded-xl bg-muted/40 border border-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <History className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-bold text-foreground">Negotiation History</span>
        {savings > 0 && (
          <span className="ml-auto text-[10px] font-bold text-green-600">
            -{formatRWF(savings)} RWF saved
          </span>
        )}
      </div>
      <div className="space-y-2">
        {history.timeline.map((event, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 text-xs ${
              event.is_accepted ? "opacity-100" : "opacity-80"
            }`}
          >
            <div
              className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold ${
                event.role === "client"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-orange-100 text-orange-700"
              }`}
            >
              {event.role === "client" ? "C" : "A"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="font-semibold text-foreground">{event.actor}</span>
                <span className="text-muted-foreground">
                  {event.event_type === "bid_submitted"
                    ? "submitted bid"
                    : event.event_type === "client_counter"
                      ? "countered with"
                      : "proposed"}
                </span>
                <span className="font-bold text-foreground">{formatRWF(event.price)} RWF</span>
                {event.is_accepted && (
                  <span className="text-[10px] font-bold text-green-600">✓ Agreed</span>
                )}
              </div>
              {event.message && (
                <p className="text-muted-foreground italic mt-0.5 line-clamp-2">
                  "{event.message}"
                </p>
              )}
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(event.timestamp), {
                  addSuffix: true,
                })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Counter-Offer Input ──────────────────────────────────────────────────────

function CounterOfferInput({
  bid,
  priceGuidance,
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  bid: Bid;
  priceGuidance?: PriceGuidance;
  onSubmit: (price: number, message: string) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const suggested = bid.artisan_counter_price
    ? Math.round((bid.proposed_price + (bid.artisan_counter_price ?? bid.proposed_price)) / 2)
    : Math.round(bid.proposed_price * 0.85);
  const [price, setPrice] = useState(suggested.toString());
  const [message, setMessage] = useState("");

  const parsed = parseInt(price, 10);
  const isValid = !isNaN(parsed) && parsed >= 500;
  const diff = isValid ? bid.proposed_price - parsed : 0;
  const diffPct = isValid ? Math.round((diff / bid.proposed_price) * 100) : 0;
  const medianPrice = priceGuidance?.median;

  return (
    <div className="mt-3 rounded-xl border-2 border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ArrowLeftRight className="h-4 w-4 text-primary" />
        <p className="text-sm font-bold text-primary">Make a Counter-Offer</p>
      </div>

      {/* Price input */}
      <div>
        <label className="block text-xs font-semibold text-foreground mb-1.5">
          Your offer (RWF)
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const v = parseInt(price, 10);
              if (!isNaN(v) && v > 500) setPrice(String(v - 500));
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card hover:bg-muted transition"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="flex-1 h-9 rounded-xl border border-input bg-background px-3 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
            min={500}
            step={500}
          />
          <button
            type="button"
            onClick={() => {
              const v = parseInt(price, 10);
              if (!isNaN(v)) setPrice(String(v + 500));
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card hover:bg-muted transition"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Price context */}
        {isValid && (
          <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
            {diff > 0 ? (
              <span className="text-green-600 font-semibold">
                {diffPct}% less than artisan's ask
              </span>
            ) : diff < 0 ? (
              <span className="text-red-500 font-semibold">
                {Math.abs(diffPct)}% more than artisan's ask
              </span>
            ) : (
              <span className="text-muted-foreground">Same as artisan's ask</span>
            )}
            {medianPrice && (
              <span className="text-muted-foreground">
                · Market typical: {formatRWF(medianPrice)} RWF
              </span>
            )}
          </div>
        )}
      </div>

      {/* Quick suggestions */}
      <div className="flex gap-1.5 flex-wrap">
        <span className="text-[10px] text-muted-foreground self-center">Quick:</span>
        {[0.9, 0.85, 0.8].map((pct) => {
          const v = Math.round(bid.proposed_price * pct);
          return (
            <button
              key={pct}
              type="button"
              onClick={() => setPrice(String(v))}
              className="rounded-lg border border-border bg-card px-2 py-1 text-[11px] font-semibold hover:bg-muted transition"
            >
              {formatRWF(v)} ({Math.round((1 - pct) * 100)}% off)
            </button>
          );
        })}
      </div>

      {/* Message */}
      <div>
        <label className="block text-xs font-semibold text-foreground mb-1.5">
          Note to artisan <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 300))}
          placeholder="Explain why you'd like this price…"
          rows={2}
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        />
        <span className="text-[10px] text-muted-foreground">{message.length}/300</span>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-border bg-card py-2 text-xs font-semibold text-muted-foreground hover:bg-muted transition"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => isValid && onSubmit(parsed, message)}
          disabled={!isValid || isSubmitting}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground hover:brightness-95 transition disabled:opacity-40"
        >
          {isSubmitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowLeftRight className="h-3.5 w-3.5" />
          )}
          Send Counter-Offer
        </button>
      </div>
    </div>
  );
}

// ─── Artisan Counter Banner (for client to respond to) ───────────────────────

function ArtisanCounterBanner({
  bid,
  onAccept,
  onReject,
  isAccepting,
  isRejecting,
}: {
  bid: Bid;
  onAccept: () => void;
  onReject: () => void;
  isAccepting: boolean;
  isRejecting: boolean;
}) {
  if (bid.status !== "artisan_countered" || !bid.artisan_counter_price) return null;

  const diff = bid.proposed_price - bid.artisan_counter_price;
  const isBetterThanOriginal = diff > 0;

  return (
    <div className="mt-3 rounded-xl border-2 border-blue-200 bg-blue-50 p-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
          <Zap className="h-4 w-4 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-blue-900">Artisan proposed a new price</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-extrabold text-blue-700">
              {formatRWF(bid.artisan_counter_price)}
            </span>
            <span className="text-sm text-blue-600 font-semibold">RWF</span>
            {isBetterThanOriginal && (
              <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                -{formatRWF(diff)} RWF vs original
              </span>
            )}
          </div>
          {bid.artisan_counter_message && (
            <p className="mt-1.5 text-xs text-blue-700 italic">"{bid.artisan_counter_message}"</p>
          )}
          {bid.artisan_counter_at && (
            <p className="text-[10px] text-blue-500 mt-1">
              {formatDistanceToNow(new Date(bid.artisan_counter_at), {
                addSuffix: true,
              })}
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={onReject}
          disabled={isRejecting || isAccepting}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-border bg-white py-2 text-xs font-semibold text-muted-foreground hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition disabled:opacity-40"
        >
          {isRejecting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <XCircle className="h-3.5 w-3.5" />
          )}
          Decline
        </button>
        <button
          onClick={onAccept}
          disabled={isAccepting || isRejecting}
          className="flex-[2] flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-700 transition disabled:opacity-40"
        >
          {isAccepting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          Accept {formatRWF(bid.artisan_counter_price)} RWF
        </button>
      </div>
    </div>
  );
}

// ─── Client Counter Pending Banner ───────────────────────────────────────────

function ClientCounterPendingBanner({ bid }: { bid: Bid }) {
  if (bid.status !== "countered_by_client" || !bid.counter_price) return null;
  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-xs font-bold text-amber-800">
          Counter-offer sent · Awaiting artisan response
        </p>
        <p className="text-xs text-amber-700 mt-0.5">
          You offered <strong className="font-bold">{formatRWF(bid.counter_price)} RWF</strong>
          {bid.counter_message && ` — "${bid.counter_message}"`}
        </p>
        {bid.counter_at && (
          <p className="text-[10px] text-amber-500 mt-0.5">
            Sent {formatDistanceToNow(new Date(bid.counter_at), { addSuffix: true })}
          </p>
        )}
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
  priceGuidance,
  onAccept,
  onDecline,
  onCounter,
  onCounterAccept,
  onCounterReject,
  isAccepting,
  isDeclining,
  isCountering,
  isCounterAccepting,
  isCounterRejecting,
}: {
  bid: Bid;
  jobStatus?: string;
  priceMin: number;
  priceMax: number;
  priceGuidance?: PriceGuidance;
  onAccept: (bid: Bid) => void;
  onDecline: (bid: Bid) => void;
  onCounter: (bid: Bid, price: number, message: string) => void;
  onCounterAccept: (bid: Bid) => void;
  onCounterReject: (bid: Bid) => void;
  isAccepting: boolean;
  isDeclining: boolean;
  isCountering: boolean;
  isCounterAccepting: boolean;
  isCounterRejecting: boolean;
}) {
  const [showCounterInput, setShowCounterInput] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const qc = useQueryClient();

  const accepted = bid.status === "accepted";
  const rejected = bid.status === "rejected";
  const expired = bid.status === "negotiation_expired";
  const inNegotiation = isNegotiationStatus(bid.status);
  const canAct =
    jobStatus === "open" &&
    !accepted &&
    !rejected &&
    !expired &&
    bid.status !== "countered_by_client";

  const range = priceMax - priceMin;
  const displayPrice = bid.current_offer_price ?? bid.proposed_price;
  const pricePct =
    range > 0 ? Math.min(100, Math.max(0, ((displayPrice - priceMin) / range) * 100)) : 50;
  const isCheapest = displayPrice === priceMin;
  const isExpensive = displayPrice === priceMax;
  const negotiationRound = bid.negotiation_round ?? 0;
  const maxRounds = bid.max_negotiation_rounds ?? MAX_ROUNDS;
  const hasNegotiationHistory = negotiationRound > 0;
  const negotiationStatusInfo = getNegotiationStatusLabel(bid.status);

  // Pre-fetch negotiation history when timeline is opened
  const { data: negotiationHistory, isLoading: historyLoading } = useQuery<NegotiationHistory>({
    queryKey: ["negotiation-history", bid.id],
    queryFn: () => api.get(`/bids/${bid.id}/negotiation-history`).then((r) => r.data),
    enabled: showTimeline && hasNegotiationHistory,
    staleTime: 10_000,
  });

  return (
    <div
      className={`rounded-2xl border bg-card shadow-sm transition-all duration-200 overflow-hidden ${
        accepted
          ? "border-green-300 ring-2 ring-green-200"
          : rejected || expired
            ? "border-border opacity-60"
            : inNegotiation
              ? "border-primary/40 ring-1 ring-primary/20"
              : "border-border hover:shadow-md hover:border-primary/30"
      }`}
    >
      {/* Status banners */}
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
      {expired && (
        <div className="flex items-center gap-2 bg-red-50 border-b border-red-100 px-4 py-2 text-red-600 text-xs font-semibold">
          <AlertCircle className="h-3.5 w-3.5" /> Negotiation Expired — Max rounds reached
        </div>
      )}
      {inNegotiation && negotiationStatusInfo && (
        <div
          className={`flex items-center gap-2 border-b px-4 py-2 text-xs font-semibold ${
            bid.status === "countered_by_client"
              ? "bg-amber-50 border-amber-100 text-amber-700"
              : "bg-blue-50 border-blue-100 text-blue-700"
          }`}
        >
          {negotiationStatusInfo.label}
          <span className="ml-auto text-[10px]">
            Round {negotiationRound}/{maxRounds}
          </span>
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
              {isCheapest && !inNegotiation && (
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
            <p className="text-xl font-extrabold text-foreground">{formatRWF(displayPrice)}</p>
            <p className="text-[10px] text-muted-foreground font-medium">RWF</p>
            {inNegotiation && displayPrice !== bid.proposed_price && (
              <p className="text-[10px] text-muted-foreground line-through">
                {formatRWF(bid.proposed_price)}
              </p>
            )}
          </div>
        </div>

        {/* Negotiation round bar */}
        {(hasNegotiationHistory || inNegotiation) && (
          <div className="mb-3">
            <RoundIndicator round={negotiationRound} max={maxRounds} />
          </div>
        )}

        {/* Price position bar */}
        {range > 0 && (
          <div className="mb-4">
            <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 rounded-full ${
                  isCheapest ? "bg-green-500" : isExpensive ? "bg-red-400" : "bg-primary"
                }`}
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
              <span>
                Estimated duration:{" "}
                <strong className="text-foreground">{bid.estimated_duration_hours}h</strong>
              </span>
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

        {/* ── Sprint 11: Negotiation UI ── */}

        {/* Client counter pending */}
        <ClientCounterPendingBanner bid={bid} />

        {/* Artisan proposed a middle-ground price */}
        <ArtisanCounterBanner
          bid={bid}
          onAccept={() => onCounterAccept(bid)}
          onReject={() => onCounterReject(bid)}
          isAccepting={isCounterAccepting}
          isRejecting={isCounterRejecting}
        />

        {/* Counter-offer input (when open) */}
        {showCounterInput && (
          <CounterOfferInput
            bid={bid}
            priceGuidance={priceGuidance}
            onSubmit={(price, msg) => {
              onCounter(bid, price, msg);
              setShowCounterInput(false);
            }}
            onCancel={() => setShowCounterInput(false)}
            isSubmitting={isCountering}
          />
        )}

        {/* Negotiation history toggle */}
        {hasNegotiationHistory && (
          <button
            onClick={() => setShowTimeline((p) => !p)}
            className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors"
          >
            <History className="h-3 w-3" />
            View negotiation history
            {showTimeline ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        )}

        {showTimeline && (
          <NegotiationTimeline history={negotiationHistory} isLoading={historyLoading} />
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border pt-3 mt-4">
          <span className="text-[10px] text-muted-foreground">
            {bid.created_at
              ? formatDistanceToNow(new Date(bid.created_at), {
                  addSuffix: true,
                })
              : ""}
          </span>

          {canAct && !showCounterInput && (
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <button
                onClick={() => onDecline(bid)}
                disabled={isDeclining || isAccepting}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-40"
              >
                {isDeclining ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <XCircle className="h-3 w-3" />
                )}
                Decline
              </button>
              {/* Counter-offer button */}
              {(bid.is_negotiable ?? true) && bid.status !== "countered_by_client" && (
                <button
                  onClick={() => setShowCounterInput(true)}
                  disabled={isDeclining || isAccepting}
                  className="flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition disabled:opacity-40"
                >
                  <ArrowLeftRight className="h-3 w-3" />
                  Counter
                </button>
              )}
              <button
                onClick={() => onAccept(bid)}
                disabled={isAccepting || isDeclining}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground hover:brightness-95 transition disabled:opacity-40"
              >
                {isAccepting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3 w-3" />
                )}
                Accept
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
    staleTime: 15_000,
    retry: 2,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const acceptMutation = useMutation({
    mutationFn: (bidId: string) => api.post(`/bids/${bidId}/accept`),
    onSuccess: () => {
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

  // Sprint 11: Counter-offer mutations
  const counterMutation = useMutation({
    mutationFn: ({
      bidId,
      counter_price,
      counter_message,
    }: {
      bidId: string;
      counter_price: number;
      counter_message?: string;
    }) => api.post(`/bids/${bidId}/counter`, { counter_price, counter_message }),
    onSuccess: (_, vars) => {
      toast.success("Counter-offer sent! 💬 The artisan will be notified.");
      qc.invalidateQueries({ queryKey: ["job-bids", jobId] });
      qc.invalidateQueries({
        queryKey: ["negotiation-history", vars.bidId],
      });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof msg === "string" ? msg : "Counter-offer failed.");
    },
  });

  const counterAcceptMutation = useMutation({
    mutationFn: (bidId: string) => api.post(`/bids/${bidId}/artisan-counter-accept`),
    onSuccess: () => {
      toast.success("Deal agreed! 🎉 Booking created at the negotiated price.");
      qc.invalidateQueries({ queryKey: ["job-bids", jobId] });
      qc.invalidateQueries({ queryKey: ["my-jobs"] });
      qc.invalidateQueries({ queryKey: ["job-detail-client", jobId] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof msg === "string" ? msg : "Failed to accept counter.");
    },
  });

  const counterRejectMutation = useMutation({
    mutationFn: (bidId: string) => api.post(`/bids/${bidId}/artisan-counter-reject`),
    onSuccess: () => {
      toast.info("Counter-offer declined.");
      qc.invalidateQueries({ queryKey: ["job-bids", jobId] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof msg === "string" ? msg : "Failed to reject counter.");
    },
  });

  // ── Data ───────────────────────────────────────────────────────────────────

  const job: JobData | undefined = jobResp?.job ?? jobResp;
  const priceGuidance: PriceGuidance | undefined = jobResp?.price_guidance;

  const sortedBids = useMemo(() => {
    const arr = [...bids];
    const effectivePrice = (b: Bid) => b.current_offer_price ?? b.proposed_price;
    if (sortMode === "price_asc") arr.sort((a, b) => effectivePrice(a) - effectivePrice(b));
    else if (sortMode === "price_desc") arr.sort((a, b) => effectivePrice(b) - effectivePrice(a));
    else if (sortMode === "rating_desc")
      arr.sort((a, b) => (b.artisan_rating ?? 0) - (a.artisan_rating ?? 0));
    else
      arr.sort(
        (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
      );
    return arr;
  }, [bids, sortMode]);

  const priceMin = useMemo(
    () => Math.min(...bids.map((b) => b.current_offer_price ?? b.proposed_price)),
    [bids],
  );
  const priceMax = useMemo(
    () => Math.max(...bids.map((b) => b.current_offer_price ?? b.proposed_price)),
    [bids],
  );

  // Count negotiation-active bids for indicator
  const negotiatingCount = bids.filter((b) => isNegotiationStatus(b.status)).length;

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
                <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground border-t border-border pt-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span>
                      <strong className="text-foreground">{bids.length}</strong> bid
                      {bids.length !== 1 ? "s" : ""} received
                    </span>
                  </div>
                  {bids.length > 1 && (
                    <span className="text-xs">
                      · Range: <strong className="text-foreground">{formatRWF(priceMin)}</strong> –{" "}
                      <strong className="text-foreground">{formatRWF(priceMax)}</strong> RWF
                    </span>
                  )}
                  {/* Sprint 11: negotiation indicator */}
                  {negotiatingCount > 0 && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      <ArrowLeftRight className="h-3 w-3" />
                      {negotiatingCount} in negotiation
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
                    {
                      key: "price_asc",
                      label: "Cheapest First",
                      icon: TrendingDown,
                    },
                    {
                      key: "price_desc",
                      label: "Highest First",
                      icon: TrendingUp,
                    },
                    {
                      key: "rating_desc",
                      label: "Highest Rated",
                      icon: Star,
                    },
                    { key: "newest", label: "Most Recent", icon: Clock },
                  ] as {
                    key: SortMode;
                    label: string;
                    icon: React.ElementType;
                  }[]
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
                  Verified artisans in your area will see this job and start bidding. Check back
                  soon!
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
                    priceGuidance={priceGuidance}
                    onAccept={(b) => setAcceptTarget(b)}
                    onDecline={(b) => setDeclineTarget(b)}
                    onCounter={(b, price, msg) =>
                      counterMutation.mutate({
                        bidId: b.id,
                        counter_price: price,
                        counter_message: msg || undefined,
                      })
                    }
                    onCounterAccept={(b) => counterAcceptMutation.mutate(b.id)}
                    onCounterReject={(b) => counterRejectMutation.mutate(b.id)}
                    isAccepting={acceptMutation.isPending && acceptMutation.variables === bid.id}
                    isDeclining={declineMutation.isPending && declineMutation.variables === bid.id}
                    isCountering={
                      counterMutation.isPending && counterMutation.variables?.bidId === bid.id
                    }
                    isCounterAccepting={
                      counterAcceptMutation.isPending && counterAcceptMutation.variables === bid.id
                    }
                    isCounterRejecting={
                      counterRejectMutation.isPending && counterRejectMutation.variables === bid.id
                    }
                  />
                ))}
              </div>
            )}

            {/* Sprint 11: Negotiation tips */}
            {sortedBids.length > 0 && job?.status === "open" && (
              <div className="mt-6 space-y-3">
                <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
                  <ArrowLeftRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-primary">
                      💡 Price Negotiation is now on HandyRwanda
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      You can now negotiate prices directly in the app — no more WhatsApp
                      back-and-forth. Use the <strong>Counter</strong> button to propose a different
                      price. Up to 3 rounds of negotiation per bid.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-sm">
                  <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Tips for the best deal</p>
                    <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                      <li>✓ Check the artisan's profile and reviews before accepting</li>
                      <li>✓ Counter-offers keep both parties accountable and on-platform</li>
                      <li>✓ Price guidance above shows the typical market rate</li>
                      <li>✓ Payment is held securely until you confirm job completion</li>
                    </ul>
                  </div>
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
              You're accepting <strong>{acceptTarget?.artisan_name ?? "this artisan"}</strong>'s bid
              of{" "}
              <strong>
                {acceptTarget
                  ? formatRWF(acceptTarget.current_offer_price ?? acceptTarget.proposed_price)
                  : ""}{" "}
                RWF
              </strong>
              . A booking will be created and the artisan will be notified immediately. Other bids
              will be automatically declined.
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
              You're declining <strong>{declineTarget?.artisan_name ?? "this artisan"}</strong>
              's bid. They will be notified. You can still accept other bids on this job.
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
