// File: web/src/routes/jobs/mine.tsx
// Sprint 3.1 — Client Job Dashboard
// Accessible at /jobs/mine — shows all of this client's jobs with bid counts,
// status pills, and links to the bid detail page.

import { useState, useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import {
  Briefcase,
  Plus,
  Clock,
  ChevronRight,
  Loader2,
  RefreshCw,
  Eye,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Hammer,
  TrendingUp,
  FileText,
  Calendar,
  MapPin,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { AuthModal } from "@/components/AuthModal";
import api from "@/services/api";
import { formatRWF } from "@/services/artisanService";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/jobs/mine")({
  head: () => ({ meta: [{ title: "My Jobs — HandyRwanda" }] }),
  component: MyJobs,
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface JobItem {
  id: string;
  title: string;
  description: string;
  status?: string;
  urgency?: string;
  budget?: number;
  budget_negotiable?: boolean;
  bid_count?: number;
  location_label?: string;
  created_at?: string;
  scheduled_time?: string;
  category?: { id?: string; name_en: string; icon_emoji?: string };
  images?: string[];
}

// ─── Status Configuration ──────────────────────────────────────────────────────

type StatusTab = "open" | "in_progress" | "completed" | "cancelled";

const STATUS_TABS: {
  key: StatusTab;
  label: string;
  icon: React.ElementType;
  color: string;
  dot: string;
}[] = [
  {
    key: "open",
    label: "Open",
    icon: FileText,
    color: "text-blue-600 bg-blue-50 border-blue-200",
    dot: "bg-blue-500",
  },
  {
    key: "in_progress",
    label: "In Progress",
    icon: Hammer,
    color: "text-amber-600 bg-amber-50 border-amber-200",
    dot: "bg-amber-500",
  },
  {
    key: "completed",
    label: "Completed",
    icon: CheckCircle2,
    color: "text-green-600 bg-green-50 border-green-200",
    dot: "bg-green-500",
  },
  {
    key: "cancelled",
    label: "Cancelled",
    icon: XCircle,
    color: "text-red-600 bg-red-50 border-red-200",
    dot: "bg-red-400",
  },
];

const STATUS_PILL: Record<string, string> = {
  open: "bg-blue-100 text-blue-700 border border-blue-200",
  in_progress: "bg-amber-100 text-amber-700 border border-amber-200",
  completed: "bg-green-100 text-green-700 border border-green-200",
  cancelled: "bg-red-100 text-red-600 border border-red-200",
  disputed: "bg-purple-100 text-purple-700 border border-purple-200",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  disputed: "Disputed",
};

const URGENCY_BADGE: Record<string, string> = {
  urgent: "🚨 Urgent",
  today: "🔥 Today",
  tomorrow: "⏰ Tomorrow",
  this_week: "🗓️ This Week",
  flexible: "📅 Flexible",
};

// ─── Job Card ─────────────────────────────────────────────────────────────────

function JobCard({ job }: { job: JobItem }) {
  const status = job.status ?? "open";
  const pillClass = STATUS_PILL[status] ?? STATUS_PILL.open;
  const bidCount = job.bid_count ?? 0;

  return (
    <div className="group relative rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
      {/* Accent bar at top based on status */}
      <div
        className={`h-1 w-full ${
          status === "open"
            ? "bg-blue-500"
            : status === "in_progress"
              ? "bg-amber-500"
              : status === "completed"
                ? "bg-green-500"
                : "bg-red-400"
        }`}
      />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3 min-w-0">
            {/* Category emoji */}
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-xl">
              {job.category?.icon_emoji ?? "🛠️"}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-foreground text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                {job.title}
              </h3>
              {job.category && (
                <p className="text-xs text-muted-foreground mt-0.5">{job.category.name_en}</p>
              )}
            </div>
          </div>

          {/* Status pill */}
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${pillClass}`}
          >
            {STATUS_LABEL[status] ?? status}
          </span>
        </div>

        {/* Description preview */}
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{job.description}</p>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground mb-4">
          {job.urgency && job.urgency !== "flexible" && (
            <span className="font-medium text-foreground">
              {URGENCY_BADGE[job.urgency] ?? job.urgency}
            </span>
          )}
          {job.location_label && (
            <span className="flex items-center gap-0.5">
              <MapPin className="h-3 w-3" />
              {job.location_label}
            </span>
          )}
          {job.budget && (
            <span className="flex items-center gap-0.5 font-medium text-foreground">
              💰 {formatRWF(job.budget)} RWF
              {job.budget_negotiable && (
                <span className="text-muted-foreground font-normal"> (neg.)</span>
              )}
            </span>
          )}
          {job.scheduled_time && (
            <span className="flex items-center gap-0.5">
              <Calendar className="h-3 w-3" />
              {new Date(job.scheduled_time).toLocaleDateString("en-RW", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
          <span className="flex items-center gap-0.5 ml-auto">
            <Clock className="h-3 w-3" />
            {job.created_at
              ? formatDistanceToNow(new Date(job.created_at), { addSuffix: true })
              : "—"}
          </span>
        </div>

        {/* Footer row — bid count + action */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          {/* Bid count badge */}
          <div className="flex items-center gap-1.5">
            {bidCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/80 px-2.5 py-1 text-xs font-bold text-accent-foreground">
                <TrendingUp className="h-3 w-3" />
                {bidCount} bid{bidCount !== 1 ? "s" : ""}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">No bids yet</span>
            )}
          </div>

          {/* Action */}
          {status === "open" ? (
            <Link
              to="/jobs/$jobId/bids"
              params={{ jobId: job.id }}
              className="flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:brightness-95 transition-all"
            >
              {bidCount > 0 ? (
                <>
                  <Eye className="h-3 w-3" /> View Bids
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3" /> Watch for Bids
                </>
              )}
              <ChevronRight className="h-3 w-3" />
            </Link>
          ) : (
            <Link
              to="/jobs/$jobId/bids"
              params={{ jobId: job.id }}
              className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline transition-all"
            >
              View Details <ChevronRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ status, onPost }: { status: StatusTab; onPost: () => void }) {
  const messages: Record<StatusTab, { emoji: string; title: string; body: string }> = {
    open: {
      emoji: "📋",
      title: "No open jobs yet",
      body: "Post your first job and start receiving bids from verified artisans in your area.",
    },
    in_progress: {
      emoji: "🔨",
      title: "Nothing in progress",
      body: "When you accept a bid, the job moves here. Accept a bid on one of your open jobs to get started.",
    },
    completed: {
      emoji: "✅",
      title: "No completed jobs",
      body: "Your completed jobs will appear here. Each completed job is an opportunity to leave a review.",
    },
    cancelled: {
      emoji: "❌",
      title: "No cancelled jobs",
      body: "Cancelled jobs appear here. We hope you don't need this tab!",
    },
  };

  const msg = messages[status];

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center text-4xl mb-4">
        {msg.emoji}
      </div>
      <h3 className="font-bold text-foreground mb-2">{msg.title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-6">{msg.body}</p>
      {status === "open" && (
        <button
          onClick={onPost}
          className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:brightness-95 transition"
        >
          <Plus className="h-4 w-4" /> Post a Job
        </button>
      )}
    </div>
  );
}

// ─── Stats Bar ─────────────────────────────────────────────────────────────────

function StatsBar({ jobs }: { jobs: JobItem[] }) {
  const open = jobs.filter((j) => j.status === "open" || !j.status).length;
  const inProg = jobs.filter((j) => j.status === "in_progress").length;
  const done = jobs.filter((j) => j.status === "completed").length;
  const totalBids = jobs.reduce((acc, j) => acc + (j.bid_count ?? 0), 0);

  const stats = [
    { label: "Open", value: open, icon: "📋", color: "text-blue-600" },
    { label: "In Progress", value: inProg, icon: "🔨", color: "text-amber-600" },
    { label: "Completed", value: done, icon: "✅", color: "text-green-600" },
    { label: "Total Bids", value: totalBids, icon: "📊", color: "text-purple-600" },
  ];

  return (
    <div className="grid grid-cols-4 gap-3 mb-6">
      {stats.map((s) => (
        <div key={s.label} className="rounded-2xl border border-border bg-card p-3 text-center">
          <p className="text-2xl mb-0.5">{s.icon}</p>
          <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
          <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

function MyJobs() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<StatusTab>("open");
  const [authOpen, setAuthOpen] = useState(false);

  // Fetch all jobs (not filtered — we want counts for tab badges)
  const {
    data: allJobs = [],
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<JobItem[]>({
    queryKey: ["my-jobs"],
    queryFn: () => api.get("/jobs/mine").then((r) => r.data),
    enabled: isAuthenticated && user?.role !== "artisan",
    staleTime: 30_000,
    retry: 2,
  });

  // Count per status for tab badges
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const tab of STATUS_TABS) {
      c[tab.key] = allJobs.filter((j) => {
        const s = j.status ?? "open";
        if (tab.key === "open") return s === "open";
        if (tab.key === "in_progress")
          return ["in_progress", "artisan_accepted", "artisan_en_route", "arrived"].includes(s);
        return s === tab.key;
      }).length;
    }
    return c;
  }, [allJobs]);

  // Filtered jobs for current tab
  const filteredJobs = useMemo(() => {
    return allJobs.filter((j) => {
      const s = j.status ?? "open";
      if (activeTab === "open") return s === "open";
      if (activeTab === "in_progress")
        return ["in_progress", "artisan_accepted", "artisan_en_route", "arrived"].includes(s);
      return s === activeTab;
    });
  }, [allJobs, activeTab]);

  // ── Guard: redirect artisans (must be after all hooks) ──────────────────────
  if (isAuthenticated && user?.role === "artisan") {
    toast.error("This page is for clients only");
    navigate({ to: "/artisans/jobs" });
    return null;
  }

  // ── Auth Gate ────────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-dvh bg-muted/30">
        <Header />
        <main className="mx-auto max-w-md px-4 pt-20 text-center">
          <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center text-4xl mx-auto mb-5">
            🔒
          </div>
          <h1 className="text-2xl font-extrabold mb-2">Sign in to manage your jobs</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Your job dashboard is private. Log in or create a free account to view your jobs and
            bids.
          </p>
          <button
            onClick={() => setAuthOpen(true)}
            className="rounded-2xl bg-primary px-6 py-3 font-bold text-primary-foreground hover:brightness-95 transition"
          >
            Log in / Sign up
          </button>
        </main>
        <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-muted/30 pb-16">
      <Header />
      <main className="mx-auto max-w-4xl px-4 pt-8 sm:pt-12">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold sm:text-3xl flex items-center gap-2">
              <Briefcase className="h-6 w-6 text-primary" />
              My Jobs
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track your jobs, compare bids, and manage bookings.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Refresh"
              className="rounded-xl border border-border bg-card p-2 text-muted-foreground hover:bg-muted transition disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </button>
            <Link
              to="/jobs/post"
              className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:brightness-95 transition"
            >
              <Plus className="h-4 w-4" /> Post Job
            </Link>
          </div>
        </div>

        {/* Stats bar (only when data loaded) */}
        {!isLoading && allJobs.length > 0 && <StatsBar jobs={allJobs} />}

        {/* Status tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 mb-4 scrollbar-hide">
          {STATUS_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-all border ${
                  isActive ? tab.color : "border-transparent text-muted-foreground hover:bg-muted"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                {counts[tab.key] > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      isActive ? "bg-white/60" : "bg-muted text-foreground"
                    }`}
                  >
                    {counts[tab.key]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Loading your jobs…</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-4">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="font-bold">Failed to load your jobs</p>
            <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
            <button
              onClick={() => refetch()}
              className="mt-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted transition"
            >
              Retry
            </button>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card">
            <EmptyState status={activeTab} onPost={() => navigate({ to: "/jobs/post" })} />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}

        {/* Tip banner */}
        {!isLoading && filteredJobs.length > 0 && activeTab === "open" && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <span className="text-lg shrink-0">💡</span>
            <div className="text-sm">
              <p className="font-semibold text-primary">Tip: Compare bids carefully</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Click "View Bids" on any open job to compare artisan proposals, prices, and ratings
                side-by-side before accepting.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
