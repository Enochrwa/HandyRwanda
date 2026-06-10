// File: mobile/app/(artisan)/earnings.tsx
/**
 * Sprint 6 — Artisan Income Intelligence Dashboard (Mobile)
 *
 * Full-featured earnings analytics screen with:
 *   - Period toggle (Week / Month / Year)
 *   - Animated KPI headline cards
 *   - SVG bar chart for earnings-by-day
 *   - Category breakdown with animated progress bars
 *   - ML forecast card with trend indicator
 *   - District leaderboard rank
 *   - Best working hours
 *   - Wallet summary + withdrawal flow
 *   - Transaction + payout history
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { useState, useRef } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import Svg, { Rect, G, Text as SvgText, Line, Defs, LinearGradient, Stop, Path } from 'react-native-svg';

import api from '../../src/services/api';

// ── Types ──────────────────────────────────────────────────────────────────────

interface DayData { date: string; earned: number; jobs: number; }
interface CategoryData { category: string; emoji: string; jobs: number; earned: number; pct: number; }
interface BestHour { hour: number; jobs: number; earned: number; label: string; }
interface ForecastData {
  next_4_weeks_forecast: number[];
  trend: 'up' | 'down' | 'stable';
  projected_monthly: number;
  confidence: 'high' | 'medium' | 'low';
  method: string;
  history_weeks: number;
  weekly_history: { week_label: string; earned: number }[];
}
interface EarningsData {
  period: string;
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

// ── Helpers ────────────────────────────────────────────────────────────────────

const formatRWF = (n: number) =>
  new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 }).format(n) + ' RWF';

const shortRWF = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
};

const BRAND = '#1B5E3B';
const BRAND_LIGHT = '#2E7D4F';
const ACCENT = '#E8A020';
const SCREEN_W = Dimensions.get('window').width - 32; // 16px padding each side

// ── Period selector ────────────────────────────────────────────────────────────

function PeriodToggle({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const PERIODS = [
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'year', label: 'Year' },
  ];
  return (
    <View style={styles.periodRow}>
      {PERIODS.map((p) => (
        <TouchableOpacity
          key={p.key}
          style={[styles.periodBtn, value === p.key && styles.periodBtnActive]}
          onPress={() => onChange(p.key)}
          activeOpacity={0.75}
        >
          <Text style={[styles.periodBtnText, value === p.key && styles.periodBtnTextActive]}>
            {p.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  growth,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  growth?: number | null;
  accent?: boolean;
}) {
  const growthPositive = growth != null && growth > 0;
  const growthNegative = growth != null && growth < 0;

  return (
    <View
      style={[
        styles.kpiCard,
        accent && { backgroundColor: BRAND, borderColor: BRAND_LIGHT },
      ]}
    >
      <Text style={[styles.kpiLabel, accent && { color: 'rgba(255,255,255,0.7)' }]}>
        {label}
      </Text>
      <Text style={[styles.kpiValue, accent && { color: '#fff' }]}>{value}</Text>
      {sub && (
        <Text style={[styles.kpiSub, accent && { color: 'rgba(255,255,255,0.6)' }]}>{sub}</Text>
      )}
      {growth != null && (
        <View
          style={[
            styles.growthBadge,
            growthPositive
              ? styles.growthPos
              : growthNegative
                ? styles.growthNeg
                : styles.growthNeutral,
          ]}
        >
          <Text
            style={[
              styles.growthText,
              growthPositive
                ? { color: '#059669' }
                : growthNegative
                  ? { color: '#DC2626' }
                  : { color: '#D97706' },
            ]}
          >
            {growthPositive ? '↑' : growthNegative ? '↓' : '–'}{' '}
            {Math.abs(growth).toFixed(1)}%
          </Text>
        </View>
      )}
    </View>
  );
}

// ── SVG Bar Chart ──────────────────────────────────────────────────────────────

function EarningsBarChart({ data }: { data: { label: string; earned: number }[] }) {
  if (!data || data.length === 0) {
    return (
      <View style={styles.emptyChart}>
        <Text style={styles.emptyText}>No data for this period</Text>
      </View>
    );
  }

  const W = SCREEN_W - 32; // inside card padding
  const H = 140;
  const LABEL_H = 20;
  const BAR_H = H - LABEL_H - 8;
  const maxVal = Math.max(...data.map((d) => d.earned), 1);
  const barW = Math.max(8, (W / data.length) - 4);

  return (
    <Svg width={W} height={H + 4}>
      <Defs>
        <LinearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={BRAND} stopOpacity="1" />
          <Stop offset="1" stopColor={BRAND} stopOpacity="0.5" />
        </LinearGradient>
      </Defs>
      {/* Reference lines */}
      {[0.25, 0.5, 0.75, 1].map((pct) => (
        <Line
          key={pct}
          x1={0}
          y1={BAR_H * (1 - pct) + 4}
          x2={W}
          y2={BAR_H * (1 - pct) + 4}
          stroke="#E5E7EB"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
      ))}
      {data.map((d, i) => {
        const barHeight = Math.max(2, (d.earned / maxVal) * BAR_H);
        const x = i * (W / data.length) + (W / data.length - barW) / 2;
        const y = BAR_H - barHeight + 4;
        return (
          <G key={i}>
            <Rect
              x={x}
              y={y}
              width={barW}
              height={barHeight}
              rx={4}
              fill="url(#barGrad)"
              opacity={d.earned === 0 ? 0.2 : 1}
            />
            {data.length <= 16 && (
              <SvgText
                x={x + barW / 2}
                y={H + 2}
                fontSize={9}
                fill="#9CA3AF"
                textAnchor="middle"
              >
                {d.label}
              </SvgText>
            )}
          </G>
        );
      })}
    </Svg>
  );
}

