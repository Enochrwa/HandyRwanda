// File: web/src/components/BookingSheet.tsx
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ShieldCheck,
  X,
  Loader2,
  Check,
  Phone,
  AlertCircle,
  Calendar,
  Clock,
  DollarSign,
} from "lucide-react";
import { formatRWF } from "@/services/artisanService";
import type { Artisan } from "@/types/artisan";
import { useAuthStore } from "@/store/authStore";
import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import { toast } from "sonner";

interface Category { id: string; name_en: string; icon_emoji?: string }

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
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const [urgency, setUrgency] = useState("flexible");
  const [budget, setBudget] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [provider, setProvider] = useState<"MTN" | "Airtel">("MTN");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => api.get("/artisans/categories").then((r) => r.data),
    enabled: open,
  });

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep(1); setSubmitting(false); setDone(false);
        setJob(""); setBudget(""); setBookingId(null);
        setSelectedCategoryId(""); setScheduledDate("");
        setAdditionalNotes(""); setUrgency("flexible");
      }, 200);
    }
  }, [open]);

  useEffect(() => {
    if (step !== 3) return;
    setArmed(false);
    const t = setTimeout(() => setArmed(true), 1500);
    return () => clearTimeout(t);
  }, [step]);

  const submitBookingRequest = async () => {
    if (!job.trim() || job.length < 10) {
      toast.error("Please describe the job in more detail (at least 10 characters).");
      return;
    }
    setSubmitting(true);
    try {
      let scheduledISO: string | undefined;
      if (scheduledDate) {
        scheduledISO = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();
      } else {
        const d = new Date();
        d.setDate(d.getDate() + (urgency === "today" ? 0 : urgency === "tomorrow" ? 1 : urgency === "this_week" ? 3 : 7));
        d.setHours(9, 0, 0, 0);
        scheduledISO = d.toISOString();
      }

      const categoryId = selectedCategoryId || "00000000-0000-0000-0000-000000000000";

      const jobRes = await api.post("/jobs", {
        category_id: categoryId,
        title: `Job for ${a.name.split(" ")[0]}`,
        description: job.trim(),
        additional_notes: additionalNotes.trim() || undefined,
        location_label: user?.district || "Kigali",
        latitude: -1.9441,
        longitude: 30.0619,
        urgency,
        scheduled_time: scheduledISO,
        budget_negotiable: true,
        ...(budget ? { budget: parseInt(budget) } : {}),
      });

      setBookingId(jobRes.data.id);
      setStep(2);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof msg === "string" ? msg : "Failed to create booking. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmPayment = async () => {
    if (!bookingId) return;
    setSubmitting(true);
    try {
      // In the job/bid flow, payment confirmation is on the booking object
      // Since this is a direct booking (not bid-based), we just notify and done
      await api.post(`/bookings/${bookingId}/confirm-payment`).catch(() => {});
      setDone(true);
      toast.success("Booking request sent! The artisan will confirm soon.");
    } catch {
      // Even if confirm fails (e.g. booking not yet in pending_payment), still show done
      setDone(true);
      toast.success("Booking request sent!");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const momoNumber = a.momoPhone ?? "+250780000000";

  const URGENCY_OPTIONS = [
    { value: "flexible", label: "Flexible", emoji: "📅" },
    { value: "this_week", label: "This Week", emoji: "🗓️" },
    { value: "tomorrow", label: "Tomorrow", emoji: "⏰" },
    { value: "today", label: "Today", emoji: "🔥" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="Close" />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-t-[32px] bg-card sm:rounded-[32px] shadow-xl max-h-[92dvh] overflow-y-auto">
        {/* Handle */}
        <div className="flex justify-center pt-4 pb-1 sm:hidden">
          <div className="h-1 w-12 rounded-full bg-muted" />
        </div>

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
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-extrabold">Request sent! 🎉</h2>
              <p className="mt-2 text-muted-foreground text-sm">
                Your request has been sent to {a.name.split(" ")[0]}. They'll bid on your job shortly.
              </p>
              <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-4 text-left">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">What happens next</p>
                <ol className="text-sm space-y-1 text-muted-foreground">
                  <li>1. The artisan sees your job and submits a bid</li>
                  <li>2. You accept the bid</li>
                  <li>3. Pay via MoMo to {momoNumber}</li>
                  <li>4. The job starts when payment is confirmed</li>
                </ol>
              </div>
              <button onClick={onClose} className="mt-6 w-full rounded-2xl bg-primary py-3.5 font-bold text-primary-foreground">
                Done
              </button>
            </div>

          ) : step === 1 ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-extrabold">What do you need?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Describe the job for {a.name.split(" ")[0]}
                </p>
              </div>

              {/* Service Category */}
              {categories.length > 0 && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 block">
                    Service Category
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
                    {categories.map((cat) => (
                      <button key={cat.id} onClick={() => setSelectedCategoryId(cat.id)}
                        className={`flex flex-col items-center rounded-xl border-2 p-2 text-center transition ${selectedCategoryId === cat.id ? "border-primary bg-primary/10" : "border-border bg-muted/30 hover:bg-muted"}`}>
                        <span className="text-base">{cat.icon_emoji ?? "🛠️"}</span>
                        <span className={`text-[10px] font-semibold mt-0.5 ${selectedCategoryId === cat.id ? "text-primary" : "text-foreground"}`}>
                          {cat.name_en}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Job description */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5 block">
                  Describe the job <span className="text-destructive">*</span>
                </label>
                <textarea value={job} onChange={(e) => setJob(e.target.value)}
                  placeholder={`e.g. "Fix a leaking pipe under the kitchen sink — it's been dripping for 2 days and there's water pooling on the floor."`}
                  className="w-full rounded-2xl border border-border bg-muted/30 p-4 text-sm resize-none outline-none focus:ring-2 focus:ring-primary/50 h-28"
                  maxLength={2000} />
                <div className="text-right text-[10px] text-muted-foreground">{job.length}/2000</div>
              </div>

              {/* Additional notes */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5 block">
                  Additional notes <span className="text-xs font-normal">(optional)</span>
                </label>
                <textarea value={additionalNotes} onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="Materials available, access instructions, gate code, etc."
                  className="w-full rounded-2xl border border-border bg-muted/30 p-3 text-sm resize-none outline-none focus:ring-2 focus:ring-primary/50 h-16"
                  maxLength={500} />
              </div>

              {/* Urgency */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5 block">
                  <Clock className="inline h-3.5 w-3.5 mr-1" />How urgent?
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {URGENCY_OPTIONS.map((u) => (
                    <button key={u.value} onClick={() => setUrgency(u.value)}
                      className={`flex flex-col items-center rounded-xl border-2 py-2 px-1 transition ${urgency === u.value ? "border-primary bg-primary/10" : "border-border bg-muted/30 hover:bg-muted"}`}>
                      <span className="text-base">{u.emoji}</span>
                      <span className={`text-[10px] font-bold mt-0.5 ${urgency === u.value ? "text-primary" : "text-foreground"}`}>{u.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Schedule */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5 block">
                  <Calendar className="inline h-3.5 w-3.5 mr-1" />Preferred date/time <span className="text-xs font-normal">(optional)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="rounded-2xl border border-border bg-muted/30 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50" />
                  <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)}
                    className="rounded-2xl border border-border bg-muted/30 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
              </div>

              {/* Budget */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5 block">
                  <DollarSign className="inline h-3.5 w-3.5 mr-1" />Budget (RWF) <span className="text-xs font-normal">— optional</span>
                </label>
                <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)}
                  placeholder={`Starting from ${formatRWF(a.startingPrice ?? 5000)} RWF`}
                  className="w-full rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                  min={500} />
              </div>

              <button onClick={submitBookingRequest} disabled={job.trim().length < 10 || submitting}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 font-bold text-primary-foreground disabled:opacity-40 transition">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {submitting ? "Sending…" : "Continue"}
              </button>
            </div>

          ) : step === 2 ? (
            <div>
              <h2 className="text-2xl font-extrabold">Review & Confirm</h2>
              <p className="mt-1 text-sm text-muted-foreground">Double-check before sending to {a.name.split(" ")[0]}</p>

              <div className="mt-4 space-y-3">
                <SummaryRow label="Artisan" value={a.name} />
                <SummaryRow label="Job" value={job.length > 100 ? job.slice(0, 100) + "…" : job} />
                <SummaryRow label="Urgency" value={URGENCY_OPTIONS.find(u => u.value === urgency)?.label ?? urgency} />
                {scheduledDate && <SummaryRow label="Scheduled" value={`${scheduledDate} at ${scheduledTime}`} />}
                <SummaryRow label="Budget" value={budget ? `${formatRWF(parseInt(budget))} RWF` : `Open bids (starting ~${formatRWF(a.startingPrice ?? 5000)} RWF)`} />
                {selectedCategoryId && <SummaryRow label="Category" value={categories.find(c => c.id === selectedCategoryId)?.name_en ?? "—"} />}
              </div>

              <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-primary mb-1">Payment Method</p>
                <div className="flex gap-2 mt-2">
                  {(["MTN", "Airtel"] as const).map((p) => (
                    <button key={p} onClick={() => setProvider(p)}
                      className={`flex-1 rounded-xl border-2 py-2 text-sm font-bold transition ${provider === p ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30"}`}>
                      {p === "MTN" ? "📱 MTN MoMo" : "📲 Airtel Money"}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  <ShieldCheck className="inline h-3.5 w-3.5 mr-1 text-green-600" />
                  Pay directly to the artisan after they confirm.
                </p>
              </div>

              <div className="mt-6 flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 rounded-2xl border border-border bg-muted/30 py-3.5 font-bold transition hover:bg-muted">
                  Back
                </button>
                <button onClick={() => setStep(3)} disabled={submitting}
                  className="flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 font-bold text-primary-foreground disabled:opacity-60 transition">
                  <ArrowRight className="h-4 w-4" /> Send Request
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
                <div className="mt-3 text-2xl font-extrabold">
                  {formatRWF(budget ? parseInt(budget) : (a.startingPrice ?? 5000))} RWF
                </div>
                <p className="text-xs text-muted-foreground mt-1">Reference: HandyRwanda — {a.name.split(" ")[0]}</p>
              </div>

              <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800">
                  Only tap "I've sent payment" after the transfer is complete. This notifies the artisan.
                </p>
              </div>

              <button onClick={confirmPayment} disabled={submitting || !armed}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-green-600 py-3.5 font-bold text-white disabled:opacity-40 transition">
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
      <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground shrink-0">{label}</span>
      <span className="ml-4 text-sm font-semibold text-foreground text-right">{value}</span>
    </div>
  );
}
