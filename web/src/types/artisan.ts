// File: web/src/types/artisan.ts
export type Artisan = {
  id: string;
  name: string;
  photo: string;
  category: string;
  categories: string[];
  rating: number;
  reviews: number;
  jobs: number;
  distanceKm: number;
  startingPrice: number;
  hourlyRate?: number;
  verified: boolean;
  pro: boolean;
  availableNow: boolean;
  // Full Rwanda address hierarchy
  province?: string;
  district: string;
  sector?: string;
  cell?: string;
  village?: string;
  languages: string[];
  experienceYears: number;
  bio: string;
  responseTime: string;
  weeklyBookings: number;
  momoPhone?: string;
  lat?: number;
  lng?: number;
  location_label?: string;
};

export type Category = {
  id?: string;
  name: string;
  name_en?: string;
  name_rw?: string;
  rw: string;
  icon: string;
  icon_emoji?: string;
  count: number;
  is_active?: boolean;
};

export type Review = {
  id: number | string;
  name: string;
  rating: number;
  daysAgo?: number;
  text?: string;
  comment?: string;
  reply: string | null;
  artisan_reply?: string | null;
  client_name?: string;
  client_avatar?: string;
  created_at?: string;
};

// Sprint 10 — Skill Verification Video types

export type SkillVideo = {
  id: string;
  artisan_id: string;
  category_id?: string;
  category_name?: string;
  video_url: string;
  thumbnail_url?: string;
  title: string;
  description?: string;
  duration_seconds?: number;
  is_approved: boolean;
  rejection_reason?: string;
  view_count: number;
  created_at: string;
};

export type ArtisanPublicProfile = {
  id: string;
  full_name: string;
  avatar_url?: string;
  bio?: string;
  rating: number;
  total_reviews: number;
  hourly_rate?: number;
  skills: string[];
  portfolio: { id: string; image_url: string; job_type?: string; description?: string }[];
  skill_videos: SkillVideo[];
  reviews: Review[];
};
