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
 *  - On confirm → booking moves to confirmed, client notified
 *  - On decline → booking cancelled, job reverts to open bidding
 *
 * Client view:
 *  - Full booking status tracker
 *  - If instant booking was confirmed → shows confirmation with price
 *  - If instant booking expired/declined → shows open job link
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import {
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  DollarSign,
  User,
  Zap,
  Loader2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Timer,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/services/api";
import { useAuthStore, type User } from "@/store/authStore";
import { formatDistanceToNow, formatDistance } from "date-fns";

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
        className={`flex items-center justify-center gap-2 mb-2 text-sm font-semibold ${
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
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
        Booking Progress
      </p>
      <div className="relative">
        {/* Track line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border -translate-x-0.5" />

        <div className="space-y-5">
          {STATUS_STEPS.map((step, idx) => {
            const done = idx < currentIdx;
            const active = idx === currentIdx;
            const meta = STATUS_META[step];
            return (
              <div key={step} className="flex items-start gap-4 relative">
                <div
                  className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm border-2 transition-colors ${
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
                    <span className="h-2 w-2 rounded-full bg-border block" />
                  )}
                </div>
                <div className={`pt-1 ${active ? "" : done ? "" : "opacity-40"}`}>
                  <p
                    className={`text-sm font-bold ${
                      active ? meta.color : done ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {meta.label}
                    {active && (
                      <span className="ml-2 inline-flex h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                    )}
                  </p>
                  {active && (
                    <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
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

// ── Main page ──────────────────────────────────────────────────────────────

function BookingDetailPage() {
  const { bookingId } = Route.useParams();
  const { user, isAuthenticated } = useAuthStore();
  const qc = useQueryClient();
  const navigate = useNavigate();

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
      qc.invalidateQueries({ queryKey: ["artisan-active-bookings"] });
      toast.success("✅ Booking confirmed! The client has been notified.");
      refetch();
    },
    onError: (err: unknown) => {
      const apiErr = err as { response?: { data?: { detail?: string } } };
      toast.error(apiErr?.response?.data?.detail ?? "Failed to confirm booking.");
    },
  });

  // ── Decline mutation ─────────────────────────────────────────────────────
  const declineMutation = useMutation({
    mutationFn: () => api.post(`/bookings/${bookingId}/instant-decline`).then((r) => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["booking-detail", bookingId] });
      qc.invalidateQueries({ queryKey: ["instant-booking-requests"] });
      toast.info("Booking declined. The job has been opened for bids.");
      // Navigate artisan back to job feed after decline
      setTimeout(() => navigate({ to: "/artisans/jobs" }), 1500);
    },
    onError: (err: unknown) => {
      const apiErr = err as { response?: { data?: { detail?: string } } };
      toast.error(apiErr?.response?.data?.detail ?? "Failed to decline booking.");
    },
  });

  const isBusy = confirmMutation.isPending || declineMutation.isPending;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-dvh">
        <Header />
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <p className="font-semibold text-lg">Please log in to view this booking.</p>
          <Link to="/auth" className="text-primary font-bold hover:underline">
            Log In →
          </Link>
        </div>
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
            This booking may have expired, been cancelled, or you may not have permission to view
            it.
          </p>
          <Link
            to={isArtisan ? "/artisans/jobs" : "/jobs/mine"}
            className="text-primary font-semibold hover:underline"
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
    ? new Intl.NumberFormat("rw-RW").format(booking.agreed_price) + " RWF"
    : null;

  return (
    <div className="min-h-dvh bg-muted/30 pb-24">
      <Header />

      <main className="mx-auto max-w-2xl px-4 pt-8 space-y-5">
        {/* ── Page title ───────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {isInstantBooking && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                  <Zap className="h-3 w-3" /> Instant Booking
                </span>
              )}
            </div>
            <h1 className="text-2xl font-extrabold text-foreground">
              {booking.title ?? "Booking"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Created{" "}
              {booking.created_at
                ? formatDistanceToNow(new Date(booking.created_at), { addSuffix: true })
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

        {/* ── Sprint 4: Countdown (artisan view only, pending_payment) ──── */}
        {isArtisanPendingAction && booking.created_at && (
          <Countdown createdAt={booking.created_at} />
        )}

        {/* ── Parties ──────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
            {isArtisan ? "Client" : "Artisan"}
          </p>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 overflow-hidden">
              {isArtisan ? (
                booking.client_avatar ? (
                  <img src={booking.client_avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-7 w-7 text-primary" />
                )
              ) : booking.artisan_avatar ? (
                <img src={booking.artisan_avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <User className="h-7 w-7 text-primary" />
              )}
            </div>
            <div>
              <p className="font-extrabold text-foreground text-lg">
                {isArtisan
                  ? (booking.client_name ?? "Client")
                  : (booking.artisan_name ?? "Artisan")}
              </p>
              {isInstantBooking && (
                <p className="text-xs text-primary font-semibold mt-0.5">
                  Previously worked together ✓
                </p>
              )}
              {(booking.client_district || booking.artisan_district) && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <MapPin className="h-3 w-3" />
                  {isArtisan ? booking.client_district : booking.artisan_district}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Job details ──────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Job Details
          </p>

          <p className="text-foreground leading-relaxed">
            {booking.description ?? "No description provided."}
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2 border-t border-border">
            {formattedPrice && (
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Agreed Price
                  </p>
                  <p className="font-extrabold text-primary text-base">{formattedPrice}</p>
                </div>
              </div>
            )}

            {booking.scheduled_time && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Scheduled
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {new Date(booking.scheduled_time).toLocaleString("en-RW", {
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

            {(booking.address_district || booking.location_label) && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Location
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {booking.location_label ?? booking.address_district}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Status stepper (client view + non-instant artisan) ───────── */}
        {!isArtisanPendingAction && <StatusStepper status={status} />}

        {/* ── Instant booking context card ─────────────────────────────── */}
        {isInstantBooking && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-primary" />
              <p className="text-sm font-extrabold text-primary">About Instant Booking</p>
            </div>
            <p className="text-sm text-foreground leading-relaxed">
              {isArtisan
                ? `This client has worked with you before and chose to skip the bidding process. Confirming means you commit to the agreed price of ${formattedPrice}.`
                : "You used Instant Booking to skip the bidding process based on your previous relationship with this artisan."}
            </p>
            {isArtisan && (
              <p className="text-xs text-muted-foreground mt-2">
                Declining will open the job for other artisans to bid on.
              </p>
            )}
          </div>
        )}

        {/* ── Cancelled / expired fallback (client) ───────────────────── */}
        {!isArtisan && status === "cancelled" && booking.job_id && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
            <p className="font-bold text-amber-800 mb-1">
              {booking.cancellation_reason?.includes("expired")
                ? "⚠️ Artisan Did Not Respond in Time"
                : "⚠️ Booking Cancelled"}
            </p>
            <p className="text-sm text-amber-700 mb-4">
              Your job has been opened for other artisans to submit bids.
            </p>
            <Link
              to="/jobs/$jobId/bids"
              params={{ jobId: booking.job_id }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 font-bold text-white hover:brightness-95 transition"
            >
              View Bids <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* ── Messages CTA ─────────────────────────────────────────────── */}
        {status !== "cancelled" && (
          <Link
            to="/messages"
            search={{ booking: bookingId }}
            className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 hover:bg-muted/30 transition group"
          >
            <div>
              <p className="font-semibold text-foreground">Open Chat</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Message {isArtisan ? "the client" : "your artisan"} about this booking
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        )}
      </main>

      {/* ── Sticky CTA footer (artisan, instant booking) ─────────────── */}
      {isArtisanPendingAction && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-md">
          <div className="mx-auto max-w-2xl flex gap-3 px-4 py-4">
            {/* Decline */}
            <button
              onClick={() => {
                if (window.confirm("Decline this booking? The job will be opened for bids.")) {
                  declineMutation.mutate();
                }
              }}
              disabled={isBusy}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 py-3.5 font-bold text-red-600 hover:bg-red-100 transition disabled:opacity-50"
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

            {/* Confirm */}
            <button
              onClick={() => confirmMutation.mutate()}
              disabled={isBusy}
              className="flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 font-extrabold text-white hover:brightness-95 transition shadow-md disabled:opacity-50"
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
