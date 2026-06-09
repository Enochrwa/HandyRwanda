// File: web/src/components/safetyScoreTiers.ts
// Sprint 5 — score tier constants and helper, separated from the React component
// to satisfy react-refresh/only-export-components.

export interface ScoreTier {
  min: number;
  max: number;
  emoji: string;
  label: string;
  description: string;
  color: string;
  textColor: string;
  borderColor: string;
  ringColor: string;
}

export const SCORE_TIERS: ScoreTier[] = [
  {
    min: 1000,
    max: 1000,
    emoji: "🌟",
    label: "Legend",
    description:
      "An exceptionally rare achievement. This artisan has achieved perfection across every trust signal.",
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
    description:
      "Top-tier artisan. Highly verified, outstanding reviews, and an impeccable track record.",
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
    description:
      "This artisan is getting started. Encourage them to complete their profile and verification.",
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
