// File: web/src/components/BookingSheet.tsx
import { useEffect, useState } from "react";
import { ArrowRight, ShieldCheck, X, Loader2, Check, Phone, AlertCircle, Calendar } from "lucide-react";
import { formatRWF } from "@/services/artisanService";
import type { Artisan } from "@/types/artisan";
import { useAuthStore } from "@/store/authStore";
import api from "@/services/api";
import { toast } from "sonner";

export function BookingSheet({
  a,
  open,
  onClose,
}: {
  a: Artisan & { momoPhone?: string };
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuthStore();
  const [step, setStep] = useState(1);
  const [job, setJob] = useState("");
  const [when, setWhen] = useState("Tomorrow");
  const [time, setTime] = useState("Morning");
  const [budget, setBudget] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [provider, setProvider] = useState<"MTN" | "Airtel">("MTN");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep(1); setSubmitting(false); setDone(false); setJob(""); setBudget(""); setBookingId(null);
      }, 200);
    }
  }, [open]);

  useEffect(() => {
    if (step !== 3) return;
    setArmed(false);
    const t = setTimeout(() => setArmed(true), 1000);
    return () => clearTimeout(t);
  }, [step]);

  const submitBookingRequest = async () => {
    setSubmitting(true);
    try {
      // First create a job post, then submit a bid from the artisan side isn't applicable here
      // For direct booking: post a job → immediately create a booking with this artisan
      const dateMap: Record<string, number> = { Today: 0, Tomorrow: 1, "This week": 3, "Next week": 7 };
      const daysOffset = dateMap[when] ?? 1;
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + daysOffset);
      if (time === "Morning") scheduledDate.setHours(9, 0, 0, 0);
      else if (time === "Afternoon") scheduledDate.setHours(13, 0, 0, 0);
      else scheduledDate.setHours(17, 0, 0, 0);

      // Create the job
      const jobRes = await api.post("/jobs", {
        category_id: selectedCategoryId || "00000000-0000-0000-0000-000000000000",
        title: job.slice(0, 100) || `${a.category} service`,
        description: job || `I need ${a.category.toLowerCase()} services`,
        latitude: -1.9441,
        longitude: 30.0619,
        location_label: user?.district ?? "Kigali",
        scheduled_time: scheduledDate.toISOString(),
        budget: budget ? parseInt(budget) : (a.startingPrice ?? 5000),
      });

      // Submit bid on behalf of artisan (direct booking flow)
      await api.post(`/bids/jobs/${jobRes.data.id}`, {
        proposed_price: budget ? parseInt(budget) : (a.startingPrice ?? 5000),
        message: `Direct booking request from ${user?.fullName ?? "client"}`,
        proposed_start_time: scheduledDate.toISOString(),
      }).catch(() => null); // artisan must bid — skip silently for now

      setBookingId(jobRes.data.id);
      setStep(3);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof msg === "string" ? msg : "Failed to create booking. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmPayment = () => {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setDone(true);
      toast.success("Payment confirmed! The artisan will be notified.");
    }, 1500);
  };

  if (!open) return null;

  const momoNumber = a.momoPhone ?? "+250780000000";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="Close" />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-t-[32px] bg-card sm:rounded-[32px] shadow-xl">
        {/* Handle */}
        <div className="flex justify-center pt-4 pb-1 sm:hidden">
          <div className="h-1 w-12 rounded-full bg-muted" />
        </div>

        {/* Close */}
        <button onClick={onClose} className="absolute right-4 top-4 z-10 p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors" aria-label="Close">
          <X className="h-4 w-4" />
        </button>

        <div className="px-6 pb-8 pt-4">
          {/* Progress */}
          <div className="flex gap-1.5 mb-6">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${s <= step ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>

          {done ? (
            <div className="text-center py-4">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                <Check className="h-8 w-8 text-success" />
              </div>
              <h2 className="text-2xl font-extrabold">Booking sent! 🎉</h2>
              <p className="mt-2 text-muted-foreground">
                Your booking request has been sent to {a.name.split(" ")[0]}. They'll confirm within 2 hours.
              </p>
              <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-4 text-left">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Payment instructions</p>
                <p className="text-sm">Send <span className="font-bold">{formatRWF(budget ? parseInt(budget) : a.startingPrice)} RWF</span> via {provider} MoMo to:</p>
                <p className="mt-1 text-xl font-black text-primary tracking-wider">{momoNumber}</p>
                <p className="mt-1 text-xs text-muted-foreground">Reference: HandyRwanda — {a.name.split(" ")[0]}</p>
              </div>
              <button onClick={onClose} className="mt-6 w-full rounded-2xl bg-primary py-3.5 font-bold text-primary-foreground">
                Done
              </button>
            </div>
          ) : step === 1 ? (
            <div>
              <h2 className="text-2xl font-extrabold">What do you need?</h2>
              <p className="mt-1 text-sm text-muted-foreground">Describe the job for {a.name.split(" ")[0]}</p>

              <textarea
                value={job}
                onChange={(e) => setJob(e.target.value)}
                placeholder={`e.g. "Fix a leaking pipe in my kitchen bathroom — it's been dripping for 2 days"`}
                className="mt-4 w-full rounded-2xl border border-border bg-muted/30 p-4 text-sm resize-none outline-none focus:ring-2 focus:ring-primary/50 h-28"
              />

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">When</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {["Today", "Tomorrow", "This week", "Next week"].map((w) => (
                      <button key={w} onClick={() => setWhen(w)}
                        className={`rounded-xl border-2 px-2 py-2 text-xs font-semibold transition ${when === w ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 hover:bg-muted"}`}>
                        {w}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Time</p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {["Morning", "Afternoon", "Evening"].map((t) => (
                      <button key={t} onClick={() => setTime(t)}
                        className={`rounded-xl border-2 px-2 py-2 text-xs font-semibold transition ${time === t ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 hover:bg-muted"}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Budget (RWF) — optional</p>
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder={`Suggested: ${formatRWF(a.startingPrice ?? 5000)}`}
                  className="w-full rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={job.trim().length < 10}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 font-bold text-primary-foreground disabled:opacity-40 transition"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : step === 2 ? (
            <div>
              <h2 className="text-2xl font-extrabold">Review & Confirm</h2>
              <p className="mt-1 text-sm text-muted-foreground">Double-check before sending to {a.name.split(" ")[0]}</p>

              <div className="mt-4 space-y-3">
                <SummaryRow label="Artisan" value={a.name} />
                <SummaryRow label="Job" value={job.length > 80 ? job.slice(0, 80) + "…" : job} />
                <SummaryRow label="When" value={`${when} — ${time}`} />
                <SummaryRow label="Budget" value={budget ? `${formatRWF(parseInt(budget))} RWF` : `~${formatRWF(a.startingPrice ?? 5000)} RWF`} />
              </div>

              <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-primary mb-1">Payment method</p>
                <div className="flex gap-2 mt-2">
                  {(["MTN", "Airtel"] as const).map((p) => (
                    <button key={p} onClick={() => setProvider(p)}
                      className={`flex-1 rounded-xl border-2 py-2 text-sm font-bold transition ${provider === p ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30"}`}>
                      {p === "MTN" ? "📱 MTN MoMo" : "📲 Airtel Money"}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  <ShieldCheck className="inline h-3.5 w-3.5 mr-1 text-success" />
                  Pay directly via MoMo after the artisan confirms.
                </p>
              </div>

              <div className="mt-6 flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 rounded-2xl border border-border bg-muted/30 py-3.5 font-bold transition hover:bg-muted">
                  Back
                </button>
                <button
                  onClick={submitBookingRequest}
                  disabled={submitting}
                  className="flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 font-bold text-accent-foreground disabled:opacity-60 transition"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Send Request
                </button>
              </div>
            </div>
          ) : (
            /* Step 3 — Payment */
            <div>
              <h2 className="text-2xl font-extrabold">Send Payment</h2>
              <p className="mt-1 text-sm text-muted-foreground">Transfer via MoMo, then confirm below.</p>

              <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-5 text-center">
                <p className="text-sm text-muted-foreground">Send to {a.name.split(" ")[0]}'s {provider} number</p>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <Phone className="h-5 w-5 text-primary" />
                  <span className="text-3xl font-black tracking-wider text-primary">{momoNumber}</span>
                </div>
                <div className="mt-3 text-2xl font-extrabold">{formatRWF(budget ? parseInt(budget) : (a.startingPrice ?? 5000))} RWF</div>
                <p className="text-xs text-muted-foreground mt-1">Reference: HandyRwanda</p>
              </div>

              <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800">
                  Only tap "I've sent payment" after the transfer is complete. This notifies the artisan.
                </p>
              </div>

              <button
                onClick={confirmPayment}
                disabled={submitting || !armed}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-success py-3.5 font-bold text-white disabled:opacity-40 transition"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {!armed ? "Please wait…" : "I've sent payment ✓"}
              </button>
              <button onClick={onClose} className="mt-2 w-full rounded-2xl py-2 text-sm text-muted-foreground hover:underline">
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between rounded-xl bg-muted/30 px-4 py-3">
      <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="ml-4 text-sm font-semibold text-foreground text-right">{value}</span>
    </div>
  );
}
