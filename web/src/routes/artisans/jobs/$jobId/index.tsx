// File: web/src/routes/artisans/jobs/$jobId/index.tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { MapPin, Clock, ChevronLeft, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export const Route = createFileRoute("/artisans/jobs/$jobId/")({
  component: JobDetail,
});

const URGENCY_COLORS: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 border-red-200",
  today: "bg-orange-100 text-orange-700 border-orange-200",
  tomorrow: "bg-yellow-100 text-yellow-700 border-yellow-200",
  this_week: "bg-blue-100 text-blue-700 border-blue-200",
  flexible: "bg-gray-100 text-gray-600 border-gray-200",
};

const URGENCY_LABELS: Record<string, string> = {
  urgent: "🚨 Urgent (2h)",
  today: "🔥 Today",
  tomorrow: "⏰ Tomorrow",
  this_week: "🗓️ This Week",
  flexible: "📅 Flexible",
};

function formatRWF(n: number) {
  return new Intl.NumberFormat("rw-RW").format(n);
}

function JobDetail() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const [bidPrice, setBidPrice] = useState("");
  const [bidMessage, setBidMessage] = useState("");
  const [bidCoverLetter, setBidCoverLetter] = useState("");
  const [bidHours, setBidHours] = useState("");
  const [bidStartTime, setBidStartTime] = useState("");

  const { data: resp, isLoading } = useQuery({
    queryKey: ["job-detail", jobId],
    queryFn: () => api.get(`/jobs/${jobId}`).then((r) => r.data),
  });

  // Backend wraps in { job, price_guidance, already_bid }
  const job = resp?.job ?? resp;
  const priceGuidance = resp?.price_guidance;
  const alreadyBid = resp?.already_bid ?? false;

  const submitBid = useMutation({
    mutationFn: () =>
      api.post(`/bids/jobs/${jobId}`, {
        proposed_price: parseInt(bidPrice),
        message: bidMessage.trim() || undefined,
        cover_letter: bidCoverLetter.trim() || undefined,
        estimated_duration_hours: bidHours ? parseInt(bidHours) : undefined,
        proposed_start_time: bidStartTime || undefined,
      }),
    onSuccess: () => {
      toast.success("🎉 Bid submitted! The client will be notified.");
      qc.invalidateQueries({ queryKey: ["job-detail", jobId] });
      qc.invalidateQueries({ queryKey: ["available-jobs"] });
      qc.invalidateQueries({ queryKey: ["my-bids"] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof msg === "string" ? msg : "Failed to submit bid. Try again.");
    },
  });

  const handleSubmit = () => {
    const price = parseInt(bidPrice);
    if (!bidPrice || isNaN(price) || price < 500) {
      toast.error("Enter a valid price (minimum 500 RWF)");
      return;
    }
    submitBid.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-muted/30">
        <Header />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-dvh bg-muted/30">
        <Header />
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-center text-muted-foreground">Job not found.</p>
          <Button variant="outline" onClick={() => navigate({ to: "/artisans/jobs" })}>
            ← Back to Jobs
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-muted/30 pb-16">
      <Header />
      <main className="mx-auto max-w-4xl px-4 pt-8">
        {/* Back + Title row */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate({ to: "/artisans/jobs" })}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors shrink-0"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Back
          </button>
          <h1 className="text-2xl font-extrabold leading-tight">{job.title}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ─── Left: Job Details ─── */}
          <div className="lg:col-span-2 space-y-5">
            {/* Meta badges */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex flex-wrap gap-2 mb-3">
                {job.urgency && job.urgency !== "flexible" && (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${URGENCY_COLORS[job.urgency] ?? URGENCY_COLORS.flexible}`}>
                    {URGENCY_LABELS[job.urgency] ?? job.urgency}
                  </span>
                )}
                {job.category && (
                  <Badge variant="secondary">
                    {job.category.icon_emoji} {job.category.name_en}
                  </Badge>
                )}
                {job.bid_count !== undefined && (
                  <Badge variant="outline">{job.bid_count} bid{job.bid_count !== 1 ? "s" : ""}</Badge>
                )}
                {alreadyBid && (
                  <Badge className="bg-green-100 text-green-700 border-green-200">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> You bid
                  </Badge>
                )}
              </div>

              {/* Stats row */}
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm mb-4">
                {job.location_label && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" /> {job.location_label}
                  </span>
                )}
                {job.scheduled_time && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(job.scheduled_time).toLocaleString("en-RW", {
                      weekday: "short", month: "short", day: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                )}
                {job.budget ? (
                  <span className="font-semibold text-foreground">
                    Budget: {formatRWF(job.budget)} RWF
                    {job.budget_negotiable && (
                      <span className="text-xs text-muted-foreground font-normal ml-1">(negotiable)</span>
                    )}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs">Open budget</span>
                )}
                {job.created_at && (
                  <span className="text-xs text-muted-foreground">
                    Posted {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                  </span>
                )}
              </div>

              {/* Description */}
              <p className="text-sm text-foreground leading-relaxed">{job.description}</p>

              {/* Additional notes */}
              {job.additional_notes && (
                <div className="mt-3 p-3 bg-muted/50 rounded-xl">
                  <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Additional Notes</p>
                  <p className="text-sm text-muted-foreground italic">{job.additional_notes}</p>
                </div>
              )}
            </div>

            {/* Photos */}
            {job.images && job.images.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-5">
                <p className="text-xs font-bold uppercase text-muted-foreground mb-3">
                  Photos from client ({job.images.length})
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {job.images.map((url: string, i: number) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Job photo ${i + 1}`}
                      className="w-full aspect-square rounded-xl object-cover border border-border"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Price guidance */}
            {priceGuidance && (
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
                <p className="text-xs font-bold text-primary mb-2">
                  💡 Market Price Guide — {priceGuidance.district}
                  {priceGuidance.is_estimated && (
                    <span className="font-normal text-muted-foreground ml-1">(estimated)</span>
                  )}
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Min", value: priceGuidance.min },
                    { label: "Typical", value: priceGuidance.median },
                    { label: "Max", value: priceGuidance.max },
                  ].map((p) => (
                    <div key={p.label} className="text-center">
                      <p className="text-[10px] text-muted-foreground">{p.label}</p>
                      <p className={`font-bold text-sm ${p.label === "Typical" ? "text-primary" : ""}`}>
                        {formatRWF(p.value)} RWF
                      </p>
                    </div>
                  ))}
                </div>
                {priceGuidance.sample_size > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-2 text-center">
                    Based on {priceGuidance.sample_size} completed jobs in this area
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ─── Right: Bid Form ─── */}
          <div className="lg:col-span-1">
            {alreadyBid ? (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <p className="font-bold text-green-800">Bid Submitted</p>
                </div>
                <p className="text-sm text-green-700">
                  You've already bid on this job. You'll be notified if the client accepts.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => navigate({ to: "/pro" })}
                >
                  View My Bids
                </Button>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl p-5 sticky top-4">
                <h2 className="text-base font-extrabold mb-1">Submit Your Bid</h2>
                <p className="text-xs text-muted-foreground mb-4">
                  Detailed bids win more jobs. Be specific about your approach.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Your Price (RWF) *
                    </label>
                    <Input
                      type="number"
                      value={bidPrice}
                      onChange={(e) => setBidPrice(e.target.value)}
                      placeholder={job.budget ? `Client budget: ${formatRWF(job.budget)}` : "Enter price in RWF"}
                      className="mt-1"
                      min={500}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Est. Hours
                      </label>
                      <Input
                        type="number"
                        value={bidHours}
                        onChange={(e) => setBidHours(e.target.value)}
                        placeholder="e.g. 3"
                        className="mt-1"
                        min={1}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Start Date
                      </label>
                      <Input
                        type="datetime-local"
                        value={bidStartTime}
                        onChange={(e) => setBidStartTime(e.target.value)}
                        className="mt-1"
                        min={new Date().toISOString().slice(0, 16)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Your Approach
                    </label>
                    <Textarea
                      value={bidMessage}
                      onChange={(e) => setBidMessage(e.target.value)}
                      placeholder="How would you tackle this? Tools, method, timeline..."
                      className="mt-1 resize-none h-20"
                      maxLength={500}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Why You? (optional)
                    </label>
                    <Textarea
                      value={bidCoverLetter}
                      onChange={(e) => setBidCoverLetter(e.target.value)}
                      placeholder="Experience, certifications, past work..."
                      className="mt-1 resize-none h-16"
                      maxLength={500}
                    />
                  </div>

                  <Button
                    onClick={handleSubmit}
                    disabled={submitBid.isPending || !bidPrice}
                    className="w-full bg-primary"
                  >
                    {submitBid.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Send Bid →"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
