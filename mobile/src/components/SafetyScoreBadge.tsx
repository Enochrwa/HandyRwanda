// File: mobile/src/components/SafetyScoreBadge.tsx
/**
 * Sprint 5 — Community Safety Score Badge (React Native / Expo)
 *
 * Three display variants:
 *   "full"    — Full card with gradient header, score bar, tier label + info expand
 *   "compact" — Single-line pill: emoji + score + label
 *   "dot"     — Tiny pill: emoji + score only (for list items / search results)
 *
 * Tapping the full or compact variant opens a bottom-sheet-style modal
 * explaining the score criteria and showing per-component breakdown.
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── Tier definitions ─────────────────────────────────────────────────────────

export interface ScoreTier {
  min: number;
  emoji: string;
  label: string;
  description: string;
  gradientStart: string;
  gradientEnd: string;
  textColor: string;
}

export const SCORE_TIERS: ScoreTier[] = [
  {
    min: 1000,
    emoji: '🌟',
    label: 'Legend',
    description:
      'An exceptionally rare achievement. Perfect scores across every trust signal.',
    gradientStart: '#F59E0B',
    gradientEnd: '#D97706',
    textColor: '#FFFFFF',
  },
  {
    min: 850,
    emoji: '💎',
    label: 'Elite',
    description:
      'Top-tier artisan. Highly verified, outstanding reviews, impeccable track record.',
    gradientStart: '#8B5CF6',
    gradientEnd: '#6D28D9',
    textColor: '#FFFFFF',
  },
  {
    min: 700,
    emoji: '🥇',
    label: 'Highly Trusted',
    description: 'Verified and reliable. Consistently praised by clients. Excellent choice.',
    gradientStart: '#F59E0B',
    gradientEnd: '#B45309',
    textColor: '#FFFFFF',
  },
  {
    min: 500,
    emoji: '🥈',
    label: 'Trusted',
    description: 'Verified artisan with a solid reputation and good completion record.',
    gradientStart: '#94A3B8',
    gradientEnd: '#64748B',
    textColor: '#FFFFFF',
  },
  {
    min: 300,
    emoji: '🥉',
    label: 'Registered',
    description: 'New but registered and verified. Building their reputation.',
    gradientStart: '#FB923C',
    gradientEnd: '#EA580C',
    textColor: '#FFFFFF',
  },
  {
    min: 0,
    emoji: '⭕',
    label: 'Unranked',
    description: 'Getting started. Completing profile and verification improves the score.',
    gradientStart: '#9CA3AF',
    gradientEnd: '#6B7280',
    textColor: '#FFFFFF',
  },
];

export function getScoreTier(score: number): ScoreTier {
  for (const tier of SCORE_TIERS) {
    if (score >= tier.min) return tier;
  }
  return SCORE_TIERS[SCORE_TIERS.length - 1];
}

// ── Types ────────────────────────────────────────────────────────────────────

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
  tier: { emoji: string; label: string; color: string };
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

// ── Score info modal ─────────────────────────────────────────────────────────

function ScoreInfoModal({
  visible,
  onClose,
  score,
  breakdown,
}: {
  visible: boolean;
  onClose: () => void;
  score: number;
  breakdown?: ScoreBreakdown;
}) {
  const tier = getScoreTier(score);
  const pct = Math.min((score / 1000) * 100, 100);

  const components = breakdown?.components
    ? Object.entries(breakdown.components)
    : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.modalSheet}>
          {/* Drag handle */}
          <View style={styles.dragHandle} />

          {/* Gradient-simulated header */}
          <View style={[styles.modalHeader, { backgroundColor: tier.gradientStart }]}>
            <View style={styles.modalHeaderContent}>
              <View>
                <Text style={styles.modalHeaderEyebrow}>Community Safety Score</Text>
                <View style={styles.scoreRow}>
                  <Text style={styles.scoreLarge}>{score}</Text>
                  <Text style={styles.scoreMax}>/1000</Text>
                </View>
                <View style={styles.tierRow}>
                  <Text style={styles.tierEmoji}>{tier.emoji}</Text>
                  <Text style={styles.tierLabel}>{tier.label}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            {/* Score bar */}
            <View style={styles.scoreBarTrack}>
              <View style={[styles.scoreBarFill, { width: `${pct}%` }]} />
            </View>
          </View>

          <ScrollView
            style={styles.modalBody}
            contentContainerStyle={styles.modalBodyContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.tierDescription}>{tier.description}</Text>

            {/* Component breakdown or static explainer */}
            <Text style={styles.sectionTitle}>
              {components ? 'Score Breakdown' : 'How It\'s Calculated'}
            </Text>

            {components ? (
              components.map(([key, comp]) => {
                const compPct = comp.max > 0 ? (comp.points / comp.max) * 100 : 0;
                const barColor =
                  compPct >= 80 ? '#22C55E' : compPct >= 50 ? '#F59E0B' : '#F87171';
                return (
                  <View key={key} style={styles.componentRow}>
                    <View style={styles.componentHeader}>
                      <Text style={styles.componentLabel}>{comp.label}</Text>
                      <Text style={styles.componentPoints}>
                        {Math.round(comp.points)}/{comp.max}
                      </Text>
                    </View>
                    <View style={styles.componentBar}>
                      <View
                        style={[
                          styles.componentBarFill,
                          { width: `${compPct}%`, backgroundColor: barColor },
                        ]}
                      />
                    </View>
                    <Text style={styles.componentDescription}>{comp.description}</Text>
                  </View>
                );
              })
            ) : (
              [
                { label: 'ID Verification', max: 200 },
                { label: 'Pro Verified Bonus', max: 100 },
                { label: 'Client Rating', max: 200 },
                { label: 'Job Completion Rate', max: 150 },
                { label: 'Response Rate', max: 100 },
                { label: 'On-Time Arrival Rate', max: 100 },
                { label: 'Repeat Client Rate', max: 100 },
                { label: 'Dispute-Free Record', max: 50 },
                { label: 'Account Tenure', max: 50 },
              ].map((item) => (
                <View key={item.label} style={styles.staticRow}>
                  <Text style={styles.staticRowLabel}>{item.label}</Text>
                  <Text style={styles.staticRowMax}>up to {item.max} pts</Text>
                </View>
              ))
            )}

            <View style={styles.footerNote}>
              <Text style={styles.footerText}>
                Scores are recalculated nightly. Every completed job, verified ID,
                and satisfied client improves this score.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export interface SafetyScoreBadgeProps {
  score: number;
  breakdown?: ScoreBreakdown;
  variant?: 'full' | 'compact' | 'dot';
  showInfo?: boolean;
}

