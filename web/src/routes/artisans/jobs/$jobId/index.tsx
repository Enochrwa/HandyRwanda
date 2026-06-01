// File: web/src/routes/artisans/jobs/$jobId.tsx
import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { MapPin, Briefcase, Clock, ChevronLeft, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import api from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { formatRWF } from "@/services/artisanService";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/artisans/jobs/$jobId/")({
  component: JobDetail,
});

interface JobItem {
  id: string;
  title: string;
  description: string;
  additional_notes?: string;
  budget?: number;
  budget_negotiable?: boolean;
  location_label?: string;
  created_at?: string;
  scheduled_time?: string;
  urgency?: string;
  category?: { name_en: string; icon_emoji?: string };
  bid_count?: number;
  images?: string[];
}

const URGENCY_COLORS: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 border-red-200",
  today: "bg-orange-100 text-orange-700 border-orange-200",
  tomorrow: "bg-yellow-100 text-yellow-700 border-yellow-200",
  this_week: "bg-blue-100 text-blue-700 border-blue-200",
  flexible: "bg-gray-100 text-gray-600 border-gray-200",
};

const URGENCY_LABELS: Record<string, string> = {
  urgent: "🚨 Urgent",
  today: "🔥 Today",
  tomorrow: "⏰ Tomorrow",
  this_week: "🗓️ This Week",
  flexible: "📅 Flexible",
};

function BidForm({ jobId, onSuccess }: { jobId: string; onSuccess: () => void }) {
  const qc = useQueryClient();
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [hours, setHours] = useState("");

  const submitBid = useMutation({
    mutationFn: () =>
      api.post(`/bids/jobs/${jobId}`, {
        proposed_price: parseInt(price, 10),
        message: message.trim() || undefined,
        cover_letter: coverLetter.trim() || undefined,
        estimated_duration_hours: hours ? parseInt(hours, 10) : undefined,
      }),
    onSuccess: () => {
      toast.success("Bid submitted! The client will be notified.");
      qc.invalidateQueries({ queryKey: ["job-detail", jobId] });
      qc.invalidateQueries({ queryKey: ["open-jobs"] });
      onSuccess();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof msg === "string" ? msg : "Failed to submit bid.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(price, 10);
    if (!price || isNaN(p) || p < 500) {
      toast.error("Enter a price of at least 500 RWF");
      return;
    }
    submitBid.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground block mb-1">
          Your Price (RWF) <span className="text-destructive">*</span>
        </label>
        <input
          type="number"
          min={500}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="e.g. 15000"
          className="w-full rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
          required
        />
      </div>
      <div>
        <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground block mb-1">
          Estimated Duration (hours) <span className="text-[10px] font-normal">(optional)</span>
        </label>
        <input
          type="number"
          min={1}
          max={720}
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          placeholder="e.g. 3"
          className="w-full rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
        />
      </div>
      <div>
        <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground block mb-1">
          Your Approach <span className="text-[10px] font-normal">(optional but recommended)</span>
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="How would you tackle this job? What tools or materials will you bring?"
          rows={3}
          maxLength={500}
          className="w-full rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground outline-none focus:border-primary resize-none"
        />
        <p className="text-right text-[10px] text-muted-foreground mt-1">{message.length}/500</p>
      </div>
      <div>
        <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground block mb-1">
          Why You? <span className="text-[10px] font-normal">(optional)</span>
        </label>
        <textarea
          value={coverLetter}
          onChange={(e) => setCoverLetter(e.target.value)}
          placeholder="Years of experience, similar jobs completed, certifications…"
          rows={2}
          maxLength={500}
          className="w-full rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground outline-none focus:border-primary resize-none"
        />
      </div>
      <button
        type="submit"
        disabled={submitBid.isPending || !price}
        className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {submitBid.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Bid →"}
      </button>
    </form>
  );
}

function JobDetail() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data: jobResp, isLoading } = useQuery({
    queryKey: ["job-detail", jobId],
    queryFn: () => api.get(`/jobs/${jobId}`).then((r) => r.data),
  });

  const job = jobResp?.job;
  const priceGuidance = jobResp?.price_guidance;
  const alreadyBid = jobResp?.already_bid ?? false;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-center">Job not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-muted/30 pb-12">
      <Header />
      <main className="mx-auto max-w-4xl px-4 pt-8">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate({ to: "/artisans/jobs" })}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Back to Jobs
          </button>
          <h1 className="text-2xl font-extrabold">{job.title}</h1>
        </div>

        <div className="space-y-6">
          <div className="border rounded-2xl p-6 bg-card">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {job.urgency && job.urgency !== "flexible" && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${URGENCY_COLORS[job.urgency] ?? URGENCY_COLORS.flexible}`}
                >
                  {URGENCY_LABELS[job.urgency] ?? job.urgency}
                </span>
              )}
              {job.category && (
                <Badge variant="secondary" className="text-xs">
                  {job.category.icon_emoji} {job.category.name_en}
                </Badge>
              )}
              {job.bid_count !== undefined && (
                <span className="text-xs text-muted-foreground">
                  {job.bid_count} bid{job.bid_count !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            <h2 className="text-base font-bold">{job.title}</h2>

            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {job.location_label && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {job.location_label}
                </span>
              )}
              {job.budget ? (
                <span className="font-semibold text-foreground">
                  Budget: {formatRWF(job.budget)} RWF
                  {job.budget_negotiable && (
                    <span className="text-xs text-muted-foreground font-normal ml-1">
                      (negotiable)
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-xs">Open bids — no set budget</span>
              )}
              {job.scheduled_time && (
                <span className="flex items-center gap-1 text-xs">
                  <Clock className="h-3.5 w-3.5" />
                  {new Date(job.scheduled_time).toLocaleDateString("en-RW", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              )}
            </div>

            <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{job.description}</p>

            {job.additional_notes && (
              <p className="mt-1 text-xs text-muted-foreground/70 italic line-clamp-1">
                📝 {job.additional_notes}
              </p>
            )}

            {job.images && job.images.length > 0 && (
              <div className="flex gap-1.5 mt-2">
                {job.images.slice(0, 3).map((url: string, i: number) => (
                  <img
                    key={i}
                    src={url}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover border border-border"
                  />
                ))}
                {job.images.length > 3 && (
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground border border-border">
                    +{job.images.length - 3}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border rounded-2xl p-6 bg-card space-y-4">
            <h2 className="text-xl font-bold">Place a Bid</h2>

            {alreadyBid && (
              <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
                <span className="text-lg">✅</span>
                <p className="text-sm font-semibold text-green-700">
                  You already submitted a bid on this job.
                </p>
              </div>
            )}

            {priceGuidance && priceGuidance.sample_size > 0 && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-xs font-bold text-primary mb-2">
                  💡 Market Price in {priceGuidance.district}
                </p>
                <div className="flex justify-between text-sm">
                  <div className="text-center">
                    <p className="text-muted-foreground text-[10px]">Min</p>
                    <p className="font-bold">{formatRWF(priceGuidance.min)} RWF</p>
                  </div>
                  <div className="text-center border-x border-primary/20 px-4">
                    <p className="text-muted-foreground text-[10px]">Typical</p>
                    <p className="font-bold text-primary">{formatRWF(priceGuidance.median)} RWF</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground text-[10px]">Max</p>
                    <p className="font-bold">{formatRWF(priceGuidance.max)} RWF</p>
                  </div>
                </div>
              </div>
            )}

            {!alreadyBid && <BidForm jobId={jobId} onSuccess={() => navigate({ to: "/artisans/jobs" })} />}
          </div>
        </div>
      </main>
    </div>
  );
}
