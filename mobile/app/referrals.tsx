// File: mobile/app/referrals.tsx
/**
 * Sprint 8 — Referral System Screen (mobile)
 *
 * Features:
 *  - Large copyable referral code card with gradient
 *  - Native share sheet (EN / RW / FR pre-written message)
 *  - Wallet balance display
 *  - Tier progress bar and badges
 *  - Leaderboard (top 10)
 *  - Referred friends history with status
 */
import {
  Gift,
  Copy,
  Share2,
  Users,
  Wallet,
  Trophy,
  CheckCircle2,
  Clock,
  Info,
} from '@icons';
import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Share,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Toast from 'react-native-toast-message';

import { isOnAuthRoute } from '../src/navigation';
import { referralService, type ReferralStats, type LeaderboardEntry, type ReferralHistoryEntry } from '../src/services/referralService';
import { useAuthStore } from '../src/store/authStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString('en-RW');

// ── Sub-components ────────────────────────────────────────────────────────────

function StatRow({ stats }: { stats: ReferralStats }) {
  const items = [
    { label: 'Total Invited', value: stats.total_referred, color: '#6366f1' },
    { label: 'Qualified', value: stats.qualified, color: '#10b981' },
    { label: 'Pending', value: stats.pending, color: '#f59e0b' },
    { label: 'Earned (RWF)', value: fmt(stats.total_earned_rwf), color: '#8b5cf6' },
  ];

  return (
    <View className="flex-row flex-wrap gap-3 mb-4">
      {items.map((item) => (
        <View
          key={item.label}
          className="flex-1 min-w-[44%] bg-card border border-border rounded-2xl p-4"
        >
          <Text className="text-xl font-extrabold text-foreground" style={{ color: item.color }}>
            {item.value}
          </Text>
          <Text className="text-xs text-muted-foreground mt-0.5">{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function ReferralCodeCard({ stats }: { stats: ReferralStats }) {
  const handleCopy = useCallback(async () => {
    try {
      await Share.share({
        message: stats.referral_link,
        title: 'HandyRwanda Referral Link',
      });
    } catch {
      /* user dismissed */
    }
    Toast.show({ type: 'success', text1: '✅ Share sheet opened!', text2: stats.referral_link });
  }, [stats.referral_link]);

  const handleShare = useCallback(async () => {
    const messages = {
      en: `Join HandyRwanda! Find trusted artisans near you.\nUse my code ${stats.referral_code} for 500 RWF off your first booking.\n${stats.referral_link}`,
      rw: `Injira muri HandyRwanda! Bonera abakozi bizewe hafi yawe.\nKoresha kode yanjye ${stats.referral_code} ubone amafaranga 500 RWF.\n${stats.referral_link}`,
      fr: `Rejoignez HandyRwanda! Trouvez des artisans de confiance près de chez vous.\nUtilisez mon code ${stats.referral_code} pour 500 RWF de réduction.\n${stats.referral_link}`,
    };

    try {
      await Share.share({
        message: messages.en,
        url: Platform.OS === 'ios' ? stats.referral_link : undefined,
        title: 'Join HandyRwanda — 500 RWF off your first booking!',
      });
    } catch {
      /* user cancelled */
    }
  }, [stats]);

  return (
    <View className="bg-card border border-border rounded-2xl overflow-hidden mb-4">
      {/* Gradient header */}
      <View
        className="p-4 pb-3"
        style={{ backgroundColor: '#f97316' }}
      >
        <View className="flex-row items-center gap-2 mb-1">
          <Gift size={18} color="white" />
          <Text className="text-white font-bold text-base">Your Referral Code</Text>
        </View>
        <Text className="text-white/80 text-xs">
          Earn {fmt(stats.reward_referrer_rwf)} RWF for every qualified referral
        </Text>
      </View>

      <View className="p-4">
        {/* Code display */}
        <View className="flex-row items-center gap-3 bg-muted rounded-xl p-4 mb-3">
          <Text className="flex-1 font-mono text-2xl font-extrabold text-foreground tracking-widest text-center">
            {stats.referral_code}
          </Text>
          <TouchableOpacity
            onPress={handleCopy}
            className="bg-primary rounded-lg px-3 py-2 flex-row items-center gap-1.5"
          >
            <Copy size={14} color="white" />
            <Text className="text-white text-xs font-semibold">Share</Text>
          </TouchableOpacity>
        </View>

        {/* Link preview */}
        <Text className="text-xs text-muted-foreground text-center mb-4 font-mono" numberOfLines={1}>
          {stats.referral_link}
        </Text>

        {/* Share */}
        <TouchableOpacity
          onPress={handleShare}
          className="flex-row items-center justify-center gap-2 rounded-xl py-3.5"
          style={{ backgroundColor: '#f97316' }}
        >
          <Share2 size={16} color="white" />
          <Text className="text-white font-bold text-sm">Share with Friends</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function WalletCard({ stats }: { stats: ReferralStats }) {
  return (
    <View
      className="rounded-2xl p-5 mb-4 border"
      style={{ backgroundColor: '#f0fdf4', borderColor: '#86efac' }}
    >
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center gap-2">
          <Wallet size={18} color="#16a34a" />
          <Text className="font-semibold text-foreground">Wallet Balance</Text>
        </View>
        <View
          className="px-2.5 py-1 rounded-full"
          style={{ backgroundColor: '#dcfce7' }}
        >
          <Text className="text-xs font-semibold" style={{ color: '#15803d' }}>Credit</Text>
        </View>
      </View>
      <Text className="text-4xl font-extrabold" style={{ color: '#16a34a' }}>
        {fmt(stats.wallet_balance_rwf)}{' '}
        <Text className="text-base font-medium">RWF</Text>
      </Text>
      <Text className="text-xs text-muted-foreground mt-1">
        Applied automatically to your next booking
      </Text>
      <View
        className="flex-row items-start gap-1.5 mt-3 p-2.5 rounded-xl"
        style={{ backgroundColor: '#dcfce7' }}
      >
        <Info size={13} color="#15803d" style={{ marginTop: 1 }} />
        <Text className="text-xs flex-1" style={{ color: '#15803d' }}>
          Lifetime earned:{' '}
          <Text className="font-bold">{fmt(stats.total_earned_rwf)} RWF</Text>
          {' '}from {stats.qualified} qualified referral{stats.qualified !== 1 ? 's' : ''}.
        </Text>
      </View>
    </View>
  );
}

function TierCard({ stats }: { stats: ReferralStats }) {
  const { tier, qualified } = stats;
  const allTiers = [
    { icon: '🥉', min: 1 },
    { icon: '🥈', min: 3 },
    { icon: '🥇', min: 6 },
    { icon: '💎', min: 11 },
    { icon: '🌟', min: 21 },
  ];

  const pct = tier.next_tier
    ? Math.min((qualified / tier.next_tier.min) * 100, 100)
    : 100;

  return (
    <View className="bg-card border border-border rounded-2xl p-5 mb-4">
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center gap-2">
          <Trophy size={18} color="#f59e0b" />
          <Text className="font-semibold text-foreground">Referral Tier</Text>
        </View>
        <View
          className="flex-row items-center gap-1.5 px-3 py-1 rounded-full"
          style={{ backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fde68a' }}
        >
          <Text>{tier.icon}</Text>
          <Text className="text-xs font-semibold" style={{ color: '#92400e' }}>{tier.name}</Text>
        </View>
      </View>

      {tier.next_tier && (
        <>
          <View className="flex-row justify-between mb-1.5">
            <Text className="text-xs text-muted-foreground">{qualified} qualified</Text>
            <Text className="text-xs text-muted-foreground">
              {tier.next_tier.icon} {tier.next_tier.min} for {tier.next_tier.name}
            </Text>
          </View>
          {/* Progress bar */}
          <View className="h-2.5 rounded-full bg-muted overflow-hidden mb-2">
            <View
              className="h-full rounded-full"
              style={{ width: `${pct}%`, backgroundColor: '#f59e0b' }}
            />
          </View>
          <Text className="text-xs text-muted-foreground text-center">
            {tier.needed_for_next} more to unlock <Text className="font-semibold">{tier.next_tier.name}</Text>
          </Text>
        </>
      )}

      {!tier.next_tier && (
        <Text className="text-sm text-center font-semibold" style={{ color: '#f59e0b' }}>
          🌟 Legend status — you're at the top!
        </Text>
      )}

      {/* Tier dots */}
      <View className="flex-row gap-2 mt-4">
        {allTiers.map((t) => {
          const reached = qualified >= t.min;
          return (
            <View
              key={t.min}
              className="flex-1 items-center py-2 rounded-xl"
              style={{
                backgroundColor: reached ? '#fef3c7' : '#f3f4f6',
                borderWidth: 1,
                borderColor: reached ? '#fde68a' : '#e5e7eb',
                opacity: reached ? 1 : 0.45,
              }}
            >
              <Text className="text-base">{t.icon}</Text>
              <Text className="text-[10px] text-muted-foreground mt-0.5">{t.min}+</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function LeaderboardCard({ data }: { data: LeaderboardEntry[] }) {
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <View className="bg-card border border-border rounded-2xl p-5 mb-4">
      <View className="flex-row items-center gap-2 mb-4">
        <Trophy size={18} color="#f59e0b" />
        <Text className="font-semibold text-foreground">Top Referrers</Text>
      </View>
      {data.length === 0 ? (
        <Text className="text-sm text-muted-foreground text-center py-4">
          No referrals yet — be the first! 🚀
        </Text>
      ) : (
        data.map((entry) => (
          <View
            key={entry.user_id}
            className="flex-row items-center gap-3 py-2.5 border-b border-border/40 last:border-0"
          >
            <Text className="w-7 text-center text-lg font-bold">
              {medals[entry.rank - 1] ?? `#${entry.rank}`}
            </Text>
            <View className="w-9 h-9 rounded-full bg-muted items-center justify-center">
              <Text className="font-bold text-foreground">
                {entry.full_name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                {entry.full_name}
              </Text>
              <Text className="text-xs text-muted-foreground">
                {entry.tier.icon} {entry.tier.name}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-sm font-bold text-foreground">{entry.qualified_count}</Text>
              <Text className="text-xs text-muted-foreground">referrals</Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function HistoryCard({ data }: { data: ReferralHistoryEntry[] }) {
  return (
    <View className="bg-card border border-border rounded-2xl p-5 mb-8">
      <View className="flex-row items-center gap-2 mb-4">
        <Users size={18} color="#6366f1" />
        <Text className="font-semibold text-foreground">Your Referred Friends</Text>
        <View className="ml-auto bg-muted rounded-full px-2.5 py-0.5">
          <Text className="text-xs font-semibold text-muted-foreground">{data.length}</Text>
        </View>
      </View>
      {data.length === 0 ? (
        <View className="items-center py-8">
          <View className="w-14 h-14 rounded-2xl bg-muted items-center justify-center mb-3">
            <Gift size={24} color="#9ca3af" />
          </View>
          <Text className="text-sm font-medium text-foreground">No referrals yet</Text>
          <Text className="text-xs text-muted-foreground mt-1 text-center">
            Share your code and start earning rewards!
          </Text>
        </View>
      ) : (
        data.map((entry) => (
          <View
            key={entry.id}
            className="flex-row items-center gap-3 py-2.5 border-b border-border/40 last:border-0"
          >
            <View className="w-9 h-9 rounded-full bg-muted items-center justify-center">
              <Text className="font-bold text-foreground text-sm">
                {entry.display_name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">{entry.display_name}</Text>
              <Text className="text-xs text-muted-foreground">
                {new Date(entry.registered_at).toLocaleDateString('en-RW', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </Text>
            </View>
            {entry.status === 'qualified' ? (
              <View className="flex-row items-center gap-1.5">
                <View
                  className="flex-row items-center gap-1 px-2 py-1 rounded-full"
                  style={{ backgroundColor: '#dcfce7' }}
                >
                  <CheckCircle2 size={11} color="#16a34a" />
                  <Text className="text-xs font-semibold" style={{ color: '#15803d' }}>Done</Text>
                </View>
                <Text className="text-sm font-bold" style={{ color: '#16a34a' }}>+500</Text>
              </View>
            ) : (
              <View
                className="flex-row items-center gap-1 px-2 py-1 rounded-full"
                style={{ backgroundColor: '#f3f4f6' }}
              >
                <Clock size={11} color="#6b7280" />
                <Text className="text-xs text-muted-foreground font-semibold">Pending</Text>
              </View>
            )}
          </View>
        ))
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ReferralsScreen() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isAuthenticated && !isOnAuthRoute(pathname)) {
      router.replace('/auth');
    }
  }, [isAuthenticated, pathname, router]);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['referralStats'],
    queryFn: referralService.getMyStats,
    enabled: isAuthenticated,
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ['referralLeaderboard'],
    queryFn: () => referralService.getLeaderboard(10),
    enabled: isAuthenticated,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['referralHistory'],
    queryFn: referralService.getHistory,
    enabled: isAuthenticated,
  });

  if (statsLoading || !stats) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#f97316" />
        <Text className="text-muted-foreground text-sm mt-3">Loading referral data…</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16 }}>
      {/* Header */}
      <View className="flex-row items-center gap-3 mb-6">
        <View
          className="w-10 h-10 rounded-xl items-center justify-center"
          style={{ backgroundColor: '#f97316' }}
        >
          <Gift size={20} color="white" />
        </View>
        <View>
          <Text className="text-xl font-bold text-foreground">Referral Program</Text>
          <Text className="text-xs text-muted-foreground">
            Earn 500 RWF for every completed booking
          </Text>
        </View>
      </View>

      <StatRow stats={stats} />
      <ReferralCodeCard stats={stats} />
      <WalletCard stats={stats} />
      <TierCard stats={stats} />
      <LeaderboardCard data={leaderboard} />
      <HistoryCard data={history} />
    </ScrollView>
  );
}
