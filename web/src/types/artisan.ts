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
  verified: boolean;
  pro: boolean;
  availableNow: boolean;
  district: string;
  languages: string[];
  experienceYears: number;
  bio: string;
  responseTime: string;
  weeklyBookings: number;
};

export type Category = {
  name: string;
  rw: string;
  icon: string;
  count: number;
};

export type Review = {
  id: number;
  name: string;
  rating: number;
  daysAgo: number;
  text: string;
  reply: string | null;
};
