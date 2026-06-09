// File: web/src/components/SafetyScoreBadge.tsx
/**
 * Sprint 5 — Community Safety Score Badge
 *
 * Three display variants:
 *   "full"    — Large badge with score number + tier label + description text
 *               Used on the artisan profile page header
 *   "compact" — Medium badge: emoji + score + label on one line
 *               Used in artisan cards and search results
 *   "dot"     — Tiny icon-only badge for space-constrained contexts
 *
 * Props also support showing a "What is this?" info popover.
 */

import { useState } from "react";
import { Info, X, Shield, Star, Clock, Users, CheckCircle, Award } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Tier data ─────────────────────────────────────────────────────────────────

export interface ScoreTier {
  min: number;
  max: number;
  emoji: string;
  label: string;
  description: string;
  color: string;       // Tailwind bg class
  textColor: string;   // Tailwind text class
  borderColor: string; // Tailwind border class
  ringColor: string;   // Tailwind ring class
}

export const SCORE_TIERS: ScoreTier[] = [
  {
    min: 1000,
    max: 1000,
    emoji: "🌟",
    label: "Legend",
    description: "An exceptionally rare achievement. This artisan has achieved perfection across every trust signal.",
    color: "bg-gradient-to-r from-yellow-400 to-amber-500",
    textColor: "text-white",
    borderColor: "border-yellow-400",
    ringColor: "ring-yellow-400",
  },
  {
    min: 850,
    max: 999,
    emoji: "💎",
    label: "Elite",
    description: "Top-tier artisan. Highly verified, outstanding reviews, and an impeccable track record.",
    color: "bg-gradient-to-r from-purple-500 to-violet-600",
    textColor: "text-white",
    borderColor: "border-purple-500",
    ringColor: "ring-purple-500",
  },
  {
    min: 700,
    max: 849,
    emoji: "🥇",
    label: "Highly Trusted",
    description: "Verified, reliable, and consistently praised by clients. An excellent choice.",
    color: "bg-gradient-to-r from-amber-400 to-yellow-500",
    textColor: "text-white",
    borderColor: "border-amber-400",
    ringColor: "ring-amber-400",
  },
  {
    min: 500,
    max: 699,
    emoji: "🥈",
    label: "Trusted",
    description: "A verified artisan with a solid reputation and good completion record.",
    color: "bg-gradient-to-r from-slate-400 to-zinc-500",
    textColor: "text-white",
    borderColor: "border-slate-400",
    ringColor: "ring-slate-400",
  },
  {
    min: 300,
    max: 499,
    emoji: "🥉",
    label: "Registered",
    description: "New to HandyRwanda but registered and verified. Building their reputation.",
    color: "bg-gradient-to-r from-orange-300 to-amber-400",
    textColor: "text-white",
    borderColor: "border-orange-300",
    ringColor: "ring-orange-300",
  },
  {
    min: 0,
    max: 299,
    emoji: "⭕",
    label: "Unranked",
    description: "This artisan is getting started. Encourage them to complete their profile and verification.",
    color: "bg-gradient-to-r from-gray-300 to-slate-400",
    textColor: "text-white",
    borderColor: "border-gray-300",
    ringColor: "ring-gray-300",
  },
];

export function getScoreTier(score: number): ScoreTier {
  if (score >= 1000) return SCORE_TIERS[0];
  for (const tier of SCORE_TIERS) {
    if (score >= tier.min) return tier;
  }
  return SCORE_TIERS[SCORE_TIERS.length - 1];
}

// ── Score component breakdown (from API) ─────────────────────────────────────

export interface ScoreComponent {
  points: number;
  max: number;
  label: string;
  description: string;
  raw_value?: number;
}

export interface ScoreBreakdown {
  artisan_id: string;
  total_score: number;
  max_score: number;
  tier: {
    emoji: string;
    label: string;
    color: string;
  };
  components: {
    id_verified: ScoreComponent;
    pro_verified_bonus: ScoreComponent;
    average_rating: ScoreComponent;
    completion_rate: ScoreComponent;
    response_rate: ScoreComponent;
    on_time_rate: ScoreComponent;
    repeat_client_rate: ScoreComponent;
    zero_disputes: ScoreComponent;
    account_age: ScoreComponent;
  };
}

// ── Component icons mapping ───────────────────────────────────────────────────

const COMPONENT_ICONS: Record<string, React.ReactNode> = {
  id_verified: <Shield className="h-3.5 w-3.5" />,
  pro_verified_bonus: <Award className="h-3.5 w-3.5" />,
  average_rating: <Star className="h-3.5 w-3.5" />,
  completion_rate: <CheckCircle className="h-3.5 w-3.5" />,
  response_rate: <Clock className="h-3.5 w-3.5" />,
  on_time_rate: <Clock className="h-3.5 w-3.5" />,
  repeat_client_rate: <Users className="h-3.5 w-3.5" />,
  zero_disputes: <Shield className="h-3.5 w-3.5" />,
  account_age: <CheckCircle className="h-3.5 w-3.5" />,
};

// ── Score Info Panel ──────────────────────────────────────────────────────────