export function SafetyScoreBadge({
  score,
  breakdown,
  variant = 'compact',
  showInfo = true,
}: SafetyScoreBadgeProps) {
  const [infoVisible, setInfoVisible] = useState(false);
  const tier = getScoreTier(score);
  const pct = Math.min((score / 1000) * 100, 100);

  // ── Dot ──────────────────────────────────────────────────────────────────
  if (variant === 'dot') {
    return (
      <>
        <TouchableOpacity
          onPress={showInfo ? () => setInfoVisible(true) : undefined}
          style={[styles.dotBadge, { borderColor: tier.gradientStart }]}
          activeOpacity={0.75}
        >
          <Text style={styles.dotEmoji}>{tier.emoji}</Text>
          <Text style={[styles.dotScore, { color: tier.gradientStart }]}>{score}</Text>
        </TouchableOpacity>
        {showInfo && (
          <ScoreInfoModal
            visible={infoVisible}
            onClose={() => setInfoVisible(false)}
            score={score}
            breakdown={breakdown}
          />
        )}
      </>
    );
  }

  // ── Compact ───────────────────────────────────────────────────────────────
  if (variant === 'compact') {
    return (
      <>
        <TouchableOpacity
          onPress={showInfo ? () => setInfoVisible(true) : undefined}
          style={[styles.compactBadge, { borderColor: tier.gradientStart }]}
          activeOpacity={0.75}
        >
          <Text style={styles.compactEmoji}>{tier.emoji}</Text>
          <Text style={styles.compactScore}>{score}</Text>
          <Text style={styles.compactMax}>/1000</Text>
          <Text style={styles.compactDivider}>·</Text>
          <Text style={styles.compactLabel}>{tier.label}</Text>
          {showInfo && <Text style={styles.infoIcon}>ⓘ</Text>}
        </TouchableOpacity>
        {showInfo && (
          <ScoreInfoModal
            visible={infoVisible}
            onClose={() => setInfoVisible(false)}
            score={score}
            breakdown={breakdown}
          />
        )}
      </>
    );
  }

  // ── Full ──────────────────────────────────────────────────────────────────
  return (
    <>
      <TouchableOpacity
        onPress={showInfo ? () => setInfoVisible(true) : undefined}
        style={[styles.fullCard, { borderColor: tier.gradientStart }]}
        activeOpacity={0.9}
      >
        {/* Gradient header (simulated with solid color) */}
        <View style={[styles.fullHeader, { backgroundColor: tier.gradientStart }]}>
          <View style={styles.fullHeaderContent}>
            <View>
              <Text style={styles.fullEyebrow}>Community Safety Score</Text>
              <View style={styles.scoreRow}>
                <Text style={styles.fullScore}>{score}</Text>
                <Text style={styles.fullScoreMax}>/1000</Text>
              </View>
            </View>
            <View style={styles.fullTierRight}>
              <Text style={styles.fullTierEmoji}>{tier.emoji}</Text>
              <Text style={styles.fullTierLabel}>{tier.label}</Text>
            </View>
          </View>
          {/* Progress bar */}
          <View style={styles.fullBarTrack}>
            <View style={[styles.fullBarFill, { width: `${pct}%` }]} />
          </View>
        </View>
        {/* Footer */}
        {showInfo && (
          <View style={styles.fullFooter}>
            <Text style={styles.fullFooterDesc} numberOfLines={1}>
              {tier.description.slice(0, 55)}…
            </Text>
            <Text style={styles.fullFooterCta}>Details ⓘ</Text>
          </View>
        )}
      </TouchableOpacity>
      {showInfo && (
        <ScoreInfoModal
          visible={infoVisible}
          onClose={() => setInfoVisible(false)}
          score={score}
          breakdown={breakdown}
        />
      )}
    </>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Dot ──────────────────────────────────────────────────────────
  dotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: 'transparent',
  },
  dotEmoji: { fontSize: 11 },
  dotScore: { fontSize: 11, fontWeight: '700' },

  // ── Compact ───────────────────────────────────────────────────────
  compactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  compactEmoji: { fontSize: 14 },
  compactScore: { fontSize: 13, fontWeight: '800', color: '#111' },
  compactMax: { fontSize: 11, color: '#888' },
  compactDivider: { fontSize: 11, color: '#888' },
  compactLabel: { fontSize: 12, fontWeight: '600', color: '#333' },
  infoIcon: { fontSize: 12, color: '#888', marginLeft: 2 },

  // ── Full card ─────────────────────────────────────────────────────
  fullCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    overflow: 'hidden',
  },
  fullHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  fullHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  fullEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  fullScore: { fontSize: 30, fontWeight: '900', color: '#fff' },
  fullScoreMax: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  fullTierRight: { alignItems: 'center' },
  fullTierEmoji: { fontSize: 28 },
  fullTierLabel: { fontSize: 12, fontWeight: '700', color: '#fff', marginTop: 2 },
  fullBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginTop: 10,
    overflow: 'hidden',
  },
  fullBarFill: { height: '100%', borderRadius: 3, backgroundColor: '#fff' },
  fullFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  fullFooterDesc: { fontSize: 11, color: '#888', flex: 1, marginRight: 8 },
  fullFooterCta: { fontSize: 11, fontWeight: '600', color: '#6366F1' },

  // ── Modal ─────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.88,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: { elevation: 24 },
    }),
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  modalHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalHeaderEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  scoreLarge: { fontSize: 36, fontWeight: '900', color: '#fff' },
  scoreMax: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginLeft: 2 },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  tierEmoji: { fontSize: 18 },
  tierLabel: { fontSize: 14, fontWeight: '700', color: '#fff' },
  closeBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 16,
    padding: 6,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  scoreBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginTop: 12,
    overflow: 'hidden',
  },
  scoreBarFill: { height: '100%', borderRadius: 3, backgroundColor: '#fff' },

  modalBody: { flex: 1 },
  modalBodyContent: { padding: 20, paddingBottom: 40 },
  tierDescription: { fontSize: 14, color: '#555', lineHeight: 20, marginBottom: 20 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  // Component breakdown rows
  componentRow: { marginBottom: 14 },
  componentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  componentLabel: { fontSize: 13, fontWeight: '600', color: '#222' },
  componentPoints: { fontSize: 12, fontWeight: '700', color: '#111' },
  componentBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    marginBottom: 4,
  },
  componentBarFill: { height: '100%', borderRadius: 3 },
  componentDescription: { fontSize: 11, color: '#888' },

  // Static explainer rows
  staticRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  staticRowLabel: { fontSize: 13, color: '#555' },
  staticRowMax: { fontSize: 12, fontWeight: '600', color: '#111' },

  footerNote: {
    marginTop: 20,
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
  },
  footerText: { fontSize: 12, color: '#888', lineHeight: 18 },
});
