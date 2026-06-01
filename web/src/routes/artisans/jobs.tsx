// File: web/src/routes/artisans/jobs.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import {
  MapPin,
  Briefcase,
  Clock,
  ChevronRight,
  Loader2,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
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

function ArtisanJobFeed() {
  const { isAuthenticated, user } = useAuthStore();
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bidPrices, setBidPrices] = useState<Record<string, string>>({});
  const [bidNotes, setBidNotes] = useState<Record<string, string>>({});
  const [bidCovers, setBidCovers] = useState<Record<string, string>>({});
  const [bidHours, setBidHours] = useState<Record<string, string>>({});
  const [searchQ, setSearchQ] = useState("");
  const [filterUrgency, setFilterUrgency] = useState<string>("all");
  const navigate = useNavigate();

  const { data: jobs = [], isLoading } = useQuery<JobItem[]>({
    queryKey: ["open-jobs"],
    queryFn: () => api.get("/jobs/available").then((r) => r.data),
    refetchInterval: 60000,
  });

  const submitBid = useMutation({
    mutationFn: ({
      jobId,
      price,
      note,
      cover,
      hours,
    }: {
      jobId: string;
      price: number;
      note: string;
      cover: string;
      hours?: number;
    }) =>
      api.post(`/bids/jobs/${jobId}`, {
        proposed_price: price,
        message: note || undefined,
        cover_letter: cover || undefined,
        estimated_duration_hours: hours || undefined,
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
      setBidCovers((p) => {
        const n = { ...p };
        delete n[jobId];
        return n;
      });
      setBidHours((p) => {
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

  const filteredJobs = jobs.filter((j) => {
    if (filterUrgency !== "all" && j.urgency !== filterUrgency) return false;
    if (
      searchQ &&
      !j.title.toLowerCase().includes(searchQ.toLowerCase()) &&
      !j.description.toLowerCase().includes(searchQ.toLowerCase())
    )
      return false;
    return true;
  });

  return (
    <div className="min-h-dvh bg-muted/30 pb-12">
      <Header />
      <main className="mx-auto max-w-4xl px-4 pt-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-extrabold">Open Jobs</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Jobs posted by clients — submit your best bid
            </p>
          </div>
          <span className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-sm font-bold">
            {filteredJobs.length} available
          </span>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-5 flex-wrap">
          <Input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search jobs..."
            className="max-w-xs"
          />
          <div className="flex gap-1.5 flex-wrap">
            {["all", "urgent", "today", "tomorrow", "this_week", "flexible"].map((u) => (
              <button
                key={u}
                onClick={() => setFilterUrgency(u)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                  filterUrgency === u
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border hover:bg-muted"
                }`}
              >
                {u === "all" ? "All" : (URGENCY_LABELS[u] ?? u)}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <Briefcase className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <p className="font-semibold">No matching jobs right now</p>
            <p className="text-sm text-muted-foreground mt-1">
              Check back soon — jobs are posted daily.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredJobs.map((j) => (
              <article
                key={j.id}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {j.urgency && j.urgency !== "flexible" && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${URGENCY_COLORS[j.urgency] ?? URGENCY_COLORS.flexible}`}
                        >
                          {URGENCY_LABELS[j.urgency] ?? j.urgency}
                        </span>
                      )}
                      {j.category && (
                        <Badge variant="secondary" className="text-xs">
                          {j.category.icon_emoji} {j.category.name_en}
                        </Badge>
                      )}
                      {j.bid_count !== undefined && (
                        <span className="text-xs text-muted-foreground">
                          {j.bid_count} bid{j.bid_count !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <h2 className="text-base font-bold">{j.title}</h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      {j.location_label && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" /> {j.location_label}
                        </span>
                      )}
                      {j.budget ? (
                        <span className="font-semibold text-foreground">
                          Budget: {formatRWF(j.budget)} RWF
                          {j.budget_negotiable && (
                            <span className="text-xs text-muted-foreground font-normal ml-1">
                              (negotiable)
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs">Open bids — no set budget</span>
                      )}
                      {j.scheduled_time && (
                        <span className="flex items-center gap-1 text-xs">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(j.scheduled_time).toLocaleDateString("en-RW", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                      {j.description}
                    </p>
                    {j.additional_notes && (
                      <p className="mt-1 text-xs text-muted-foreground/70 italic line-clamp-1">
                        📝 {j.additional_notes}
                      </p>
                    )}
                    {j.images && j.images.length > 0 && (
                      <div className="flex gap-1.5 mt-2">
                        {j.images.slice(0, 3).map((url, i) => (
                          <img
                            key={i}
                            src={url}
                            alt=""
                            className="w-12 h-12 rounded-lg object-cover border border-border"
                          />
                        ))}
                        {j.images.length > 3 && (
                          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground border border-border">
                            +{j.images.length - 3}
                          </div>
                        )}
                      </div>
                    )}
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
                    <Button size="sm" variant="outline" asChild className="gap-1.5">
                      <Link to={`/artisans/jobs/$jobId`} params={{ jobId: j.id }}>
                        View Details <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3 border-t border-border pt-4">
                    <div className="bg-muted/40 rounded-xl p-3 text-xs text-muted-foreground">
                      <AlertCircle className="inline h-3.5 w-3.5 mr-1" />
                      Write a detailed bid to stand out. Clients prefer artisans who clearly
                      understand their problem.
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          Your Price (RWF) *
                        </label>
                        <Input
                          type="number"
                          value={bidPrices[j.id] ?? ""}
                          min={500}
                          onChange={(e) => setBidPrices((p) => ({ ...p, [j.id]: e.target.value }))}
                          placeholder={
                            j.budget ? `Budget: ${formatRWF(j.budget)}` : "Enter your price"
                          }
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          Estimated Duration (hours)
                        </label>
                        <Input
                          type="number"
                          value={bidHours[j.id] ?? ""}
                          min={1}
                          max={720}
                          onChange={(e) => setBidHours((p) => ({ ...p, [j.id]: e.target.value }))}
                          placeholder="e.g. 3"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Your Approach (optional)
                      </label>
                      <Textarea
                        value={bidNotes[j.id] ?? ""}
                        onChange={(e) => setBidNotes((p) => ({ ...p, [j.id]: e.target.value }))}
                        placeholder="Briefly describe how you'd tackle this job — your method, tools, timeline..."
                        className="mt-1 resize-none h-20"
                        maxLength={500}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Why you? (cover letter) — optional
                      </label>
                      <Textarea
                        value={bidCovers[j.id] ?? ""}
                        onChange={(e) => setBidCovers((p) => ({ ...p, [j.id]: e.target.value }))}
                        placeholder="Years of experience with this type of work, similar jobs you've completed, certifications..."
                        className="mt-1 resize-none h-16"
                        maxLength={500}
                      />
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
                            cover: bidCovers[j.id] ?? "",
                            hours: bidHours[j.id] ? parseInt(bidHours[j.id]) : undefined,
                          })
                        }
                      >
                        {submitBid.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                        )}
                        Send Bid
                      </Button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