function ScoreInfoPanel({
  breakdown,
  score,
  tier,
  onClose,
}: {
  breakdown?: ScoreBreakdown;
  score: number;
  tier: ScoreTier;
  onClose: () => void;
}) {
  const components = breakdown?.components;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className={cn("p-5", tier.color)}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-white/80 uppercase tracking-widest mb-1">
                Community Safety Score
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-white">{score}</span>
                <span className="text-white/60 text-sm font-medium">/1000</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-lg">{tier.emoji}</span>
                <span className="text-white font-bold text-sm">{tier.label}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full bg-white/20 p-1.5 hover:bg-white/30 transition"
            >
              <X className="h-4 w-4 text-white" />
            </button>
          </div>

          {/* Score bar */}
          <div className="mt-4 h-2 rounded-full bg-white/30 overflow-hidden">
            <div
              className="h-full rounded-full bg-white transition-all duration-700"
              style={{ width: `${Math.min((score / 1000) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Body */}
        <div className="p-5">
          <p className="text-sm text-muted-foreground mb-4">{tier.description}</p>

          {/* Component breakdown */}
          {components ? (
            <div className="space-y-2">
              <p className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
                Score Breakdown
              </p>
              {Object.entries(components).map(([key, comp]) => {
                const pct = comp.max > 0 ? (comp.points / comp.max) * 100 : 0;
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-foreground">
                        <span className="text-muted-foreground">
                          {COMPONENT_ICONS[key] ?? <CheckCircle className="h-3.5 w-3.5" />}
                        </span>
                        <span className="font-medium">{comp.label}</span>
                      </div>
                      <span className="font-bold text-foreground tabular-nums">
                        {Math.round(comp.points)}/{comp.max}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          pct >= 80 ? "bg-green-500" :
                          pct >= 50 ? "bg-amber-400" :
                          "bg-rose-400"
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
                How it's calculated
              </p>
              {[
                { label: "ID Verification", max: 200 },
                { label: "Pro Verified Bonus", max: 100 },
                { label: "Client Rating", max: 200 },
                { label: "Job Completion Rate", max: 150 },
                { label: "Response Rate", max: 100 },
                { label: "On-Time Arrival Rate", max: 100 },
                { label: "Repeat Client Rate", max: 100 },
                { label: "Dispute-Free Record", max: 50 },
                { label: "Account Tenure", max: 50 },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-semibold text-foreground">up to {item.max} pts</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Scores are recalculated nightly. Every completed job, verified ID,
              and satisfied client improves this score.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main SafetyScoreBadge component ──────────────────────────────────────────

export interface SafetyScoreBadgeProps {
  score: number;
  breakdown?: ScoreBreakdown;
  variant?: "full" | "compact" | "dot";
  showInfo?: boolean;
  className?: string;
}

export function SafetyScoreBadge({
  score,
  breakdown,
  variant = "compact",
  showInfo = true,
  className,
}: SafetyScoreBadgeProps) {
  const [infoOpen, setInfoOpen] = useState(false);
  const tier = getScoreTier(score);

  // ── Dot variant ─────────────────────────────────────────────────────────────
  if (variant === "dot") {
    return (
      <>
        <button
          title={`${tier.emoji} ${tier.label} — Score ${score}/1000`}
          onClick={showInfo ? () => setInfoOpen(true) : undefined}
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5",
            "text-[10px] font-bold tabular-nums",
            "border",
            tier.borderColor,
            "bg-card text-foreground",
            showInfo && "cursor-pointer hover:ring-2",
            showInfo && tier.ringColor,
            "transition",
            className,
          )}
        >
          <span>{tier.emoji}</span>
          <span>{score}</span>
        </button>
        {infoOpen && (
          <ScoreInfoPanel
            breakdown={breakdown}
            score={score}
            tier={tier}
            onClose={() => setInfoOpen(false)}
          />
        )}
      </>
    );
  }

  // ── Compact variant ─────────────────────────────────────────────────────────
  if (variant === "compact") {
    return (
      <>
        <button
          onClick={showInfo ? () => setInfoOpen(true) : undefined}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
            "text-xs font-semibold",
            "border",
            tier.borderColor,
            "bg-card",
            showInfo && "cursor-pointer hover:ring-2",
            showInfo && tier.ringColor,
            "transition group",
            className,
          )}
        >
          <span className="text-sm">{tier.emoji}</span>
          <span className="text-foreground font-bold tabular-nums">{score}</span>
          <span className="text-muted-foreground">/1000</span>
          <span className="text-foreground font-semibold">·</span>
          <span className="text-foreground">{tier.label}</span>
          {showInfo && (
            <Info className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition ml-0.5" />
          )}
        </button>
        {infoOpen && (
          <ScoreInfoPanel
            breakdown={breakdown}
            score={score}
            tier={tier}
            onClose={() => setInfoOpen(false)}
          />
        )}
      </>
    );
  }

  // ── Full variant ────────────────────────────────────────────────────────────
  return (
    <>
      <button
        onClick={showInfo ? () => setInfoOpen(true) : undefined}
        className={cn(
          "w-full rounded-2xl border overflow-hidden",
          tier.borderColor,
          showInfo && "cursor-pointer hover:ring-2",
          showInfo && tier.ringColor,
          "transition shadow-sm",
          className,
        )}
      >
        {/* Gradient header */}
        <div className={cn("px-5 py-4", tier.color)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-white/80 uppercase tracking-widest">
                Community Safety Score
              </p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-3xl font-black text-white tabular-nums">{score}</span>
                <span className="text-white/60 text-sm">/1000</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-3xl">{tier.emoji}</span>
              <p className={cn("text-sm font-bold mt-0.5", tier.textColor)}>{tier.label}</p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-3 h-2 rounded-full bg-white/30 overflow-hidden">
            <div
              className="h-full rounded-full bg-white"
              style={{ width: `${Math.min((score / 1000) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Footer */}
        {showInfo && (
          <div className="px-5 py-2.5 bg-card flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{tier.description.slice(0, 60)}…</p>
            <div className="flex items-center gap-1 text-xs text-primary font-medium">
              <Info className="h-3 w-3" />
              Details
            </div>
          </div>
        )}
      </button>

      {infoOpen && (
        <ScoreInfoPanel
          breakdown={breakdown}
          score={score}
          tier={tier}
          onClose={() => setInfoOpen(false)}
        />
      )}
    </>
  );
}
