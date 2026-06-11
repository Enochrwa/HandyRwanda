// File: web/src/routes/referrals.tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Gift,
  Copy,
  Share2,
  Users,
  TrendingUp,
  Wallet,
  Trophy,
  CheckCircle2,
  Clock,
  ChevronRight,
  Star,
  Zap,
  Info,
} from "lucide-react";
import { Header } from "@/components/Header";
import { useAuthStore } from "@/store/authStore";
import { useQuery } from "@tanstack/react-query";
import referralService, {
  type ReferralStats,
  type LeaderboardEntry,
  type ReferralHistoryEntry,
} from "@/services/referralService";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/referrals")({
  head: () => ({
    meta: [
      { title: "Referral Program — HandyRwanda" },
      {
        name: "description",
        content: "Invite friends and earn 500 RWF credit for every completed booking.",
      },
    ],
  }),
  component: ReferralsPage,
});

// ── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "text-primary",
  bg = "bg-primary/10",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  bg?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${bg} mb-3`}>
        <Icon size={20} className={color} />
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-sm font-medium text-foreground mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function TierBadge({ tier }: { tier: ReferralStats["tier"] }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold" +
        " bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" +
        " border border-amber-200 dark:border-amber-700"
      }
    >
      <span>{tier.icon}</span>
      {tier.name}
    </span>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 100;
  return (
    <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-700"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function ReferralCodeCard({ stats }: { stats: ReferralStats }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(stats.referral_link);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShare = async () => {
    const text = [
      `Join HandyRwanda! Find trusted artisans near you.`,
      `Use my code ${stats.referral_code} for 500 RWF off your first booking.`,
      stats.referral_link,
    ].join("\n");
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join HandyRwanda!", text, url: stats.referral_link });
      } catch {
        /* user cancelled */
      }
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Share text copied to clipboard!");
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-0.5 shadow-lg">
      <div className="rounded-[14px] bg-card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
            <Gift size={20} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Your Referral Code</h2>
            <p className="text-xs text-muted-foreground">
              Share and earn 500 RWF per qualified referral
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 border border-border mb-4">
          <span className="flex-1 font-mono text-2xl font-bold tracking-widest text-foreground text-center">
            {stats.referral_code}
          </span>
          <button
            onClick={handleCopy}
            className={
              "flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary" +
              " text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            }
          >
            {copied ? <CheckCircle2 size={15} /> : <Copy size={15} />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        <p className="text-xs text-muted-foreground truncate mb-4 text-center font-mono">
          {stats.referral_link}
        </p>

        <Button
          onClick={handleShare}
          className={
            "w-full gap-2 bg-gradient-to-r from-amber-500 to-orange-500" +
            " hover:from-amber-600 hover:to-orange-600 border-0 text-white font-semibold"
          }
        >
          <Share2 size={16} />
          Share with Friends
        </Button>
      </div>
    </div>
  );
}

function TierProgress({ stats }: { stats: ReferralStats }) {
  const { tier, qualified } = stats;
  const tiers = [
    { name: "Bronze Referrer", icon: "🥉", min: 1 },
    { name: "Silver Referrer", icon: "🥈", min: 3 },
    { name: "Gold Referrer", icon: "🥇", min: 6 },
    { name: "Platinum Referrer", icon: "💎", min: 11 },
    { name: "Legend Referrer", icon: "🌟", min: 21 },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Trophy size={18} className="text-amber-500" />
          Referral Tier
        </h3>
        <TierBadge tier={tier} />
      </div>

      {tier.next_tier && (
        <>
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>{qualified} qualified</span>
            <span>
              {tier.next_tier.min} for {tier.next_tier.icon} {tier.next_tier.name}
            </span>
          </div>
          <ProgressBar value={qualified} max={tier.next_tier.min} />
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {tier.needed_for_next} more qualified referral
            {tier.needed_for_next !== 1 ? "s" : ""} to unlock <strong>{tier.next_tier.name}</strong>
          </p>
        </>
      )}

      {!tier.next_tier && (
        <p className="text-sm text-center text-amber-600 dark:text-amber-400 font-medium mt-2">
          🌟 You've reached the highest tier! Legend status.
        </p>
      )}

      <div className="mt-4 grid grid-cols-5 gap-1">
        {tiers.map((t) => {
          const reached = qualified >= t.min;
          return (
            <div
              key={t.name}
              title={t.name}
              className={
                "flex flex-col items-center p-2 rounded-xl border transition-all" +
                (reached
                  ? " border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700"
                  : " border-border bg-muted/30 opacity-40")
              }
            >
              <span className="text-lg">{t.icon}</span>
              <span className="text-[10px] text-muted-foreground mt-0.5">{t.min}+</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WalletCard({ stats }: { stats: ReferralStats }) {
  return (
    <div className="rounded-2xl border border-border bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Wallet size={18} className="text-emerald-600" />
          Wallet Balance
        </h3>
        <Badge
          variant="secondary"
          className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
        >
          Available Credit
        </Badge>
      </div>
      <p className="text-4xl font-extrabold text-emerald-700 dark:text-emerald-400">
        {stats.wallet_balance_rwf.toLocaleString()} <span className="text-lg font-medium">RWF</span>
      </p>
      <p className="text-sm text-muted-foreground mt-1">
        Automatically applied to your next booking payment
      </p>
      <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-emerald-100/60 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700">
        <Info size={14} className="text-emerald-600 shrink-0 mt-0.5" />
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          Total earned: <strong>{stats.total_earned_rwf.toLocaleString()} RWF</strong> from{" "}
          {stats.qualified} qualified referral{stats.qualified !== 1 ? "s" : ""}.
        </p>
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: Share2,
      title: "Share Your Code",
      desc: "Send your unique referral link to friends and family via WhatsApp, SMS, or social media.",
      color: "text-blue-600",
      bg: "bg-blue-100 dark:bg-blue-900/30",
    },
    {
      icon: Users,
      title: "Friend Registers",
      desc: "When they sign up using your code, they appear as a pending referral instantly.",
      color: "text-violet-600",
      bg: "bg-violet-100 dark:bg-violet-900/30",
    },
    {
      icon: CheckCircle2,
      title: "First Booking Completes",
      desc: "Once they complete their first booking, your referral qualifies automatically.",
      color: "text-emerald-600",
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
    },
    {
      icon: Wallet,
      title: "Both Earn 500 RWF",
      desc: "You and your friend each receive 500 RWF wallet credit — no waiting, instant reward.",
      color: "text-amber-600",
      bg: "bg-amber-100 dark:bg-amber-900/30",
    },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h3 className="font-semibold text-foreground mb-5 flex items-center gap-2">
        <Zap size={18} className="text-amber-500" />
        How It Works
      </h3>
      <div className="space-y-4">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-4">
            <div
              className={`shrink-0 w-10 h-10 rounded-xl ${step.bg} flex items-center justify-center`}
            >
              <step.icon size={18} className={step.color} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{step.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
            </div>
            {i < steps.length - 1 && (
              <ChevronRight size={16} className="text-muted-foreground/40 shrink-0 mt-2.5" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function LeaderboardSection({ data }: { data: LeaderboardEntry[] }) {
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h3 className="font-semibold text-foreground mb-5 flex items-center gap-2">
        <Trophy size={18} className="text-amber-500" />
        Top Referrers This Month
      </h3>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No referrals yet — be the first! 🚀
        </p>
      ) : (
        <div className="space-y-3">
          {data.map((entry) => (
            <div
              key={entry.user_id}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors"
            >
              <span className="w-7 text-center font-bold text-lg">
                {medals[entry.rank - 1] ?? `#${entry.rank}`}
              </span>
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-foreground overflow-hidden shrink-0">
                {entry.avatar_url ? (
                  <img src={entry.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  entry.full_name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{entry.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.tier.icon} {entry.tier.name}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-foreground">{entry.qualified_count}</p>
                <p className="text-xs text-muted-foreground">referrals</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HistorySection({ data }: { data: ReferralHistoryEntry[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h3 className="font-semibold text-foreground mb-5 flex items-center gap-2">
        <Users size={18} className="text-blue-500" />
        Your Referred Friends
        <Badge variant="secondary" className="ml-auto">
          {data.length}
        </Badge>
      </h3>
      {data.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
            <Gift size={24} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No referrals yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Share your code above and start earning rewards!
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:bg-muted/30 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-bold shrink-0">
                {entry.avatar_url ? (
                  <img
                    src={entry.avatar_url}
                    alt=""
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  entry.display_name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {entry.display_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(entry.registered_at).toLocaleDateString("en-RW", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {entry.status === "qualified" ? (
                  <>
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200">
                      <CheckCircle2 size={11} className="mr-1" />
                      Qualified
                    </Badge>
                    <span className="text-sm font-bold text-emerald-600">+500</span>
                  </>
                ) : (
                  <Badge variant="secondary" className="text-muted-foreground">
                    <Clock size={11} className="mr-1" />
                    Pending
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

function ReferralsPage() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) navigate({ to: "/" });
  }, [isAuthenticated, navigate]);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["referralStats"],
    queryFn: referralService.getMyStats,
    enabled: isAuthenticated,
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ["referralLeaderboard"],
    queryFn: () => referralService.getLeaderboard(10),
    enabled: isAuthenticated,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["referralHistory"],
    queryFn: referralService.getHistory,
    enabled: isAuthenticated,
  });

  if (statsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-[70vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <p className="text-sm text-muted-foreground">Loading referral dashboard…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
              <Gift size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Referral Program</h1>
              <p className="text-sm text-muted-foreground">
                Invite friends, earn 500 RWF for every completed booking
              </p>
            </div>
          </div>
        </div>

        {stats && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard
                icon={Users}
                label="Total Referred"
                value={stats.total_referred}
                sub="people invited"
                color="text-blue-600"
                bg="bg-blue-100 dark:bg-blue-900/30"
              />
              <StatCard
                icon={CheckCircle2}
                label="Qualified"
                value={stats.qualified}
                sub="first booking done"
                color="text-emerald-600"
                bg="bg-emerald-100 dark:bg-emerald-900/30"
              />
              <StatCard
                icon={Clock}
                label="Pending"
                value={stats.pending}
                sub="awaiting first booking"
                color="text-amber-600"
                bg="bg-amber-100 dark:bg-amber-900/30"
              />
              <StatCard
                icon={TrendingUp}
                label="Total Earned"
                value={`${stats.total_earned_rwf.toLocaleString()} RWF`}
                sub="lifetime referral rewards"
                color="text-violet-600"
                bg="bg-violet-100 dark:bg-violet-900/30"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <ReferralCodeCard stats={stats} />
                <WalletCard stats={stats} />
                <HowItWorks />
              </div>
              <div className="lg:col-span-3 space-y-6">
                <TierProgress stats={stats} />
                <LeaderboardSection data={leaderboard} />
                <HistorySection data={history} />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
