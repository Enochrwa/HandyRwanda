// File: web/src/services/referralService.ts
/**
 * Sprint 8 — Referral System API client
 */
import api from "./api";

export interface ReferralTier {
  name: string;
  icon: string;
  next_tier: { name: string; icon: string; min: number; max: number | null } | null;
  needed_for_next: number;
}

export interface ReferralStats {
  referral_code: string;
  referral_link: string;
  total_referred: number;
  qualified: number;
  pending: number;
  total_earned_rwf: number;
  wallet_balance_rwf: number;
  tier: ReferralTier;
  reward_referrer_rwf: number;
  reward_referred_rwf: number;
}

export interface ReferralHistoryEntry {
  id: string;
  display_name: string;
  avatar_url: string | null;
  status: "registered" | "qualified";
  registered_at: string;
  earned_rwf: number;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  qualified_count: number;
  total_earned_rwf: number;
  tier: ReferralTier;
}

export interface ValidateCodeResponse {
  valid: boolean;
  referrer_first_name: string;
  reward_rwf: number;
  message_en: string;
  message_rw: string;
  message_fr: string;
}

const referralService = {
  /** Get current user's referral dashboard */
  getMyStats: async (): Promise<ReferralStats> => {
    const { data } = await api.get("/referrals/me");
    return data;
  },

  /** Validate a referral code (used during registration onboarding) */
  validateCode: async (code: string): Promise<ValidateCodeResponse> => {
    const { data } = await api.post("/referrals/validate", { code });
    return data;
  },

  /** Top referrers leaderboard */
  getLeaderboard: async (limit = 10): Promise<LeaderboardEntry[]> => {
    const { data } = await api.get(`/referrals/leaderboard?limit=${limit}`);
    return data;
  },

  /** Current user's referred contacts with status */
  getHistory: async (): Promise<ReferralHistoryEntry[]> => {
    const { data } = await api.get("/referrals/history");
    return data;
  },

  /** Apply wallet credit balance to a booking */
  applyCredit: async (
    bookingId: string,
    amount: number,
  ): Promise<{ applied_rwf: number; new_wallet_balance_rwf: number; message: string }> => {
    const { data } = await api.post("/referrals/apply-credit", {
      booking_id: bookingId,
      amount,
    });
    return data;
  },
};

export default referralService;
