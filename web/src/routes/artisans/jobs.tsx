// File: web/src/routes/artisans/jobs.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { MapPin, Briefcase, Clock, ChevronRight, Loader2, ArrowRight } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";
import { formatRWF } from "@/services/artisanService";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/artisans/jobs")({
  component: ArtisanJobFeed,
});

function ArtisanJobFeed() {
  const { isAuthenticated, user } = useAuthStore();
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bidPrices, setBidPrices] = useState<Record<string, string>>({});
  const [bidNotes, setBidNotes] = useState<Record<string, string>>({});
  const [bidHours, setBidHours] = useState<Record<string, string>>({});
  const [bidStartTimes, setBidStartTimes] = useState<Record<string, string>>({});

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["open-jobs"],
    queryFn: () => api.get("/jobs/available").then((r) => r.data),
    refetchInterval: 60000,
  });

  const submitBid = useMutation({
    mutationFn: ({ jobId, price, note, hours, startTime }: { jobId: string; price: number; note: string; hours?: number; startTime?: string }) =>
      api.post(`/bids/jobs/${jobId}`, {
        proposed_price: price,
        message: note || undefined,
        estimated_duration_hours: hours || undefined,
        proposed_start_time: startTime || undefined,
      }),
    onSuccess: (_, { jobId }) => {
      toast.success("Bid submitted! The client will be notified.");
      setExpandedId(null);
      setBidPrices((p) => {
        const n = { ...p };
        delete n[jobId];
        return n;
      });
      setBidNotes((p) => {
        const n = { ...p };
        delete n[jobId];
        return n;
      });
      qc.invalidateQueries({ queryKey: ["open-jobs"] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof msg === "string" ? msg : "Failed to submit bid.");
    },
  });

  return (
    <div className="min-h-dvh bg-muted/30 pb-12">
      <Header />
      <main className="mx-auto max-w-4xl px-4 pt-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold">Open Jobs</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Jobs posted by clients — submit your bid
            </p>
          </div>
          <div className="flex gap-2">
            <span className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-sm font-bold">
              {jobs.length} available
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <Briefcase className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <p className="font-semibold">No open jobs right now</p>
            <p className="text-sm text-muted-foreground mt-1">
              Check back soon — jobs are posted daily.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map(
              (j: {
                id: string;
                title: string;
                description: string;
                budget?: number;
                budget_max?: number;
                location_label?: string;
                created_at?: string;
                urgency?: string;
                job_type?: string;
                already_bid?: boolean;
                special_requirements?: string;
                is_remote_possible?: boolean;
                category?: { name_en: string; icon_emoji?: string };
                bid_count?: number;
              }) => (
                <article
                  key={j.id}
                  className="rounded-2xl border border-border bg-card p-5 shadow-card"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                          <Briefcase className="h-4 w-4" />
                        </span>
                        <h2 className="text-base font-bold">{j.title}</h2>
                        {j.category && (
                          <Badge variant="secondary" className="text-xs">
                            {j.category.icon_emoji} {j.category.name_en}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        {j.location_label && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {j.location_label}
                          </span>
                        )}
                        {j.budget && (
                          <span className="font-semibold text-foreground">
                            Budget: {formatRWF(j.budget)} RWF
                          </span>
                        )}
                        {j.bid_count !== undefined && (
                          <span className="text-xs">
                            {j.bid_count} bid{j.bid_count !== 1 ? "s" : ""}
                          </span>
                        )}
                        {j.urgency && j.urgency !== "flexible" && (
                          <Badge variant="outline" className={`text-xs ${j.urgency === "urgent" ? "border-red-400 text-red-600 bg-red-50" : j.urgency === "today" ? "border-amber-400 text-amber-700 bg-amber-50" : "border-blue-300 text-blue-700 bg-blue-50"}`}>
                            {j.urgency === "urgent" ? "🚨 Urgent" : j.urgency === "today" ? "🔥 Today" : j.urgency === "tomorrow" ? "⏰ Tomorrow" : j.urgency === "this_week" ? "🗓️ This Week" : j.urgency}
                          </Badge>
                        )}
                        {j.job_type && j.job_type !== "one_time" && (
                          <Badge variant="secondary" className="text-xs">
                            {j.job_type === "recurring" ? "🔁 Recurring" : "🆘 Emergency"}
                          </Badge>
                        )}
                        {j.is_remote_possible && (
                          <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">
                            📞 Remote OK
                          </Badge>
                        )}
                        {j.already_bid && (
                          <Badge className="text-xs bg-green-100 text-green-700 border-green-300">
                            ✓ Bid sent
                          </Badge>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                        {j.description}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {j.created_at && (
                        <p className="text-xs font-medium text-muted-foreground">
                          {formatDistanceToNow(new Date(j.created_at), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  </div>

                  {expandedId !== j.id ? (
                    <div className="mt-4 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!isAuthenticated || user?.role !== "artisan") {
                            toast.error("You must be logged in as an artisan to bid.");
                            return;
                          }
                          setExpandedId(j.id);
                        }}
                        className="gap-1.5"
                      >
                        Submit Bid <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5">
                        View Details <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3 border-t border-border pt-4">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          Your Price (RWF)
                        </label>
                        <Input
                          type="number"
                          value={bidPrices[j.id] ?? ""}
                          onChange={(e) => setBidPrices((p) => ({ ...p, [j.id]: e.target.value }))}
                          placeholder={j.budget ? `Suggested: ${j.budget}` : "Enter your price"}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          Note to client (optional)
                        </label>
                        <Textarea
                          value={bidNotes[j.id] ?? ""}
                          onChange={(e) => setBidNotes((p) => ({ ...p, [j.id]: e.target.value }))}
                          placeholder="Tell the client why you're the right person for this job…"
                          className="mt-1 resize-none h-20"
                          maxLength={500}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                            Est. Hours
                          </label>
                          <Input
                            type="number"
                            value={bidHours[j.id] ?? ""}
                            onChange={(e) => setBidHours((p) => ({ ...p, [j.id]: e.target.value }))}
                            placeholder="e.g. 3"
                            step="0.5"
                            min="0.5"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                            Proposed Start
                          </label>
                          <Input
                            type="datetime-local"
                            value={bidStartTimes[j.id] ?? ""}
                            onChange={(e) => setBidStartTimes((p) => ({ ...p, [j.id]: e.target.value }))}
                            className="mt-1"
                            min={new Date().toISOString().slice(0, 16)}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => setExpandedId(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          className="flex-1"
                          disabled={!bidPrices[j.id] || submitBid.isPending}
                          onClick={() =>
                            submitBid.mutate({
                              jobId: j.id,
                              price: parseInt(bidPrices[j.id] ?? "0"),
                              note: bidNotes[j.id] ?? "",
                            })
                          }
                        >
                          {submitBid.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : null}
                          Send Bid
                        </Button>
                      </div>
                    </div>
                  )}
                </article>
              ),
            )}
          </div>
        )}
      </main>
    </div>
  );
}
