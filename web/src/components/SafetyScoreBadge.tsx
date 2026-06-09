// File: web/src/components/SafetyScoreBadge.tsx
/**
 * Sprint 5 — Community Safety Score Badge
 *
 * Three display variants:
 *   "full"    — Large badge with score number + tier label + description text
 *   "compact" — Medium badge: emoji + score + label on one line
 *   "dot"     — Tiny icon-only badge for space-constrained contexts
 */

import { useState } from "react";
import { Info, X, Shield, Star, Clock, Users, CheckCircle, Award } from "lucide-react";
import { cn } from "@/lib/utils";

// Tier constants imported from dedicated file (react-refresh compliance)
import { getScoreTier } from "./safetyScoreTiers";
import type { ScoreTier } from "./safetyScoreTiers";

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
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className={cn("p-5", tier.color)}>
          <div className="flex items-start justify-between">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/80">
                Community Safety Score
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-white">{score}</span>
                <span className="text-sm font-medium text-white/60">/1000</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-lg">{tier.emoji}</span>
                <span className="text-sm font-bold text-white">{tier.label}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full bg-white/20 p-1.5 transition hover:bg-white/30"
            >
              <X className="h-4 w-4 text-white" />
            </button>
          </div>

          {/* Score bar */}
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/30">
            <div
              className="h-full rounded-full bg-white transition-all duration-700"
              style={{ width: `${Math.min((score / 1000) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Body */}
        <div className="p-5">
          <p className="mb-4 text-sm text-muted-foreground">{tier.description}</p>

          {/* Component breakdown */}
          {components ? (
            <div className="space-y-2">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-foreground">
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
                      <span className="font-bold tabular-nums text-foreground">
                        {Math.round(comp.points)}/{comp.max}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-amber-400" : "bg-rose-400",
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
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-foreground">
                How it&apos;s calculated
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

          <div className="mt-4 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              Scores are recalculated nightly. Every completed job, verified ID, and satisfied
              client improves this score.
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
            "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5",
            "text-[10px] font-bold tabular-nums",
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
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
            "text-xs font-semibold",
            tier.borderColor,
            "bg-card",
            showInfo && "cursor-pointer hover:ring-2",
            showInfo && tier.ringColor,
            "group transition",
            className,
          )}
        >
          <span className="text-sm">{tier.emoji}</span>
          <span className="font-bold tabular-nums text-foreground">{score}</span>
          <span className="text-muted-foreground">/1000</span>
          <span className="font-semibold text-foreground">·</span>
          <span className="text-foreground">{tier.label}</span>
          {showInfo && (
            <Info className="ml-0.5 h-3 w-3 text-muted-foreground transition group-hover:text-foreground" />
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
          "w-full overflow-hidden rounded-2xl border",
          tier.borderColor,
          showInfo && "cursor-pointer hover:ring-2",
          showInfo && tier.ringColor,
          "shadow-sm transition",
          className,
        )}
      >
        {/* Gradient header */}
        <div className={cn("px-5 py-4", tier.color)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-white/80">
                Community Safety Score
              </p>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-3xl font-black tabular-nums text-white">{score}</span>
                <span className="text-sm text-white/60">/1000</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-3xl">{tier.emoji}</span>
              <p className={cn("mt-0.5 text-sm font-bold", tier.textColor)}>{tier.label}</p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/30">
            <div
              className="h-full rounded-full bg-white"
              style={{ width: `${Math.min((score / 1000) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Footer */}
        {showInfo && (
          <div className="flex items-center justify-between bg-card px-5 py-2.5">
            <p className="text-xs text-muted-foreground">{tier.description.slice(0, 60)}…</p>
            <div className="flex items-center gap-1 text-xs font-medium text-primary">
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