// ── Forecast mini chart ────────────────────────────────────────────────────────

function ForecastBarChart({
  history,
  forecast,
}: {
  history: { week_label: string; earned: number }[];
  forecast: number[];
}) {
  const recent = history.slice(-4);
  const combined = [
    ...recent.map((w) => ({ label: w.week_label, value: w.earned, isForecast: false })),
    ...forecast.map((v, i) => ({ label: `+W${i + 1}`, value: Math.round(v), isForecast: true })),
  ];
  if (combined.length === 0) return null;

  const W = SCREEN_W - 32;
  const H = 100;
  const maxVal = Math.max(...combined.map((d) => d.value), 1);
  const barW = Math.max(12, W / combined.length - 6);

  return (
    <Svg width={W} height={H + 20}>
      {combined.map((d, i) => {
        const barH = Math.max(3, (d.value / maxVal) * H);
        const x = i * (W / combined.length) + (W / combined.length - barW) / 2;
        const y = H - barH;
        return (
          <G key={i}>
            <Rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx={3}
              fill={d.isForecast ? '#8B5CF6' : BRAND}
              opacity={d.isForecast ? 0.8 : 1}
            />
            <SvgText
              x={x + barW / 2}
              y={H + 14}
              fontSize={9}
              fill={d.isForecast ? '#8B5CF6' : '#9CA3AF'}
              textAnchor="middle"
            >
              {d.label}
            </SvgText>
          </G>
        );
      })}
      {/* Divider between actual and forecast */}
      <Line
        x1={(recent.length * W) / combined.length}
        y1={0}
        x2={(recent.length * W) / combined.length}
        y2={H}
        stroke="#8B5CF6"
        strokeWidth={1}
        strokeDasharray="4 2"
      />
    </Svg>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function ArtisanEarningsScreen() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState('month');
  const [momoNumber, setMomoNumber] = useState('');
  const [amount, setAmount] = useState('');

  const {
    data: earnings,
    isLoading: loadingEarnings,
    refetch: refetchEarnings,
  } = useQuery<EarningsData>({
    queryKey: ['artisan-income', period],
    queryFn: () => api.get(`/artisans/me/earnings?period=${period}`).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: leaderboard } = useQuery<Leaderboard>({
    queryKey: ['artisan-income-leaderboard'],
    queryFn: () => api.get('/artisans/me/earnings/leaderboard').then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });

  const { data: summary } = useQuery<EscrowSummary>({
    queryKey: ['artisan-earnings'],
    queryFn: () => api.get('/escrow/earnings').then((r) => r.data),
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['artisan-transactions'],
    queryFn: () => api.get('/escrow/transactions').then((r) => r.data),
  });

  const { data: withdrawals = [], refetch: refetchWithdrawals } = useQuery({
    queryKey: ['artisan-withdrawals'],
    queryFn: () => api.get('/escrow/withdrawals').then((r) => r.data),
  });

  const withdraw = useMutation({
    mutationFn: () =>
      api.post('/escrow/withdraw', { amount: parseInt(amount, 10), momo_number: momoNumber }),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: '✅ Withdrawal submitted!', text2: 'Admin will process within 24h via MoMo.' });
      setAmount('');
      setMomoNumber('');
      qc.invalidateQueries({ queryKey: ['artisan-earnings'] });
      refetchWithdrawals();
    },
    onError: (e: any) =>
      Toast.show({ type: 'error', text1: e.response?.data?.detail || 'Withdrawal failed' }),
  });

  // ── Chart data ────────────────────────────────────────────────────────────────

  const byDayChart = (earnings?.by_day ?? []).map((d) => ({
    label: d.date
      ? format(new Date(d.date), period === 'year' ? 'MMM' : period === 'month' ? 'd' : 'EEE')
      : '',
    earned: d.earned,
  }));

  const txStatusColor = (s: string): string =>
    ({ held: '#F59E0B', released: '#10B981', refunded: '#EF4444', disputed: '#F97316' }[s] ?? '#6B7280');

  const withdrawStatusColor = (s: string): string =>
    ({ pending: '#F59E0B', processing: '#3B82F6', paid: '#10B981', rejected: '#EF4444' }[s] ?? '#6B7280');

  const trendIcon = (t: string) => (t === 'up' ? '📈' : t === 'down' ? '📉' : '➡️');

  const confidenceColor = (c: string): string =>
    ({ high: '#059669', medium: '#D97706', low: '#9CA3AF' }[c] ?? '#9CA3AF');

  const periodLabel = { week: 'This Week', month: 'This Month', year: 'This Year' }[period] ?? '';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loadingEarnings}
            onRefresh={refetchEarnings}
            tintColor={BRAND}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>📊 Income Intelligence</Text>
            <Text style={styles.headerSub}>Your earnings, analysed</Text>
          </View>
          <PeriodToggle value={period} onChange={setPeriod} />
        </View>

        {/* ── KPI Grid ── */}
        {loadingEarnings ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={BRAND} />
            <Text style={styles.loadingText}>Loading your data…</Text>
          </View>
        ) : (
          <View style={styles.kpiGrid}>
            <KpiCard
              accent
              label={`Earned ${periodLabel}`}
              value={earnings ? shortRWF(earnings.total_earned) : '—'}
              sub={earnings ? `${earnings.total_jobs} jobs` : undefined}
              growth={earnings?.growth_pct ?? null}
            />
            <KpiCard
              label="Avg Job Value"
              value={earnings ? formatRWF(earnings.avg_job_value) : '—'}
              sub="per job"
            />
            <KpiCard
              label="Available"
              value={summary ? shortRWF(summary.available_for_withdrawal) : '—'}
              sub="to withdraw"
            />
            <KpiCard
              label="Rating"
              value={earnings ? `${earnings.rating_this_period.toFixed(1)} ★` : '—'}
              sub={`${Math.round((earnings?.on_time_rate ?? 0) * 100)}% on-time`}
            />
          </View>
        )}

        {/* ── Earnings-by-day Chart ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📅 Earnings Over Time</Text>
          <Text style={styles.sectionSub}>{periodLabel}</Text>
          <View style={styles.chartBox}>
            <EarningsBarChart data={byDayChart} />
          </View>
          {earnings?.best_day && (
            <View style={styles.bestDayRow}>
              <Text style={styles.bestDayLabel}>🏅 Best day:</Text>
              <Text style={styles.bestDayValue}>
                {format(new Date(earnings.best_day.date), 'MMM d')} ·{' '}
                {formatRWF(earnings.best_day.earned)} · {earnings.best_day.jobs} jobs
              </Text>
            </View>
          )}
        </View>

        {/* ── Category Breakdown ── */}
        {(earnings?.by_category ?? []).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔧 Top Services</Text>
            {(earnings?.by_category ?? []).map((cat) => (
              <View key={cat.category} style={styles.catRow}>
                <View style={styles.catHeader}>
                  <Text style={styles.catName}>
                    {cat.emoji} {cat.category}
                    <Text style={styles.catJobs}> ×{cat.jobs}</Text>
                  </Text>
                  <Text style={styles.catEarned}>
                    {shortRWF(cat.earned)} RWF{' '}
                    <Text style={styles.catPct}>({cat.pct}%)</Text>
                  </Text>
                </View>
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, { width: `${cat.pct}%` }]} />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── AI Forecast ── */}
        <View style={[styles.section, styles.forecastSection]}>
          <View style={styles.forecastHeader}>
            <Text style={styles.sectionTitle}>✨ AI Earnings Forecast</Text>
            {earnings?.forecast && (
              <View style={styles.confidenceBadge}>
                <Text
                  style={[
                    styles.confidenceText,
                    { color: confidenceColor(earnings.forecast.confidence) },
                  ]}
                >
                  {earnings.forecast.confidence} confidence
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.sectionSub}>
            LinearRegression · {earnings?.forecast?.history_weeks ?? 0} weeks of history
          </Text>

          {/* Projected monthly big number */}
          <View style={styles.forecastBig}>
            <Text style={styles.forecastLabel}>Projected Monthly</Text>
            <Text style={styles.forecastValue}>
              {earnings?.forecast ? shortRWF(earnings.forecast.projected_monthly) : '—'} RWF
            </Text>
            <Text style={styles.forecastSub}>
              {earnings?.forecast
                ? `At your current pace ${trendIcon(earnings.forecast.trend)}`
                : ''}
            </Text>
          </View>

          {/* Forecast chart */}
          {earnings?.forecast && (
            <View style={styles.chartBox}>
              <ForecastBarChart
                history={earnings.forecast.weekly_history}
                forecast={earnings.forecast.next_4_weeks_forecast}
              />
              <View style={styles.forecastLegend}>
                <View style={styles.legendDot}>
                  <View style={[styles.dot, { backgroundColor: BRAND }]} />
                  <Text style={styles.legendText}>Actual</Text>
                </View>
                <View style={styles.legendDot}>
                  <View style={[styles.dot, { backgroundColor: '#8B5CF6' }]} />
                  <Text style={styles.legendText}>Forecast</Text>
                </View>
              </View>
            </View>
          )}

          {/* 4-week projection row */}
          {(earnings?.forecast?.next_4_weeks_forecast ?? []).length > 0 && (
            <View style={styles.forecastWeeks}>
              {earnings!.forecast.next_4_weeks_forecast.map((v, i) => (
                <View key={i} style={styles.forecastWeek}>
                  <Text style={styles.forecastWeekLabel}>+W{i + 1}</Text>
                  <Text style={styles.forecastWeekValue}>{shortRWF(Math.round(v))}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── District Leaderboard ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏆 District Rank</Text>
          {leaderboard?.your_rank ? (
            <>
              <View style={styles.rankBox}>
                <Text style={styles.rankNumber}>#{leaderboard.your_rank}</Text>
                <Text style={styles.rankDistrict}>in {leaderboard.district}</Text>
                <Text style={styles.rankTotal}>
                  out of {leaderboard.total_in_district} artisans
                </Text>
                {leaderboard.top_10_pct && (
                  <View style={styles.top10Badge}>
                    <Text style={styles.top10Text}>🏅 Top 10%</Text>
                  </View>
                )}
              </View>
              <View style={styles.progressBg}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.max(2, 100 - ((leaderboard.your_rank - 1) / Math.max(leaderboard.total_in_district - 1, 1)) * 100)}%`,
                      backgroundColor: ACCENT,
                    },
                  ]}
                />
              </View>
              <Text style={styles.rankNote}>Based on this month's completed bookings</Text>
            </>
          ) : (
            <View style={styles.rankEmpty}>
              <Text style={styles.rankEmptyText}>
                {leaderboard?.message ??
                  'Complete a booking to appear on the leaderboard'}
              </Text>
            </View>
          )}
        </View>

        {/* ── Best Hours ── */}
        {(earnings?.best_hours ?? []).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⏰ Best Times to Work</Text>
            {(earnings?.best_hours ?? []).map((h, idx) => (
              <View key={h.hour} style={styles.hourRow}>
                <View style={[styles.hourBadge, idx === 0 && { backgroundColor: BRAND }]}>
                  <Text style={[styles.hourBadgeText, idx === 0 && { color: '#fff' }]}>
                    {idx + 1}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.hourLabel}>{h.label}</Text>
                  <Text style={styles.hourSub}>{h.jobs} jobs</Text>
                </View>
                <Text style={styles.hourEarned}>{shortRWF(h.earned)} RWF</Text>
              </View>
            ))}
            <Text style={styles.hourNote}>
              💡 Stay available during these hours to maximise earnings
            </Text>
          </View>
        )}

        {/* ── Wallet Summary ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💼 Wallet</Text>
          {[
            { label: 'Available', value: summary?.available_for_withdrawal ?? 0, color: '#10B981' },
            { label: 'In Escrow', value: summary?.pending_release ?? 0, color: '#F59E0B' },
            { label: 'Pending Payout', value: summary?.pending_withdrawal ?? 0, color: '#3B82F6' },
            { label: 'Total Earned', value: summary?.total_earned ?? 0, color: '#111827' },
          ].map((item) => (
            <View key={item.label} style={styles.walletRow}>
              <Text style={styles.walletLabel}>{item.label}</Text>
              <Text style={[styles.walletValue, { color: item.color }]}>
                {formatRWF(item.value)}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Withdrawal Request ── */}
        {(summary?.available_for_withdrawal ?? 0) >= 1000 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💸 Request Payout</Text>
            <TextInput
              style={styles.input}
              placeholder="MTN / Airtel number (07XXXXXXXX)"
              placeholderTextColor="#9CA3AF"
              value={momoNumber}
              onChangeText={setMomoNumber}
              keyboardType="phone-pad"
            />
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              placeholder={`Amount in RWF (max ${formatRWF(summary?.available_for_withdrawal ?? 0)})`}
              placeholderTextColor="#9CA3AF"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />
            <TouchableOpacity
              style={[
                styles.btn,
                (!momoNumber || !amount || withdraw.isPending) && styles.btnDisabled,
              ]}
              onPress={() => withdraw.mutate()}
              disabled={!momoNumber || !amount || withdraw.isPending}
              activeOpacity={0.8}
            >
              {withdraw.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Request Payout →</Text>
              )}
            </TouchableOpacity>
            <Text style={styles.payoutNote}>Processed within 24 hours via MoMo</Text>
          </View>
        )}

        {/* ── Transaction History ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚡ Recent Transactions</Text>
          {(transactions as any[]).length === 0 ? (
            <Text style={styles.emptyText}>No transactions yet</Text>
          ) : (
            (transactions as any[]).slice(0, 10).map((t: any) => (
              <View key={t.id} style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemAmount}>{formatRWF(t.amount)}</Text>
                  <Text style={styles.itemMeta}>
                    {t.held_at
                      ? formatDistanceToNow(new Date(t.held_at), { addSuffix: true })
                      : ''}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: txStatusColor(t.status) + '20' }]}>
                  <Text style={[styles.badgeText, { color: txStatusColor(t.status) }]}>
                    {t.status}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── Payout History ── */}
        {(withdrawals as any[]).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔄 Payout History</Text>
            {(withdrawals as any[]).map((w: any) => (
              <View key={w.id} style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemAmount}>
                    {formatRWF(w.amount)} → {w.momo_number}
                  </Text>
                  {w.admin_note && <Text style={styles.itemNote}>{w.admin_note}</Text>}
                  <Text style={styles.itemMeta}>
                    {w.created_at
                      ? formatDistanceToNow(new Date(w.created_at), { addSuffix: true })
                      : ''}
                  </Text>
                </View>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: withdrawStatusColor(w.status) + '20' },
                  ]}
                >
                  <Text style={[styles.badgeText, { color: withdrawStatusColor(w.status) }]}>
                    {w.status}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F5F0' },
  content: { padding: 16, gap: 16 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    paddingBottom: 4,
  },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#111827' },
  headerSub: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },

  // Period toggle
  periodRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  periodBtn: { paddingHorizontal: 14, paddingVertical: 7 },
  periodBtnActive: { backgroundColor: BRAND },
  periodBtnText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  periodBtnTextActive: { color: '#fff' },

  // Loading
  loadingBox: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  loadingText: { fontSize: 13, color: '#9CA3AF' },

  // KPI Grid
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    gap: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  kpiLabel: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
  kpiValue: { fontSize: 22, fontWeight: '900', color: '#111827', marginTop: 2 },
  kpiSub: { fontSize: 11, color: '#9CA3AF' },
  growthBadge: { marginTop: 6, alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 20 },
  growthPos: { backgroundColor: '#D1FAE5' },
  growthNeg: { backgroundColor: '#FEE2E2' },
  growthNeutral: { backgroundColor: '#FEF3C7' },
  growthText: { fontSize: 11, fontWeight: '700' },

  // Sections
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  sectionSub: { fontSize: 12, color: '#9CA3AF', marginTop: -6 },

  // Chart
  chartBox: { alignItems: 'center', marginVertical: 4 },
  emptyChart: { height: 100, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 13, color: '#9CA3AF' },

  // Best day
  bestDayRow: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  bestDayLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  bestDayValue: { fontSize: 12, color: '#374151', fontWeight: '600' },

  // Category
  catRow: { gap: 6 },
  catHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catName: { fontSize: 13, fontWeight: '600', color: '#111827' },
  catJobs: { fontSize: 12, color: '#9CA3AF', fontWeight: '400' },
  catEarned: { fontSize: 12, fontWeight: '700', color: '#111827' },
  catPct: { color: '#9CA3AF', fontWeight: '400' },
  progressBg: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: BRAND, borderRadius: 3 },

  // Forecast
  forecastSection: { backgroundColor: '#FDFBFF', borderColor: '#E0D9F5' },
  forecastHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  confidenceBadge: { backgroundColor: '#F3F0FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  confidenceText: { fontSize: 11, fontWeight: '700' },
  forecastBig: { alignItems: 'center', paddingVertical: 16, backgroundColor: '#F3F0FF', borderRadius: 12 },
  forecastLabel: { fontSize: 11, fontWeight: '700', color: '#7C3AED', textTransform: 'uppercase', letterSpacing: 0.5 },
  forecastValue: { fontSize: 28, fontWeight: '900', color: '#111827', marginTop: 4 },
  forecastSub: { fontSize: 12, color: '#7C3AED', marginTop: 2 },
  forecastWeeks: { flexDirection: 'row', gap: 8 },
  forecastWeek: { flex: 1, backgroundColor: '#F3F0FF', borderRadius: 10, padding: 10, alignItems: 'center', gap: 2 },
  forecastWeekLabel: { fontSize: 10, color: '#8B5CF6', fontWeight: '700' },
  forecastWeekValue: { fontSize: 13, fontWeight: '800', color: '#111827' },
  forecastLegend: { flexDirection: 'row', gap: 16, justifyContent: 'center', marginTop: 4 },
  legendDot: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: '#9CA3AF' },

  // Leaderboard
  rankBox: { alignItems: 'center', backgroundColor: '#FFFBEB', borderRadius: 14, paddingVertical: 20, gap: 2 },
  rankNumber: { fontSize: 52, fontWeight: '900', color: ACCENT },
  rankDistrict: { fontSize: 14, fontWeight: '700', color: '#92400E' },
  rankTotal: { fontSize: 12, color: '#B45309' },
  top10Badge: { marginTop: 8, backgroundColor: '#F59E0B', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  top10Text: { color: '#fff', fontWeight: '700', fontSize: 12 },
  rankEmpty: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 20, alignItems: 'center' },
  rankEmptyText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },
  rankNote: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: -4 },

  // Best hours
  hourRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hourBadge: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  hourBadgeText: { fontSize: 13, fontWeight: '800', color: '#374151' },
  hourLabel: { fontSize: 13, fontWeight: '600', color: '#111827' },
  hourSub: { fontSize: 11, color: '#9CA3AF' },
  hourEarned: { fontSize: 13, fontWeight: '700', color: '#111827' },
  hourNote: { fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' },

  // Wallet
  walletRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  walletLabel: { fontSize: 13, color: '#6B7280' },
  walletValue: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },

  // Withdrawal
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  btn: {
    backgroundColor: BRAND,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  btnDisabled: { opacity: 0.5, shadowOpacity: 0 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.3 },
  payoutNote: { fontSize: 11, color: '#9CA3AF', textAlign: 'center' },

  // Transaction list
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  itemAmount: { fontSize: 14, fontWeight: '600', color: '#111827' },
  itemMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  itemNote: { fontSize: 12, color: '#6B7280', fontStyle: 'italic' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
});
