// File: web/src/routes/recurring/index.tsx
// Sprint 12 — Recurring Job Subscriptions Management Page
// Route: /recurring
// Full CRUD: create schedule, list, pause, resume, cancel

import { useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import api from "@/services/api";
import { formatDistanceToNow, format, addWeeks, addMonths } from "date-fns";
import { toast } from "sonner";
import {
  RefreshCw,
  Plus,
  Pause,
  Play,
  Trash2,
  ChevronRight,
  Calendar,
  Clock,
  MapPin,
  Repeat,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Zap,
  BarChart3,
  ArrowLeft,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/recurring/")({
  head: () => ({ meta: [{ title: "Recurring Jobs — HandyRwanda" }] }),
  beforeLoad: () => {
    const { isAuthenticated, user } = useAuthStore.getState();
    if (!isAuthenticated) throw redirect({ to: "/" });
    if (user?.role === "admin") throw redirect({ to: "/admin/verification" });
  },
  component: RecurringPage,
});

// ── Types ─────────────────────────────────────────────────────────────────────

interface RecurringSchedule {
  id: string;
  title: string;
  description: string;
  category_id: string;
  district: string;
  sector?: string;
  location_label?: string;
  budget_per_session: number;
  frequency: "weekly" | "biweekly" | "monthly";
  day_of_week?: number;
  day_of_month?: number;
  preferred_time?: string;
  is_active: boolean;
  next_run_at?: string;
  total_sessions: number;
  paused_at?: string;
  created_at?: string;
}

