// File: web/src/routes/artisan/earnings.tsx
/**
 * Sprint 6 — Artisan Income Intelligence Dashboard (Web)
 *
 * A fully data-driven earnings analytics page featuring:
 *   - Period selector (week / month / year)
 *   - KPI headline cards with growth indicators
 *   - Earnings-by-day area chart (Recharts)
 *   - Category breakdown horizontal bar chart
 *   - ML-powered forecast card (LinearRegression)
 *   - District leaderboard rank
 *   - Best working hours insights
 *   - Withdrawal request panel
 *   - Transaction history
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import api from "@/services/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow, format } from "date-fns";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Trophy,
  Zap,
  Clock,
  Star,
  BarChart3,
  Banknote,
  AlertCircle,
  Wallet,
  ArrowUpRight,
  Info,
  Sparkles,
  Calendar,
  Target,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine,
} from "recharts";

export const Route = createFileRoute("/artisan/earnings")({
  component: EarningsDashboard,
});

// ── Types ──────────────────────────────────────────────────────────────────────

interface DayData {
  date: string;
  earned: number;
  jobs: number;
}

interface CategoryData {
  category: string;
  emoji: string;
  jobs: number;
  earned: number;
  pct: number;
}

interface BestHour {
  hour: number;
  jobs: number;
  earned: number;
  label: string;
}

interface ForecastData {
  next_4_weeks_forecast: number[];
  trend: "up" | "down" | "stable";
  projected_monthly: number;
  confidence: "high" | "medium" | "low";
  method: string;
  history_weeks: number;
  weekly_history: { week_label: string; earned: number }[];
}

interface EarningsData {
  period: string;
  period_start: string;
  total_earned: number;
  total_jobs: number;
  avg_job_value: number;
  best_day: DayData | null;
  best_hours: BestHour[];
  by_category: CategoryData[];
  by_day: DayData[];
  prev_period_total: number;
  growth_pct: number;
  pending_payout: number;
  projected_monthly: number;
  forecast: ForecastData;
  rating_this_period: number;
  on_time_rate: number;
}

interface Leaderboard {
  your_rank: number | null;
  total_in_district: number;
  top_10_pct: boolean;
  district: string | null;
  message?: string;
}

interface EscrowSummary {
  available_for_withdrawal: number;
  pending_release: number;
  pending_withdrawal: number;
  total_earned: number;
}

interface EscrowTransaction {
  id: string;
  amount: number;
  status: string;
  held_at: string | null;
}

interface Withdrawal {
  id: string;
  amount: number;
  momo_number: string;
  status: string;
  admin_note?: string | null;
  created_at: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const formatRWF = (n: number) =>
  new Intl.NumberFormat("rw-RW", { maximumFractionDigits: 0 }).format(n) + " RWF";

const shortRWF = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
};

const TREND_ICONS = {
  up: <TrendingUp className="h-4 w-4 text-emerald-500" />,
  down: <TrendingDown className="h-4 w-4 text-rose-500" />,
  stable: <Minus className="h-4 w-4 text-amber-500" />,
};

const CONFIDENCE_COLORS = {
  high: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-slate-100 text-slate-600",
};

const PERIOD_LABEL = {
  week: "This Week",
  month: "This Month",
  year: "This Year",
};

// ── Custom tooltip for charts ──────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-foreground">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs text-muted-foreground">
          {p.name === "earned" ? formatRWF(p.value) : `${p.value} jobs`}
        </p>
      ))}
    </div>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon,
  growth,
  accent = false,
  loading = false,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  growth?: number | null;
  accent?: boolean;
  loading?: boolean;
}) {
  if (loading) return <Skeleton className="h-28 rounded-2xl" />;

  const growthPositive = growth != null && growth > 0;
  const growthNegative = growth != null && growth < 0;

  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm transition-all hover:shadow-md ${
        accent
          ? "border-[var(--color-primary)] bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] text-white"
          : "border-border bg-card"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className={`rounded-xl p-2 ${accent ? "bg-white/20" : "bg-muted"}`}>{icon}</div>
        {growth != null && (
          <span
            className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold ${
              growthPositive
                ? "bg-emerald-100 text-emerald-700"
                : growthNegative
                  ? "bg-rose-100 text-rose-700"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            {growthPositive ? "+" : ""}
            {growth.toFixed(1)}%
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className={`text-xs font-semibold uppercase tracking-wider ${accent ? "text-white/70" : "text-muted-foreground"}`}>
          {label}
        </p>
        <p className={`mt-1 text-2xl font-black tabular-nums ${accent ? "text-white" : "text-foreground"}`}>
          {value}
        </p>
        {sub && (
          <p className={`mt-0.5 text-xs ${accent ? "text-white/60" : "text-muted-foreground"}`}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main dashboard component ───────────────────────────────────────────────────

function EarningsDashboard() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState<"week" | "month" | "year">("month");
  const [momoNumber, setMomoNumber] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: earnings, isLoading: loadingEarnings } = useQuery<EarningsData>({
    queryKey: ["artisan-income", period],
    queryFn: () => api.get(`/artisans/me/earnings?period=${period}`).then((r) => r.data as EarningsData),
    staleTime: 5 * 60 * 1000,
  });

  const { data: leaderboard, isLoading: loadingLeaderboard } = useQuery<Leaderboard>({
    queryKey: ["artisan-income-leaderboard"],
    queryFn: () => api.get("/artisans/me/earnings/leaderboard").then((r) => r.data as Leaderboard),
    staleTime: 10 * 60 * 1000,
  });

  const { data: escrow } = useQuery<EscrowSummary>({
    queryKey: ["artisan-earnings"],
    queryFn: () => api.get("/escrow/earnings").then((r) => r.data as EscrowSummary),
  });

  const { data: transactions } = useQuery<EscrowTransaction[]>({
    queryKey: ["artisan-transactions"],
    queryFn: () => api.get("/escrow/transactions").then((r) => r.data as EscrowTransaction[]),
  });

  const { data: withdrawals, refetch: refetchWithdrawals } = useQuery<Withdrawal[]>({
    queryKey: ["artisan-withdrawals"],
    queryFn: () => api.get("/escrow/withdrawals").then((r) => r.data as Withdrawal[]),
  });

  const withdraw = useMutation({
    mutationFn: () =>
      api.post("/escrow/withdraw", {
        amount: parseInt(withdrawAmount),
        momo_number: momoNumber,
      }),
    onSuccess: () => {
      toast.success("Withdrawal request submitted!", {
        description: "Admin will process within 24 hours via MoMo.",
      });
      setWithdrawAmount("");
      setMomoNumber("");
      qc.invalidateQueries({ queryKey: ["artisan-earnings"] });
      void refetchWithdrawals();
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err.response?.data?.detail ?? "Withdrawal failed");
    },
  });

  // ── Chart data assembly ───────────────────────────────────────────────────────

  const byDayChart = (earnings?.by_day ?? []).map((d) => ({
    date: d.date
      ? format(new Date(d.date), period === "year" ? "MMM" : period === "month" ? "d MMM" : "EEE")
      : d.date,
    earned: d.earned,
    jobs: d.jobs,
  }));

  const forecastChart = [
    ...(earnings?.forecast?.weekly_history?.slice(-4) ?? []).map((w) => ({
      week: w.week_label,
      earned: w.earned,
      type: "actual",
    })),
    ...(earnings?.forecast?.next_4_weeks_forecast ?? []).map((v, i) => ({
      week: `+W${i + 1}`,
      earned: Math.round(v),
      type: "forecast",
    })),
  ];

  // ── STATUS COLORS ─────────────────────────────────────────────────────────────

  const txStatusColors: Record<string, string> = {
    held: "bg-amber-100 text-amber-800",
    released: "bg-emerald-100 text-emerald-800",
    refunded: "bg-rose-100 text-rose-800",
    disputed: "bg-orange-100 text-orange-800",
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <TooltipProvider>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        {/* ── Page header ── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black text-foreground">
              <BarChart3 className="h-6 w-6 text-[var(--color-primary)]" />
              Income Intelligence
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Your earnings analytics, forecast, and performance insights
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Tabs
              value={period}
              onValueChange={(v) => setPeriod(v as "week" | "month" | "year")}
            >
              <TabsList className="rounded-xl">
                <TabsTrigger value="week" className="text-xs">Week</TabsTrigger>
                <TabsTrigger value="month" className="text-xs">Month</TabsTrigger>
                <TabsTrigger value="year" className="text-xs">Year</TabsTrigger>
              </TabsList>
            </Tabs>
            <Link
              to="/artisan/reviews"
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted transition-colors"
            >
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              Reviews
            </Link>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard
            accent
            label={`Earned ${PERIOD_LABEL[period]}`}
            value={earnings ? shortRWF(earnings.total_earned) : "—"}
            sub={earnings ? `${earnings.total_jobs} jobs completed` : undefined}
            icon={<Banknote className="h-5 w-5 text-white" />}
            growth={earnings?.growth_pct ?? null}
            loading={loadingEarnings}
          />
          <KpiCard
            label="Avg Job Value"
            value={earnings ? formatRWF(earnings.avg_job_value) : "—"}
            sub="per completed job"
            icon={<Target className="h-5 w-5 text-[var(--color-primary)]" />}
            loading={loadingEarnings}
          />
          <KpiCard
            label="Pending Payout"
            value={escrow ? shortRWF(escrow.available_for_withdrawal) : "—"}
            sub="ready to withdraw"
            icon={<Wallet className="h-5 w-5 text-violet-600" />}
            loading={loadingEarnings}
          />
          <KpiCard
            label="Rating"
            value={earnings ? `${earnings.rating_this_period.toFixed(1)} ★` : "—"}
            sub={`${Math.round((earnings?.on_time_rate ?? 0) * 100)}% on-time`}
            icon={<Star className="h-5 w-5 text-amber-500" />}
            loading={loadingEarnings}
          />
        </div>

        {/* ── Main chart row ── */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Earnings-by-day chart */}
          <Card className="overflow-hidden shadow-sm lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <Calendar className="h-4 w-4 text-[var(--color-primary)]" />
                Earnings over time
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {PERIOD_LABEL[period]}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingEarnings ? (
                <Skeleton className="h-48 rounded-xl" />
              ) : byDayChart.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                  No earnings data for this period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={byDayChart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1b5e3b" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#1b5e3b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tickFormatter={shortRWF}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                    />
                    <RechartsTooltip content={<ChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="earned"
                      stroke="#1b5e3b"
                      strokeWidth={2}
                      fill="url(#earnGrad)"
                      name="earned"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* District leaderboard */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <Trophy className="h-4 w-4 text-amber-500" />
                District Rank
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingLeaderboard ? (
                <Skeleton className="h-36 rounded-xl" />
              ) : leaderboard?.your_rank ? (
                <>
                  <div className="flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100 py-6 dark:from-amber-950/30 dark:to-amber-900/20">
                    <p className="text-5xl font-black tabular-nums text-amber-600">
                      #{leaderboard.your_rank}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-amber-700">
                      in {leaderboard.district}
                    </p>
                    <p className="mt-0.5 text-xs text-amber-600/70">
                      out of {leaderboard.total_in_district} artisans
                    </p>
                    {leaderboard.top_10_pct && (
                      <Badge className="mt-3 bg-amber-500 text-white">
                        🏆 Top 10%
                      </Badge>
                    )}
                  </div>
                  <Progress
                    value={Math.max(
                      0,
                      100 -
                        ((leaderboard.your_rank - 1) / Math.max(leaderboard.total_in_district - 1, 1)) *
                          100,
                    )}
                    className="h-2"
                  />
                  <p className="text-center text-xs text-muted-foreground">
                    Based on this month's earnings
                  </p>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl bg-muted py-8 text-center">
                  <Trophy className="mb-2 h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    {leaderboard?.message ?? "Complete a booking to appear on the leaderboard"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Category breakdown + Best hours ── */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Category breakdown */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <BarChart3 className="h-4 w-4 text-[var(--color-primary)]" />
                Top Services
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingEarnings ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 rounded-lg" />
                ))
              ) : (earnings?.by_category ?? []).length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No category data yet
                </p>
              ) : (
                (earnings?.by_category ?? []).map((cat) => (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span>{cat.emoji}</span>
                        <span className="font-medium text-foreground">{cat.category}</span>
                        <span className="text-xs text-muted-foreground">×{cat.jobs}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">
                          {formatRWF(cat.earned)}
                        </span>
                        <span className="text-xs text-muted-foreground">{cat.pct}%</span>
                      </div>
                    </div>
                    <Progress value={cat.pct} className="h-1.5" />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Best working hours */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <Clock className="h-4 w-4 text-[var(--color-primary)]" />
                Best Times to Work
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingEarnings ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 rounded-lg" />
                ))
              ) : (earnings?.best_hours ?? []).length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Not enough data yet
                </p>
              ) : (
                <>
                  {(earnings?.best_hours ?? []).map((h, idx) => (
                    <div key={h.hour} className="flex items-center gap-3">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                          idx === 0
                            ? "bg-[var(--color-primary)] text-white"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-foreground">{h.label}</span>
                          <span className="text-xs font-bold text-foreground">
                            {shortRWF(h.earned)} RWF
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{h.jobs} jobs</p>
                      </div>
                    </div>
                  ))}
                  <Separator />
                  <p className="text-xs text-muted-foreground">
                    📅 Consider prioritising availability during these peak hours
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── ML Forecast ── */}
        <Card className="overflow-hidden shadow-sm">
          <div className="border-b border-border bg-gradient-to-r from-violet-50 to-indigo-50 px-5 py-4 dark:from-violet-950/20 dark:to-indigo-950/20">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="flex items-center gap-2 font-bold text-foreground">
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  AI Earnings Forecast
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Powered by LinearRegression · Based on{" "}
                  {earnings?.forecast?.history_weeks ?? 0} weeks of history
                </p>
              </div>
              {earnings?.forecast && (
                <div className="flex items-center gap-2">
                  {TREND_ICONS[earnings.forecast.trend]}
                  <Badge
                    className={
                      CONFIDENCE_COLORS[earnings.forecast.confidence] +
                      " border-0 text-xs capitalize"
                    }
                    variant="outline"
                  >
                    {earnings.forecast.confidence} confidence
                  </Badge>
                </div>
              )}
            </div>
          </div>

          <CardContent className="pt-5">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Forecast number */}
              <div className="flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 p-6 dark:from-violet-950/20 dark:to-indigo-950/20">
                {loadingEarnings ? (
                  <Skeleton className="h-16 w-full rounded-xl" />
                ) : (
                  <>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Projected monthly
                    </p>
                    <p className="mt-2 text-3xl font-black tabular-nums text-foreground">
                      {earnings?.forecast
                        ? shortRWF(earnings.forecast.projected_monthly)
                        : "—"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {earnings?.forecast?.projected_monthly
                        ? formatRWF(earnings.forecast.projected_monthly)
                        : ""}
                    </p>
                    <p className="mt-3 text-center text-xs text-muted-foreground">
                      At your current pace, you'll earn approximately this much this month
                    </p>
                  </>
                )}
              </div>

              {/* Forecast chart */}
              <div className="lg:col-span-2">
                {loadingEarnings ? (
                  <Skeleton className="h-40 rounded-xl" />
                ) : forecastChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={forecastChart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="week"
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={shortRWF}
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                        width={36}
                      />
                      <RechartsTooltip content={<ChartTooltip />} />
                      <ReferenceLine x="+W1" stroke="#8b5cf6" strokeDasharray="4 2" label="" />
                      <Bar
                        dataKey="earned"
                        name="earned"
                        radius={[4, 4, 0, 0]}
                        fill="#1b5e3b"
                        fillOpacity={0.85}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                    Complete more jobs to unlock forecast
                  </div>
                )}
                <p className="mt-2 text-right text-xs text-muted-foreground">
                  ← Actual history &nbsp;|&nbsp; Forecast →
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Wallet & Withdrawal ── */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Wallet summary */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <Wallet className="h-4 w-4 text-[var(--color-primary)]" />
                Wallet Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                {
                  label: "Available for Withdrawal",
                  value: escrow?.available_for_withdrawal ?? 0,
                  color: "text-emerald-600",
                  icon: <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />,
                },
                {
                  label: "In Escrow (Pending Release)",
                  value: escrow?.pending_release ?? 0,
                  color: "text-amber-600",
                  icon: <Clock className="h-3.5 w-3.5 text-amber-500" />,
                },
                {
                  label: "Pending Withdrawal",
                  value: escrow?.pending_withdrawal ?? 0,
                  color: "text-blue-600",
                  icon: <Zap className="h-3.5 w-3.5 text-blue-500" />,
                },
                {
                  label: "Total Earned (All Time)",
                  value: escrow?.total_earned ?? 0,
                  color: "text-foreground",
                  icon: <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />,
                },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {item.icon}
                    {item.label}
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${item.color}`}>
                    {formatRWF(item.value)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Withdrawal request */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <Banknote className="h-4 w-4 text-[var(--color-primary)]" />
                Request Payout
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(escrow?.available_for_withdrawal ?? 0) < 1000 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-6 text-center">
                  <AlertCircle className="mb-2 h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-foreground">Minimum 1,000 RWF required</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    You currently have{" "}
                    {formatRWF(escrow?.available_for_withdrawal ?? 0)} available
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">MoMo / Airtel Number</Label>
                    <Input
                      placeholder="07XXXXXXXX"
                      value={momoNumber}
                      onChange={(e) => setMomoNumber(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Amount (RWF) — max{" "}
                      {formatRWF(escrow?.available_for_withdrawal ?? 0)}
                    </Label>
                    <Input
                      type="number"
                      placeholder="Enter amount"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)]"
                    onClick={() => withdraw.mutate()}
                    disabled={
                      withdraw.isPending ||
                      !momoNumber ||
                      !withdrawAmount ||
                      parseInt(withdrawAmount) < 1000
                    }
                  >
                    {withdraw.isPending ? "Submitting..." : "Request Payout →"}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Processed within 24 hours by admin via MoMo
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Transaction History ── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-bold">
              <Zap className="h-4 w-4 text-[var(--color-primary)]" />
              Recent Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(transactions ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No transactions yet
              </p>
            ) : (
              <div className="divide-y divide-border">
                {(transactions ?? []).slice(0, 10).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {formatRWF(t.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.held_at
                          ? formatDistanceToNow(new Date(t.held_at), { addSuffix: true })
                          : ""}
                      </p>
                    </div>
                    <Badge
                      className={`border-0 text-xs capitalize ${txStatusColors[t.status] ?? "bg-slate-100 text-slate-600"}`}
                      variant="outline"
                    >
                      {t.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Withdrawal History ── */}
        {(withdrawals ?? []).length > 0 && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <ArrowUpRight className="h-4 w-4 text-[var(--color-primary)]" />
                Payout History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border">
                {(withdrawals ?? []).map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {formatRWF(w.amount)} → {w.momo_number}
                      </p>
                      {w.admin_note && (
                        <p className="text-xs italic text-muted-foreground">{w.admin_note}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {w.created_at
                          ? formatDistanceToNow(new Date(w.created_at), { addSuffix: true })
                          : ""}
                      </p>
                    </div>
                    <Badge
                      variant={
                        w.status === "paid"
                          ? "default"
                          : w.status === "rejected"
                            ? "destructive"
                            : "secondary"
                      }
                      className="capitalize"
                    >
                      {w.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </TooltipProvider>
  );
}
