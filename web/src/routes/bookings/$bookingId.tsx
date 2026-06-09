// File: web/src/routes/bookings/$bookingId.tsx
/**
 * Sprint 4 — Booking Detail Page (Web)
 *
 * Serves both client and artisan views of a booking.
 *
 * Artisan view (instant booking pending_payment):
 *  - Full job description, client info, agreed price
 *  - 10-minute countdown timer
 *  - "Confirm ✅" and "Decline ✗" CTAs
 *
 * Client view:
 *  - Full booking status tracker
 *  - If instant booking declined/expired → link to open job bids
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  DollarSign,
  User as UserIcon,
  Zap,
  Loader2,
  AlertCircle,
  ArrowRight,
  Timer,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import type { User } from "@/store/authStore";
import { Header } from "@/components/Header";
import { AuthModal } from "@/components/AuthModal";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/bookings/$bookingId")({
  head: () => ({ meta: [{ title: "Booking — HandyRwanda" }] }),
  component: BookingDetailPage,
});

// ── Status config ──────────────────────────────────────────────────────────

const STATUS_STEPS = [
  "pending_payment",
  "confirmed",
  "artisan_accepted",
  "artisan_en_route",
  "arrived",
  "in_progress",
  "completed",
] as const;

type BookingStatus = (typeof STATUS_STEPS)[number] | "cancelled" | "disputed";

const STATUS_META: Record<
  string,
  { label: string; description: string; icon: string; color: string }
> = {
  pending_payment: {
    label: "Payment Due",
    description: "Awaiting payment to confirm booking",
    icon: "💰",
    color: "text-amber-600",
  },
  confirmed: {
    label: "Confirmed",
    description: "Booking confirmed, artisan preparing",
    icon: "✅",
    color: "text-blue-600",
  },
  artisan_accepted: {
    label: "Artisan Ready",
    description: "Artisan has accepted and is ready",
    icon: "🤝",
    color: "text-purple-600",
  },
  artisan_en_route: {
    label: "En Route",
    description: "Artisan is on the way to you",
    icon: "🚗",
    color: "text-orange-600",
  },
  arrived: {
    label: "Arrived",
    description: "Artisan has arrived at your location",
    icon: "📍",
    color: "text-emerald-600",
  },
  in_progress: {
    label: "In Progress",
    description: "Work is currently underway",
    icon: "🔧",
    color: "text-green-700",
  },
  completed: {
    label: "Completed",
    description: "Job successfully completed",
    icon: "🎉",
    color: "text-primary",
  },
  cancelled: {
    label: "Cancelled",
    description: "This booking was cancelled",
    icon: "❌",
    color: "text-muted-foreground",
  },
  disputed: {
    label: "Disputed",
    description: "This booking is under review",
    icon: "⚠️",
    color: "text-red-600",
  },
};

// ── Countdown ─────────────────────────────────────────────────────────────

function Countdown({ createdAt }: { createdAt: string }) {
  const expiresAt = new Date(new Date(createdAt).getTime() + 10 * 60 * 1000);

  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
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
  const urgent = !expired && secondsLeft <= 120;

  return (
    <div
      className={`rounded-2xl border p-5 text-center ${
        expired
          ? "border-border bg-muted/50"
          : urgent
            ? "border-red-200 bg-red-50"
            : "border-amber-200 bg-amber-50"
      }`}
    >
      <div
        className={`mb-2 flex items-center justify-center gap-2 text-sm font-semibold ${
          expired ? "text-muted-foreground" : urgent ? "text-red-600" : "text-amber-700"
        }`}
      >
        <Timer className="h-4 w-4" />
        {expired ? "Request Expired" : "Time Remaining to Respond"}
      </div>

      {!expired ? (
        <div
          className={`text-5xl font-extrabold tabular-nums tracking-widest ${
            urgent ? "text-red-600" : "text-amber-700"
          }`}
        >
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </div>
      ) : (
        <div className="text-3xl font-extrabold text-muted-foreground">00:00</div>
      )}

      <p
        className={`mt-2 text-xs ${
          expired ? "text-muted-foreground" : urgent ? "text-red-500" : "text-amber-600"
        }`}
      >
        {expired
          ? "This instant booking was automatically cancelled. The job has been opened for bids."
          : urgent
            ? "⚠️ Respond immediately or the request will expire!"
            : "The client is waiting. Confirm to secure this booking."}
      </p>
    </div>
  );
}

// ── Status stepper ─────────────────────────────────────────────────────────

function StatusStepper({ status }: { status: string }) {
  const currentIdx = STATUS_STEPS.indexOf(status as (typeof STATUS_STEPS)[number]);
  if (currentIdx === -1) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Booking Progress
      </p>
      <div className="relative">
        <div className="absolute bottom-0 left-4 top-0 w-0.5 -translate-x-0.5 bg-border" />
        <div className="space-y-5">
          {STATUS_STEPS.map((step, idx) => {
            const done = idx < currentIdx;
            const active = idx === currentIdx;
            const meta = STATUS_META[step];
            return (
              <div key={step} className="relative flex items-start gap-4">
                <div
                  className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm transition-colors ${
                    done
                      ? "border-primary bg-primary text-white"
                      : active
                        ? "border-primary bg-white text-primary"
                        : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : active ? (
                    <span>{meta.icon}</span>
                  ) : (
                    <span className="block h-2 w-2 rounded-full bg-border" />
                  )}
                </div>
                <div className={`pt-1 ${active || done ? "" : "opacity-40"}`}>
                  <p
                    className={`text-sm font-bold ${
                      active ? meta.color : done ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {meta.label}
                    {active && (
                      <span className="ml-2 inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                    )}
                  </p>
                  {active && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{meta.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── API error helper ────────────────────────────────────────────────────────

type ApiError = { response?: { data?: { detail?: string } } };

function getApiErrorMsg(err: unknown, fallback: string): string {
  const detail = (err as ApiError)?.response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
}

// ── Main page ──────────────────────────────────────────────────────────────

function BookingDetailPage() {
  const { bookingId } = Route.useParams();
  const { user, isAuthenticated } = useAuthStore();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const isArtisan = (user as User | null)?.role === "artisan";

  const {
    data: booking,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["booking-detail", bookingId],
    queryFn: () => api.get(`/bookings/${bookingId}`).then((r) => r.data),
    enabled: isAuthenticated && !!bookingId,
    refetchInterval: 20_000,
  });

  // ── Confirm mutation ─────────────────────────────────────────────────────
  const confirmMutation = useMutation({
    mutationFn: () => api.post(`/bookings/${bookingId}/instant-confirm`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking-detail", bookingId] });
      qc.invalidateQueries({ queryKey: ["instant-booking-requests"] });
      toast.success("✅ Booking confirmed! The client has been notified.");
      void refetch();
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMsg(err, "Failed to confirm booking."));
    },
  });

  // ── Decline mutation ─────────────────────────────────────────────────────
  const declineMutation = useMutation({
    mutationFn: () => api.post(`/bookings/${bookingId}/instant-decline`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking-detail", bookingId] });
      qc.invalidateQueries({ queryKey: ["instant-booking-requests"] });
      toast.info("Booking declined. The job has been opened for bids.");
      setTimeout(() => void navigate({ to: "/artisans/jobs" }), 1500);
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMsg(err, "Failed to decline booking."));
    },
  });

  const isBusy = confirmMutation.isPending || declineMutation.isPending;

  // ── Unauthenticated guard ────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-dvh">
        <Header />
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-semibold">Please log in to view this booking.</p>
          <button
            onClick={() => setAuthModalOpen(true)}
            className="font-bold text-primary hover:underline"
          >
            Log In →
          </button>
        </div>
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      </div>
    );
  }

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

  if (isError || !booking) {
    return (
      <div className="min-h-dvh">
        <Header />
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Booking not found</h1>
          <p className="text-muted-foreground">
            This booking may have expired or you may not have permission to view it.
          </p>
          <Link
            to={isArtisan ? "/artisans/jobs" : "/jobs/mine"}
            className="font-semibold text-primary hover:underline"
          >
            ← Back to {isArtisan ? "Job Feed" : "My Jobs"}
          </Link>
        </div>
      </div>
    );
  }

  const isInstantBooking = booking.status === "pending_payment";
  const isArtisanPendingAction = isArtisan && isInstantBooking;
  const status = booking.status as BookingStatus;
  const statusMeta = STATUS_META[status] ?? STATUS_META.confirmed;

  const formattedPrice = booking.agreed_price
    ? new Intl.NumberFormat("rw-RW").format(booking.agreed_price as number) + " RWF"
    : null;

  return (
    <div className="min-h-dvh bg-muted/30 pb-24">
      <Header />

      <main className="mx-auto max-w-2xl space-y-5 px-4 pt-8">
        {/* ── Title ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3">
          <div>
            {isInstantBooking && (
              <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                <Zap className="h-3 w-3" /> Instant Booking
              </span>
            )}
            <h1 className="text-2xl font-extrabold text-foreground">
              {(booking.title as string | undefined) ?? "Booking"}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {booking.created_at
                ? `Created ${formatDistanceToNow(new Date(booking.created_at as string), { addSuffix: true })}`
                : ""}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
              status === "completed"
                ? "border-primary/20 bg-primary/10 text-primary"
                : status === "cancelled"
                  ? "border-border bg-muted text-muted-foreground"
                  : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {statusMeta.icon} {statusMeta.label}
          </span>
        </div>

        {/* ── Countdown (artisan + instant booking) ──────────────────────── */}
        {isArtisanPendingAction && booking.created_at && (
          <Countdown createdAt={booking.created_at as string} />
        )}

        {/* ── Parties ────────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {isArtisan ? "Client" : "Artisan"}
          </p>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/10">
              {isArtisan ? (
                booking.client_avatar ? (
                  <img
                    src={booking.client_avatar as string}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserIcon className="h-7 w-7 text-primary" />
                )
              ) : booking.artisan_avatar ? (
                <img
                  src={booking.artisan_avatar as string}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserIcon className="h-7 w-7 text-primary" />
              )}
            </div>
            <div>
              <p className="text-lg font-extrabold text-foreground">
                {isArtisan
                  ? ((booking.client_name as string | undefined) ?? "Client")
                  : ((booking.artisan_name as string | undefined) ?? "Artisan")}
              </p>
              {isInstantBooking && (
                <p className="mt-0.5 text-xs font-semibold text-primary">
                  Previously worked together ✓
                </p>
              )}
              {(booking.client_district ?? booking.artisan_district) && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {isArtisan
                    ? (booking.client_district as string | undefined)
                    : (booking.artisan_district as string | undefined)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Job details ────────────────────────────────────────────────── */}
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Job Details
          </p>
          <p className="leading-relaxed text-foreground">
            {(booking.description as string | undefined) ?? "No description provided."}
          </p>
          <div className="grid grid-cols-1 gap-3 border-t border-border pt-2 sm:grid-cols-2">
            {formattedPrice && (
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Agreed Price
                  </p>
                  <p className="text-base font-extrabold text-primary">{formattedPrice}</p>
                </div>
              </div>
            )}
            {booking.scheduled_time && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Scheduled
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {new Date(booking.scheduled_time as string).toLocaleString("en-RW", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            )}
            {(booking.address_district ?? booking.location_label) && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Location
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {(booking.location_label as string | undefined) ??
                      (booking.address_district as string | undefined)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Status stepper (non-pending views) ─────────────────────────── */}
        {!isArtisanPendingAction && <StatusStepper status={status} />}

        {/* ── Instant booking context ─────────────────────────────────────── */}
        {isInstantBooking && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <div className="mb-2 flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <p className="text-sm font-extrabold text-primary">About Instant Booking</p>
            </div>
            <p className="text-sm leading-relaxed text-foreground">
              {isArtisan
                ? `This client has worked with you before and chose to skip the bidding process. Confirming means you commit to the agreed price of ${formattedPrice ?? "the agreed amount"}.`
                : "You used Instant Booking to skip the bidding process based on your previous relationship with this artisan."}
            </p>
            {isArtisan && (
              <p className="mt-2 text-xs text-muted-foreground">
                Declining will open the job for other artisans to bid on.
              </p>
            )}
          </div>
        )}

        {/* ── Cancelled / expired fallback (client) ──────────────────────── */}
        {!isArtisan && status === "cancelled" && booking.job_id && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
            <p className="mb-1 font-bold text-amber-800">
              {typeof booking.cancellation_reason === "string" &&
              booking.cancellation_reason.includes("expired")
                ? "⚠️ Artisan Did Not Respond in Time"
                : "⚠️ Booking Cancelled"}
            </p>
            <p className="mb-4 text-sm text-amber-700">
              Your job has been opened for other artisans to submit bids.
            </p>
            <Link
              to="/jobs/$jobId/bids"
              params={{ jobId: booking.job_id as string }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 font-bold text-white transition hover:brightness-95"
            >
              View Bids <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* ── Messages CTA ────────────────────────────────────────────────── */}
        {status !== "cancelled" && (
          <Link
            to="/messages"
            search={{ booking: bookingId }}
            className="group flex items-center justify-between rounded-2xl border border-border bg-card p-4 transition hover:bg-muted/30"
          >
            <div>
              <p className="font-semibold text-foreground">Open Chat</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Message {isArtisan ? "the client" : "your artisan"} about this booking
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
          </Link>
        )}
      </main>

      {/* ── Sticky CTA footer (artisan instant booking) ─────────────────── */}
      {isArtisanPendingAction && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-2xl gap-3 px-4 py-4">
            <button
              onClick={() => {
                if (window.confirm("Decline this booking? The job will be opened for bids.")) {
                  declineMutation.mutate();
                }
              }}
              disabled={isBusy}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 py-3.5 font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
            >
              {declineMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <XCircle className="h-5 w-5" />
                  Decline
                </>
              )}
            </button>
            <button
              onClick={() => confirmMutation.mutate()}
              disabled={isBusy}
              className="flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 font-extrabold text-white shadow-md transition hover:brightness-95 disabled:opacity-50"
            >
              {confirmMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  Confirm — {formattedPrice}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
