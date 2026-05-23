import jean from "@/assets/artisan-jean.jpg";
import marie from "@/assets/artisan-marie.jpg";
import eric from "@/assets/artisan-eric.jpg";
import claudine from "@/assets/artisan-claudine.jpg";

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

export const artisans: Artisan[] = [
  {
    id: "jean-pierre",
    name: "Jean-Pierre Habimana",
    photo: jean,
    category: "Plumbing",
    categories: ["Plumbing", "Electrical"],
    rating: 4.8,
    reviews: 47,
    jobs: 47,
    distanceKm: 2.3,
    startingPrice: 8000,
    verified: true,
    pro: true,
    availableNow: true,
    district: "Nyarugenge",
    languages: ["Kinyarwanda", "English", "French"],
    experienceYears: 8,
    bio: "Trained plumber with 8 years fixing leaks, installing fixtures, and rewiring switchboards across Kigali. I work clean, on time, and explain every step.",
    responseTime: "Usually replies within 2 hours",
    weeklyBookings: 6,
  },
  {
    id: "marie-claire",
    name: "Marie Claire Uwase",
    photo: marie,
    category: "Cleaning",
    categories: ["Cleaning", "Laundry"],
    rating: 4.9,
    reviews: 124,
    jobs: 124,
    distanceKm: 1.1,
    startingPrice: 5000,
    verified: true,
    pro: true,
    availableNow: true,
    district: "Kicukiro",
    languages: ["Kinyarwanda", "English"],
    experienceYears: 5,
    bio: "Detail-obsessed home cleaner. I bring my own supplies and leave your home spotless every single time.",
    responseTime: "Usually replies within 30 minutes",
    weeklyBookings: 11,
  },
  {
    id: "eric",
    name: "Eric Nshimiyimana",
    photo: eric,
    category: "Electrical",
    categories: ["Electrical"],
    rating: 4.7,
    reviews: 32,
    jobs: 32,
    distanceKm: 3.4,
    startingPrice: 10000,
    verified: true,
    pro: false,
    availableNow: false,
    district: "Gasabo",
    languages: ["Kinyarwanda", "English"],
    experienceYears: 6,
    bio: "Certified electrician. Safe wiring, switchboard repairs, and full home installations.",
    responseTime: "Usually replies within 4 hours",
    weeklyBookings: 3,
  },
  {
    id: "claudine",
    name: "Claudine Mukamana",
    photo: claudine,
    category: "Carpentry",
    categories: ["Carpentry", "Furniture"],
    rating: 4.9,
    reviews: 58,
    jobs: 58,
    distanceKm: 4.2,
    startingPrice: 12000,
    verified: true,
    pro: true,
    availableNow: true,
    district: "Nyarugenge",
    languages: ["Kinyarwanda", "French"],
    experienceYears: 10,
    bio: "Custom furniture and carpentry. From a single shelf to a full kitchen fit-out.",
    responseTime: "Usually replies within 1 hour",
    weeklyBookings: 4,
  },
];

export const categoryTint: Record<string, string> = {
  Plumbing: "oklch(0.7 0.12 240)",
  Electrical: "oklch(0.82 0.16 90)",
  Cleaning: "oklch(0.7 0.1 195)",
  Carpentry: "oklch(0.65 0.12 50)",
  Painting: "oklch(0.7 0.14 25)",
  Gardening: "oklch(0.65 0.13 145)",
  Moving: "oklch(0.65 0.1 290)",
  Appliance: "oklch(0.7 0.1 320)",
};

export const categories = [
  { name: "Plumbing", rw: "Amazi", icon: "🔧", count: 23 },
  { name: "Electrical", rw: "Amashanyarazi", icon: "⚡", count: 18 },
  { name: "Cleaning", rw: "Isuku", icon: "🧹", count: 41 },
  { name: "Carpentry", rw: "Ababaji", icon: "🪚", count: 14 },
  { name: "Painting", rw: "Gusiga", icon: "🎨", count: 9 },
  { name: "Gardening", rw: "Ubusitani", icon: "🌿", count: 12 },
  { name: "Moving", rw: "Kwimuka", icon: "📦", count: 7 },
  { name: "Appliance", rw: "Ibikoresho", icon: "🔌", count: 11 },
];

export const reviews = [
  {
    id: 1,
    name: "Amina",
    rating: 5,
    daysAgo: 3,
    text: "Fixed our leaking kitchen pipe in under an hour. Very clean work and polite. Highly recommend.",
    reply: "Thank you Amina, it was a pleasure working in your home.",
  },
  {
    id: 2,
    name: "Patrick",
    rating: 5,
    daysAgo: 9,
    text: "On time, fair price, and explained everything. Will book again for the bathroom job.",
    reply: null,
  },
  {
    id: 3,
    name: "Diane",
    rating: 4,
    daysAgo: 18,
    text: "Good job overall. Came back the next day to double-check the pressure — really professional.",
    reply: null,
  },
];

export function formatRWF(n: number) {
  return n.toLocaleString("en-US");
}
