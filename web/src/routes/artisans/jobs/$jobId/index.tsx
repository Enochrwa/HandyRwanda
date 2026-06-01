// File: web/src/routes/artisans/jobs/$jobId.tsx
import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { MapPin, Briefcase, Clock, ChevronLeft, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
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

function JobDetail() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data: job, isLoading } = useQuery({
    queryKey: ["job-detail", jobId],
    queryFn: () => api.get(`/jobs/${jobId}`).then((r) => r.data),
  });

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

          <div className="border rounded-2xl p-6 bg-card">
            <h2 className="text-xl font-bold mb-4">Place a Bid</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Submit your bid for this job. The client will be notified.
            </p>

            {/* We would normally have a bid form here, but for now, we'll just show a message */}
            <p className="text-muted-foreground">
              Bid submission functionality is available on the job feed page.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
