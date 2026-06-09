// File: web/src/routes/admin/scores.tsx
/**
 * Sprint 5 — Admin: Community Safety Score Management
 *
 * Provides admin tools for:
 *   - Triggering manual score recalculation across all artisans
 *   - Viewing individual artisan score breakdowns
 *   - Applying manual score overrides (with mandatory reason)
 *   - Viewing score distribution across the platform
 */

import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  RefreshCw,
  Search,
  ChevronDown,
  Shield,
  AlertCircle,
  CheckCircle2,
  Edit3,
  Loader2,
  TrendingUp,
  Users,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import { toast } from "sonner";
import { SafetyScoreBadge } from "@/components/SafetyScoreBadge";
import { getScoreTier, SCORE_TIERS } from "@/components/safetyScoreTiers";
import type { ScoreBreakdown } from "@/components/SafetyScoreBadge";

export const Route = createFileRoute("/admin/scores")({
  component: AdminScoresPage,
});

// ── Artisan search result type ────────────────────────────────────────────────

interface ArtisanRow {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  district?: string | null;
  average_rating: number;
  total_reviews: number;
  verification_status: string;
  community_score: number;
}

// ── Score override modal ──────────────────────────────────────────────────────

function ScoreOverrideModal({ artisan, onClose }: { artisan: ArtisanRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [adjustment, setAdjustment] = useState("");
  const [reason, setReason] = useState("");
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const { data: breakdown, isLoading: breakdownLoading } = useQuery<ScoreBreakdown>({
    queryKey: ["admin-score-breakdown", artisan.id],
    queryFn: () => api.get(`/admin/artisans/${artisan.id}/score`).then((r) => r.data),
    enabled: breakdownOpen,
  });

  const overrideMutation = useMutation({
    mutationFn: (payload: { adjustment: number; reason: string }) =>
      api.patch(`/admin/artisans/${artisan.id}/score`, payload).then((r) => r.data),
    onSuccess: (data: { previous_score: number; new_score: number; adjustment: number }) => {
      toast.success(
        `Score updated: ${data.previous_score} → ${data.new_score} (${data.adjustment > 0 ? "+" : ""}${data.adjustment})`,
      );
      qc.invalidateQueries({ queryKey: ["admin-artisans"] });
      onClose();
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err?.response?.data?.detail ?? "Failed to update score");
    },
  });

  const adj = parseInt(adjustment, 10);
  const isValid = !isNaN(adj) && adj !== 0 && reason.trim().length >= 10;
  const newScore = isValid ? Math.max(0, Math.min(1000, artisan.community_score + adj)) : null;
  const tier = getScoreTier(artisan.community_score);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="border-b border-border px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-muted">
              {artisan.avatar_url ? (
                <img src={artisan.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-bold text-muted-foreground">
                  {artisan.full_name[0]}
                </div>
              )}
            </div>
            <div>
              <h2 className="font-bold text-foreground">{artisan.full_name}</h2>
              <div className="mt-0.5 flex items-center gap-2">
                <SafetyScoreBadge score={artisan.community_score} variant="dot" showInfo={false} />
                <span className="text-xs text-muted-foreground">{artisan.district}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-6">
          {/* Score breakdown toggle */}
          <button
            onClick={() => setBreakdownOpen(!breakdownOpen)}
            className="flex w-full items-center justify-between rounded-xl border border-primary/20 px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/5"
          >
            <span className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Score Breakdown
            </span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${breakdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          {breakdownOpen && (
            <div className="overflow-hidden rounded-xl border border-border">
              {breakdownLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                breakdown && (
                  <div className="space-y-2 p-4">
                    {Object.entries(breakdown.components).map(([key, comp]) => {
                      const pct = comp.max > 0 ? (comp.points / comp.max) * 100 : 0;
                      return (
                        <div key={key}>
                          <div className="mb-1 flex justify-between text-xs">
                            <span className="text-muted-foreground">{comp.label}</span>
                            <span className="font-bold">
                              {Math.round(comp.points)}/{comp.max}
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full ${pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-amber-400" : "bg-rose-400"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          )}

          {/* Adjustment input */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">
              Score Adjustment{" "}
              <span className="font-normal text-muted-foreground">(positive or negative)</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={adjustment}
                onChange={(e) => setAdjustment(e.target.value)}
                placeholder="e.g. +50 or -30"
                className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {newScore !== null && (
                <div className="flex items-center gap-1.5 whitespace-nowrap text-sm font-bold">
                  <span className="text-muted-foreground">{artisan.community_score}</span>
                  <span>→</span>
                  <span className={adj > 0 ? "text-green-600" : "text-rose-600"}>{newScore}</span>
                </div>
              )}
            </div>
          </div>

          {/* Reason input */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">
              Reason{" "}
              <span className="font-normal text-muted-foreground">
                (min 10 characters — required for audit trail)
              </span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Artisan was robbed — disputed bookings not their fault. Reverting penalty."
              rows={3}
              className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-right text-xs text-muted-foreground">
              {reason.length} / min 10 chars
            </p>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-xs text-amber-700">
              Manual overrides are logged and sent as a notification to the artisan. Use only for
              documented edge cases.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold transition hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={() => overrideMutation.mutate({ adjustment: adj, reason: reason.trim() })}
              disabled={!isValid || overrideMutation.isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {overrideMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Apply Override
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function AdminScoresPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedArtisan, setSelectedArtisan] = useState<ArtisanRow | null>(null);
  const [recalcConfirm, setRecalcConfirm] = useState(false);

  const { data: artisans = [], isLoading } = useQuery<ArtisanRow[]>({
    queryKey: ["admin-artisans"],
    queryFn: () =>
      api
        .get("/artisans", { params: { limit: 200, sort: "score" } })
        .then((r) => (r.data.items ?? r.data) as ArtisanRow[]),
  });

  const recalcMutation = useMutation({
    mutationFn: () => api.post("/admin/scores/recalculate").then((r) => r.data),
    onSuccess: (data: { recalculated: number }) => {
      toast.success(`Recalculation complete — ${data.recalculated} artisans updated`);
      qc.invalidateQueries({ queryKey: ["admin-artisans"] });
      setRecalcConfirm(false);
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err?.response?.data?.detail ?? "Recalculation failed");
    },
  });

  const filtered = artisans.filter((a) =>
    a.full_name?.toLowerCase().includes(search.toLowerCase()),
  );

  // Score distribution stats
  const distribution = SCORE_TIERS.slice()
    .reverse()
    .map((tier) => {
      const count = artisans.filter((a) => {
        const t = getScoreTier(a.community_score ?? 0);
        return t.label === tier.label;
      }).length;
      return { ...tier, count };
    });

  return (
    <div className="min-h-dvh bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-border bg-card/80 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/admin/verification"
              className="text-muted-foreground transition hover:text-foreground"
            >
              ← Admin
            </Link>
            <span className="text-muted-foreground">/</span>
            <h1 className="font-extrabold text-foreground">Safety Scores</h1>
          </div>

          {/* Recalculate all button */}
          {recalcConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Recalculate all?</span>
              <button
                onClick={() => recalcMutation.mutate()}
                disabled={recalcMutation.isPending}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition hover:brightness-95 disabled:opacity-50"
              >
                {recalcMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Confirm
              </button>
              <button
                onClick={() => setRecalcConfirm(false)}
                className="rounded-xl border border-border px-4 py-2 text-sm font-semibold transition hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setRecalcConfirm(true)}
              className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold transition hover:bg-muted"
            >
              <RefreshCw className="h-4 w-4" />
              Recalculate All
            </button>
          )}
        </div>
      </div>

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-8">
        {/* Distribution cards */}
        <div>
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Score Distribution</h2>
            <span className="text-sm text-muted-foreground">
              ({artisans.length} artisans total)
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {distribution.map((tier) => (
              <div
                key={tier.label}
                className="rounded-2xl border border-border bg-card p-4 text-center shadow-sm"
              >
                <span className="text-2xl">{tier.emoji}</span>
                <p className="mt-1 text-2xl font-black tabular-nums">{tier.count}</p>
                <p className="text-xs font-medium text-muted-foreground">{tier.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Search + table */}
        <div>
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Artisan Scores</h2>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by artisan name…"
              className="w-full rounded-2xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                      Artisan
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                      Score
                    </th>
                    <th className="hidden px-4 py-3 text-center font-semibold text-muted-foreground sm:table-cell">
                      Tier
                    </th>
                    <th className="hidden px-4 py-3 text-center font-semibold text-muted-foreground md:table-cell">
                      Rating
                    </th>
                    <th className="hidden px-4 py-3 text-center font-semibold text-muted-foreground md:table-cell">
                      Verification
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((artisan) => {
                    const score = artisan.community_score ?? 0;
                    const tier = getScoreTier(score);
                    const verColor =
                      artisan.verification_status === "pro_verified"
                        ? "text-purple-600"
                        : artisan.verification_status === "id_verified"
                          ? "text-green-600"
                          : "text-muted-foreground";
                    const verLabel =
                      artisan.verification_status === "pro_verified"
                        ? "Pro"
                        : artisan.verification_status === "id_verified"
                          ? "Verified"
                          : "Unverified";

                    return (
                      <tr key={artisan.id} className="group transition hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-muted">
                              {artisan.avatar_url ? (
                                <img
                                  src={artisan.avatar_url}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs font-bold text-muted-foreground">
                                  {artisan.full_name?.[0]}
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-semibold leading-tight text-foreground">
                                {artisan.full_name}
                              </p>
                              <p className="text-xs text-muted-foreground">{artisan.district}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-base font-black tabular-nums">{score}</span>
                          <span className="text-xs text-muted-foreground">/1000</span>
                        </td>
                        <td className="hidden px-4 py-3 text-center sm:table-cell">
                          <span title={tier.label}>
                            {tier.emoji} {tier.label}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 text-center md:table-cell">
                          ⭐ {artisan.average_rating?.toFixed(1) ?? "—"}
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({artisan.total_reviews})
                          </span>
                        </td>
                        <td
                          className={`hidden px-4 py-3 text-center text-xs font-semibold md:table-cell ${verColor}`}
                        >
                          {verLabel}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setSelectedArtisan(artisan)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold opacity-0 transition hover:bg-muted group-hover:opacity-100"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            Override
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                        No artisans found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Override modal */}
      {selectedArtisan && (
        <ScoreOverrideModal artisan={selectedArtisan} onClose={() => setSelectedArtisan(null)} />
      )}
    </div>
  );
}