interface Category {
  id: string;
  name_en: string;
  icon_emoji?: string;
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const FREQ_LABELS = { weekly: "Weekly", biweekly: "Every 2 Weeks", monthly: "Monthly" };
const FREQ_COLORS = {
  weekly: "bg-blue-100 text-blue-700 border-blue-200",
  biweekly: "bg-purple-100 text-purple-700 border-purple-200",
  monthly: "bg-green-100 text-green-700 border-green-200",
};

function formatRWF(n: number) {
  return new Intl.NumberFormat("rw-RW").format(n);
}

function frequencyLabel(s: RecurringSchedule): string {
  if (s.frequency === "monthly")
    return `${s.day_of_month}${["st", "nd", "rd"][(s.day_of_month ?? 1) - 1] || "th"} of every month`;
  if (s.frequency === "biweekly") return `Every other ${DAY_NAMES[s.day_of_week ?? 0]}`;
  return `Every ${DAY_NAMES[s.day_of_week ?? 0]}`;
}

// ── Create form ───────────────────────────────────────────────────────────────

function CreateScheduleModal({
  open,
  onClose,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  categories: Category[];
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: "",
    description: "",
    category_id: "",
    district: "Kigali",
    sector: "",
    budget_per_session: "",
    frequency: "weekly" as "weekly" | "biweekly" | "monthly",
    day_of_week: 5,
    day_of_month: 1,
    preferred_time: "08:00",
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post("/recurring", {
        ...form,
        budget_per_session: parseInt(form.budget_per_session, 10),
        day_of_week: form.frequency !== "monthly" ? form.day_of_week : undefined,
        day_of_month: form.frequency === "monthly" ? form.day_of_month : undefined,
      }),
    onSuccess: () => {
      toast.success("🔄 Recurring schedule created!");
      qc.invalidateQueries({ queryKey: ["my-recurring-schedules"] });
      onClose();
      setForm({
        title: "",
        description: "",
        category_id: "",
        district: "Kigali",
        sector: "",
        budget_per_session: "",
        frequency: "weekly",
        day_of_week: 5,
        day_of_month: 1,
        preferred_time: "08:00",
      });
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof msg === "string" ? msg : "Failed to create schedule.");
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-card rounded-3xl shadow-2xl border border-border overflow-hidden">
        <div className="bg-primary px-6 py-5">
          <h2 className="text-xl font-extrabold text-white">🔄 Create Recurring Job</h2>
          <p className="text-sm text-white/70 mt-1">Auto-book the same service on a schedule</p>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Category */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
              Service Category
            </label>
            <select
              value={form.category_id}
              onChange={(e) => setForm((p) => ({ ...p, category_id: e.target.value }))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:outline-none"
            >
              <option value="">Select category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon_emoji} {c.name_en}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
              Job Title
            </label>
            <input
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="e.g. Clean my house"
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Describe what needs to be done…"
              rows={3}
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:outline-none resize-none"
            />
          </div>

          {/* District */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
                District
              </label>
              <input
                value={form.district}
                onChange={(e) => setForm((p) => ({ ...p, district: e.target.value }))}
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
                Sector
              </label>
              <input
                value={form.sector}
                onChange={(e) => setForm((p) => ({ ...p, sector: e.target.value }))}
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:outline-none"
              />
            </div>
          </div>

          {/* Budget */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
              Budget per Session (RWF)
            </label>
            <input
              type="number"
              value={form.budget_per_session}
              onChange={(e) => setForm((p) => ({ ...p, budget_per_session: e.target.value }))}
              placeholder="e.g. 15000"
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:outline-none"
            />
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
              Frequency
            </label>
            <div className="flex gap-2">
              {(["weekly", "biweekly", "monthly"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setForm((p) => ({ ...p, frequency: f }))}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-xs font-bold transition ${form.frequency === f ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted"}`}
                >
                  {FREQ_LABELS[f]}
                </button>
              ))}
            </div>
          </div>

          {/* Day of week */}
          {form.frequency !== "monthly" && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
                Day of Week
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {DAY_NAMES.map((d, i) => (
                  <button
                    key={d}
                    onClick={() => setForm((p) => ({ ...p, day_of_week: i }))}
                    className={`px-3 py-2 rounded-xl border-2 text-xs font-bold transition ${form.day_of_week === i ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted"}`}
                  >
                    {d.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Day of month */}
          {form.frequency === "monthly" && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
                Day of Month (1–28)
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    setForm((p) => ({ ...p, day_of_month: Math.max(1, p.day_of_month - 1) }))
                  }
                  className="w-10 h-10 rounded-xl border border-border bg-card flex items-center justify-center text-lg hover:bg-muted transition"
                >
                  −
                </button>
                <div className="flex-1 h-10 rounded-xl border-2 border-primary bg-primary/5 flex items-center justify-center text-xl font-extrabold text-primary">
                  {form.day_of_month}
                </div>
                <button
                  onClick={() =>
                    setForm((p) => ({ ...p, day_of_month: Math.min(28, p.day_of_month + 1) }))
                  }
                  className="w-10 h-10 rounded-xl border border-border bg-card flex items-center justify-center text-lg hover:bg-muted transition"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {/* Preferred time */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
              Preferred Time
            </label>
            <input
              type="time"
              value={form.preferred_time}
              onChange={(e) => setForm((p) => ({ ...p, preferred_time: e.target.value }))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-border bg-card py-3 text-sm font-semibold text-muted-foreground hover:bg-muted transition"
          >
            Cancel
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={
              createMutation.isPending ||
              !form.title ||
              !form.category_id ||
              !form.budget_per_session
            }
            className="flex-[2] rounded-xl bg-primary py-3 text-sm font-extrabold text-primary-foreground hover:brightness-95 transition disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Repeat className="h-4 w-4" />
            )}
            Create Schedule
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Schedule card ─────────────────────────────────────────────────────────────

function ScheduleCard({
  schedule,
  categories,
  onPause,
  onResume,
  onCancel,
  isPausing,
  isResuming,
  isCancelling,
}: {
  schedule: RecurringSchedule;
  categories: Category[];
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  isPausing: boolean;
  isResuming: boolean;
  isCancelling: boolean;
}) {
  const cat = categories.find((c) => c.id === schedule.category_id);
  const isPaused = !!schedule.paused_at && !schedule.is_active;
  const isCancelled = !schedule.is_active && !schedule.paused_at;
  const nextRun = schedule.next_run_at ? new Date(schedule.next_run_at) : null;

  return (
    <div
      className={`rounded-3xl border bg-card shadow-sm overflow-hidden transition-all ${
        isCancelled
          ? "opacity-50 border-border"
          : isPaused
            ? "border-amber-200 bg-amber-50/30"
            : "border-border hover:shadow-md hover:border-primary/30"
      }`}
    >
      {/* Status strip */}
      {isPaused && (
        <div className="flex items-center gap-2 bg-amber-100 px-4 py-2 text-amber-800 text-xs font-bold">
          <Pause className="h-3 w-3" /> Paused
        </div>
      )}
      {isCancelled && (
        <div className="flex items-center gap-2 bg-muted px-4 py-2 text-muted-foreground text-xs font-semibold">
          <Trash2 className="h-3 w-3" /> Cancelled
        </div>
      )}
      {schedule.is_active && (
        <div className="flex items-center gap-2 bg-green-600 px-4 py-2 text-white text-xs font-bold">
          <CheckCircle2 className="h-3 w-3" /> Active
        </div>
      )}

      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl shrink-0">
              {cat?.icon_emoji ?? "🛠️"}
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-foreground leading-tight">
                {schedule.title}
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">{cat?.name_en}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-extrabold text-foreground">
              {formatRWF(schedule.budget_per_session)}
            </p>
            <p className="text-[10px] text-muted-foreground">RWF/session</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl bg-muted/40 px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Repeat className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-bold uppercase text-muted-foreground">
                Frequency
              </span>
            </div>
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${FREQ_COLORS[schedule.frequency]}`}
            >
              {frequencyLabel(schedule)}
            </span>
          </div>
          <div className="rounded-xl bg-muted/40 px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <BarChart3 className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-bold uppercase text-muted-foreground">
                Sessions
              </span>
            </div>
            <span className="text-sm font-extrabold text-foreground">
              {schedule.total_sessions} completed
            </span>
          </div>
        </div>

        <div className="space-y-1.5 mb-4">
          {schedule.location_label && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span>{schedule.location_label}</span>
            </div>
          )}
          {schedule.preferred_time && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>Preferred time: {schedule.preferred_time}</span>
            </div>
          )}
          {nextRun && schedule.is_active && (
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>
                Next session: {format(nextRun, "EEEE, MMM d")} ·{" "}
                {formatDistanceToNow(nextRun, { addSuffix: true })}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        {!isCancelled && (
          <div className="flex items-center gap-2 pt-3 border-t border-border">
            {schedule.is_active && !isPaused && (
              <button
                onClick={onPause}
                disabled={isPausing}
                className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition disabled:opacity-40"
              >
                {isPausing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Pause className="h-3 w-3" />
                )}
                Pause
              </button>
            )}
            {isPaused && (
              <button
                onClick={onResume}
                disabled={isResuming}
                className="flex items-center gap-1.5 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100 transition disabled:opacity-40"
              >
                {isResuming ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
                Resume
              </button>
            )}
            <button
              onClick={onCancel}
              disabled={isCancelling}
              className="ml-auto flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition disabled:opacity-40"
            >
              {isCancelling ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function RecurringPage() {
  const { isAuthenticated } = useAuthStore();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<RecurringSchedule | null>(null);

  const {
    data: schedules = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery<RecurringSchedule[]>({
    queryKey: ["my-recurring-schedules"],
    queryFn: () => api.get("/recurring/mine").then((r) => r.data),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => api.get("/categories").then((r) => r.data),
    staleTime: 300_000,
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => api.post(`/recurring/${id}/pause`),
    onSuccess: () => {
      toast.info("Schedule paused.");
      qc.invalidateQueries({ queryKey: ["my-recurring-schedules"] });
    },
    onError: (e: unknown) =>
      toast.error(
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed",
      ),
  });
  const resumeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/recurring/${id}/resume`),
    onSuccess: () => {
      toast.success("✅ Schedule resumed!");
      qc.invalidateQueries({ queryKey: ["my-recurring-schedules"] });
    },
    onError: (e: unknown) =>
      toast.error(
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed",
      ),
  });
  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/recurring/${id}`),
    onSuccess: () => {
      toast.info("Schedule cancelled.");
      qc.invalidateQueries({ queryKey: ["my-recurring-schedules"] });
      setCancelTarget(null);
    },
    onError: (e: unknown) =>
      toast.error(
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed",
      ),
  });

  const active = schedules.filter((s) => s.is_active);
  const inactive = schedules.filter((s) => !s.is_active);
  const totalSessions = schedules.reduce((sum, s) => sum + (s.total_sessions ?? 0), 0);
  const monthlySpend = active.reduce((sum, s) => {
    const mult = s.frequency === "weekly" ? 4 : s.frequency === "biweekly" ? 2 : 1;
    return sum + s.budget_per_session * mult;
  }, 0);

  return (
    <div className="min-h-dvh bg-muted/30 pb-16">
      <Header />
      <main className="mx-auto max-w-4xl px-4 pt-8 sm:pt-12">
        <Link
          to="/jobs/mine"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to My Jobs
        </Link>

        {/* Hero */}
        <div className="mb-8 rounded-3xl bg-gradient-to-br from-primary via-primary/90 to-green-700 p-6 text-white shadow-xl">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-extrabold">🔄 Recurring Jobs</h1>
              <p className="mt-1 text-sm text-white/80 max-w-sm">
                Set up weekly, biweekly, or monthly bookings. HandyRwanda auto-schedules them — no
                more re-posting the same job.
              </p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-2xl bg-white/20 border border-white/30 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/30 transition backdrop-blur-sm"
            >
              <Plus className="h-4 w-4" /> New Schedule
            </button>
          </div>

          {schedules.length > 0 && (
            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                { label: "Active Schedules", val: active.length },
                { label: "Sessions Completed", val: totalSessions },
                { label: "Est. Monthly Spend", val: `${formatRWF(monthlySpend)} RWF` },
              ].map(({ label, val }) => (
                <div
                  key={label}
                  className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-3"
                >
                  <p className="text-2xl font-extrabold text-white">{val}</p>
                  <p className="text-xs text-white/70 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center py-24 gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Loading schedules…</p>
          </div>
        ) : schedules.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card p-16 text-center">
            <div className="mx-auto w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center text-4xl mb-5">
              🔄
            </div>
            <h2 className="text-xl font-extrabold text-foreground mb-2">
              No recurring schedules yet
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-8">
              Create your first recurring job and never re-post the same service again. Perfect for
              cleaning, gardening, tutoring, and more.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-extrabold text-primary-foreground hover:brightness-95 transition"
            >
              <Plus className="h-4 w-4" /> Create First Schedule
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-extrabold text-foreground">
                Active Schedules{" "}
                <span className="text-muted-foreground font-normal text-sm">({active.length})</span>
              </h2>
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition disabled:opacity-40"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 mb-8">
              {active.map((s) => (
                <ScheduleCard
                  key={s.id}
                  schedule={s}
                  categories={categories}
                  onPause={() => pauseMutation.mutate(s.id)}
                  onResume={() => resumeMutation.mutate(s.id)}
                  onCancel={() => setCancelTarget(s)}
                  isPausing={pauseMutation.isPending && pauseMutation.variables === s.id}
                  isResuming={resumeMutation.isPending && resumeMutation.variables === s.id}
                  isCancelling={cancelMutation.isPending && cancelMutation.variables === s.id}
                />
              ))}
            </div>

            {inactive.length > 0 && (
              <>
                <h2 className="font-extrabold text-muted-foreground mb-4">
                  Paused / Cancelled{" "}
                  <span className="font-normal text-sm">({inactive.length})</span>
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {inactive.map((s) => (
                    <ScheduleCard
                      key={s.id}
                      schedule={s}
                      categories={categories}
                      onPause={() => pauseMutation.mutate(s.id)}
                      onResume={() => resumeMutation.mutate(s.id)}
                      onCancel={() => setCancelTarget(s)}
                      isPausing={false}
                      isResuming={resumeMutation.isPending && resumeMutation.variables === s.id}
                      isCancelling={false}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Benefits section */}
        <div className="mt-10 rounded-3xl border border-primary/20 bg-primary/5 p-6">
          <h3 className="font-extrabold text-primary mb-4">💡 Why use recurring jobs?</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: "⚡",
                title: "Auto-booked",
                desc: "Your preferred artisan is automatically re-booked each time — no manual re-posting.",
              },
              {
                icon: "🤝",
                title: "Build trust",
                desc: "Consistent artisans learn your preferences and deliver better service over time.",
              },
              {
                icon: "💰",
                title: "Stable pricing",
                desc: "Lock in a price per session. No surprise quotes each time.",
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <span className="text-2xl">{icon}</span>
                <div>
                  <p className="font-bold text-sm text-foreground">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <CreateScheduleModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        categories={categories}
      />

      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{cancelTarget?.title}</strong> will stop recurring. This cannot be undone —
              you'll need to create a new schedule to restart it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelTarget && cancelMutation.mutate(cancelTarget.id)}
              className="bg-destructive text-destructive-foreground hover:brightness-95"
            >
              {cancelMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Cancel Schedule"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
