// File: web/src/types/job.ts
// Shared Job types used across web routes and components.

export interface JobAddress {
  province?: string;
  district?: string;
  sector?: string;
  cell?: string;
  village?: string;
  street_road?: string;
  house_number?: string;
  landmark?: string;
}

export interface Job {
  id: string;
  client_id?: string;
  category_id?: string;
  title: string;
  description: string;
  additional_notes?: string;
  budget?: number;
  budget_negotiable?: boolean;
  // Geo
  latitude?: number;
  longitude?: number;
  location_label?: string;
  // Structured address
  address?: JobAddress;
  // Scheduling
  scheduled_time?: string;
  urgency?: string;
  // State
  status?: string;
  bid_count?: number;
  images?: string[];
  category?: { id?: string; name_en: string; name_rw?: string; icon_emoji?: string };
  created_at?: string;
  updated_at?: string;
}
