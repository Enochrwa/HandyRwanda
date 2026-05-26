import { useState, useReducer, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search as SearchIcon, SlidersHorizontal, MapPin, Star, X, Loader2 } from "lucide-react";
import { Header } from "@/components/Header";
import { ArtisanCard } from "@/components/ArtisanCard";
import { artisans as fallbackArtisans, formatRWF } from "@/services/artisanService";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import api from "@/services/api";
import { Drawer } from "vaul";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icon bug
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Browse artisans near you — HandyRwanda" },
      {
        name: "description",
        content: "Search verified plumbers, electricians, cleaners and more across Kigali.",
      },
      { property: "og:title", content: "Browse artisans near you — HandyRwanda" },
    ],
  }),
  component: SearchPage,
});

const filters = ["Nearest", "Top Rated", "Available Now", "Verified Only", "Pro"] as const;

type FilterState = {
  districts: string[];
  categories: string[];
  minPrice: string;
  maxPrice: string;
  availableNow: boolean;
  minRating: number;
};

const initialFilters: FilterState = {
  districts: [],
  categories: [],
  minPrice: "",
  maxPrice: "",
  availableNow: false,
  minRating: 0,
};

type FilterAction =
  | { type: "TOGGLE_DISTRICT"; payload: string }
  | { type: "TOGGLE_CATEGORY"; payload: string }
  | { type: "SET_MIN_PRICE"; payload: string }
  | { type: "SET_MAX_PRICE"; payload: string }
  | { type: "SET_AVAILABLE_NOW"; payload: boolean }
  | { type: "SET_MIN_RATING"; payload: number }
  | { type: "RESET" };

function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case "TOGGLE_DISTRICT":
      return {
        ...state,
        districts: state.districts.includes(action.payload)
          ? state.districts.filter((d) => d !== action.payload)
          : [...state.districts, action.payload],
      };
    case "TOGGLE_CATEGORY":
      return {
        ...state,
        categories: state.categories.includes(action.payload)
          ? state.categories.filter((c) => c !== action.payload)
          : [...state.categories, action.payload],
      };
    case "SET_MIN_PRICE":
      return { ...state, minPrice: action.payload };
    case "SET_MAX_PRICE":
      return { ...state, maxPrice: action.payload };
    case "SET_AVAILABLE_NOW":
      return { ...state, availableNow: action.payload };
    case "SET_MIN_RATING":
      return { ...state, minRating: action.payload };
    case "RESET":
      return initialFilters;
    default:
      return state;
  }
}

function SearchPage() {
  const [q, setQ] = useState("");
  const [activeChip, setActiveChip] = useState<(typeof filters)[number]>("Nearest");
  const [view, setView] = useState<"list" | "map">("list");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterState, dispatch] = useReducer(filterReducer, initialFilters);

  const { data, isLoading } = useQuery({
    queryKey: ["artisans", q, activeChip, filterState],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (q) params.append("q", q);
      params.append("sort", activeChip);
      if (filterState.districts.length) params.append("districts", filterState.districts.join(","));
      if (filterState.categories.length)
        params.append("categories", filterState.categories.join(","));
      if (filterState.minPrice) params.append("min_price", filterState.minPrice);
      if (filterState.maxPrice) params.append("max_price", filterState.maxPrice);
      if (filterState.availableNow) params.append("available_now", "true");
      if (filterState.minRating > 0) params.append("min_rating", filterState.minRating.toString());

      // Using the search endpoint defined in Task 4a
      // Note: we need to provide latitude/longitude for the backend search endpoint.
      // Default to Kigali center for now.
      params.append("latitude", "-1.9441");
      params.append("longitude", "30.0619");

      const res = await api.get("/artisans/search", { params });
      return res.data;
    },
    placeholderData: keepPreviousData,
  });

  const results = useMemo(() => {
    const apiResults = data || [];
    if (apiResults.length === 0 && !isLoading && !q && filterState === initialFilters) {
      return fallbackArtisans;
    }

    // Map backend results to frontend Artisan type if necessary
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return apiResults.map((a: any) => ({
      id: a.id,
      name: a.full_name || a.name,
      category: a.category || "Artisan",
      photo: a.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${a.id}`,
      rating: a.average_rating || 0,
      reviews: a.total_reviews || 0,
      district: a.location_label || "Kigali",
      distanceKm: a.distance_km || 0,
      verified: a.verification_status === "verified",
      pro: (a.community_score || 0) > 80,
      availableNow: a.is_available,
      hourlyRate: a.hourly_rate,
      lat: a.lat,
      lng: a.lng,
    }));
  }, [data, isLoading, q, filterState]);

  return (
    <div className="min-h-dvh">
      <Header />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
        {/* Search bar */}
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-card">
          <SearchIcon className="h-5 w-5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search plumbing, cleaning, electrician..."
            className="flex-1 bg-transparent text-base font-medium outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={() => setIsFilterOpen(true)}
            aria-label="Filters"
            className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-foreground hover:bg-muted/80 transition-colors"
          >
            <SlidersHorizontal className="h-5 w-5" />
          </button>
        </div>

        {/* Sort chips + view toggle */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0 scrollbar-hide">
            {filters.map((f) => {
              const isActive = activeChip === f;
              return (
                <button
                  key={f}
                  onClick={() => setActiveChip(f)}
                  className={[
                    "shrink-0 rounded-full border-2 px-4 py-2 text-sm font-semibold transition",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:bg-muted",
                  ].join(" ")}
                >
                  {f}
                </button>
              );
            })}
          </div>
          <div className="hidden shrink-0 overflow-hidden rounded-xl border border-border bg-card sm:flex">
            {(["list", "map"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={[
                  "px-4 py-2 text-sm font-bold capitalize transition-colors",
                  view === v
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted",
                ].join(" ")}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-4 text-sm font-medium text-muted-foreground">
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Searching...
            </span>
          ) : (
            `${results.length} artisan${results.length === 1 ? "" : "s"} near Kigali`
          )}
        </p>

        {view === "map" ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="relative h-[600px] overflow-hidden rounded-2xl border border-border shadow-card z-0">
              <MapContainer
                center={[-1.9441, 30.0619]}
                zoom={13}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {results
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  .filter((a: any) => a.lat && a.lng)
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  .map((a: any) => (
                    <Marker key={a.id} position={[a.lat, a.lng]}>
                      <Popup className="custom-popup">
                        <div className="flex items-center gap-3 p-1">
                          <img
                            src={a.photo}
                            alt={a.name}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                          <div>
                            <div className="font-bold text-sm">{a.name}</div>
                            <div className="text-xs text-muted-foreground">{a.category}</div>
                            <div className="flex items-center gap-1 text-xs mt-0.5">
                              <Star className="h-3 w-3 fill-accent text-accent" />
                              <span className="font-bold">{a.rating}</span>
                            </div>
                            <Link
                              to="/artisan/$id"
                              params={{ id: a.id }}
                              className="text-xs text-primary font-bold hover:underline mt-1 block"
                            >
                              View Profile
                            </Link>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
              </MapContainer>
              <div className="absolute bottom-4 left-4 z-[1000] inline-flex items-center gap-2 rounded-full bg-card/90 px-3 py-2 text-xs font-semibold shadow-card backdrop-blur">
                <MapPin className="h-4 w-4 text-primary" /> Kigali center
              </div>
            </div>
            <div className="hidden lg:block space-y-3 max-h-[600px] overflow-y-auto pr-2 scrollbar-hide">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {results.map((a: any) => (
                <ArtisanCard key={a.id} a={a} />
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-2xl bg-muted h-32" />
              ))
            ) : results.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-border bg-card p-10 text-center">
                <div className="text-5xl">🛠️</div>
                <h3 className="mt-3 text-lg font-bold">Nta bantu bagaragara hano ubu</h3>
                <p className="text-sm text-muted-foreground">
                  No one matches your search right now.
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  <Button asChild>
                    <Link to="/jobs/post">Post a job</Link>
                  </Button>
                  <Button variant="outline" onClick={() => dispatch({ type: "RESET" })}>
                    Reset filters
                  </Button>
                </div>
              </div>
            ) : (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              results.map((a: any) => <ArtisanCard key={a.id} a={a} />)
            )}
          </div>
        )}
      </main>

      {/* Filter Sheet */}
      <Drawer.Root open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 max-h-[90%] bg-card border-t border-border rounded-t-[32px] flex flex-col z-50">
            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted mt-3 mb-2" />

            <div className="px-6 pb-8 overflow-y-auto">
              <div className="flex items-center justify-between py-4">
                <Drawer.Title className="text-2xl font-bold">Filter</Drawer.Title>
                <button
                  onClick={() => dispatch({ type: "RESET" })}
                  className="text-sm font-bold text-primary hover:underline"
                >
                  Reset All
                </button>
              </div>

              <div className="space-y-8 mt-4">
                {/* District */}
                <section>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
                    District
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {["Nyarugenge", "Kicukiro", "Gasabo"].map((district) => (
                      <div key={district} className="flex items-center space-x-2">
                        <Checkbox
                          id={`dist-${district}`}
                          checked={filterState.districts.includes(district)}
                          onCheckedChange={() =>
                            dispatch({ type: "TOGGLE_DISTRICT", payload: district })
                          }
                        />
                        <label
                          htmlFor={`dist-${district}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {district}
                        </label>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Category */}
                <section>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
                    Category
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {["Plumbing", "Electrical", "Cleaning", "Carpentry", "Painting", "Masonry"].map(
                      (cat) => (
                        <div key={cat} className="flex items-center space-x-2">
                          <Checkbox
                            id={`cat-${cat}`}
                            checked={filterState.categories.includes(cat)}
                            onCheckedChange={() =>
                              dispatch({ type: "TOGGLE_CATEGORY", payload: cat })
                            }
                          />
                          <label
                            htmlFor={`cat-${cat}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {cat}
                          </label>
                        </div>
                      ),
                    )}
                  </div>
                </section>

                {/* Price Range */}
                <section>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
                    Hourly Rate (RWF)
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">
                        From
                      </label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={filterState.minPrice}
                        onChange={(e) =>
                          dispatch({ type: "SET_MIN_PRICE", payload: e.target.value })
                        }
                      />
                    </div>
                    <div className="mt-6 text-muted-foreground">to</div>
                    <div className="flex-1 space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">
                        To
                      </label>
                      <Input
                        type="number"
                        placeholder="50,000+"
                        value={filterState.maxPrice}
                        onChange={(e) =>
                          dispatch({ type: "SET_MAX_PRICE", payload: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </section>

                {/* Toggles */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold">Available Now</h3>
                      <p className="text-xs text-muted-foreground">
                        Only show artisans ready to work
                      </p>
                    </div>
                    <Switch
                      checked={filterState.availableNow}
                      onCheckedChange={(checked) =>
                        dispatch({ type: "SET_AVAILABLE_NOW", payload: checked })
                      }
                    />
                  </div>
                </section>

                {/* Rating */}
                <section>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
                    Minimum Rating
                  </h3>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        onClick={() => dispatch({ type: "SET_MIN_RATING", payload: rating })}
                        className={[
                          "flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border-2 transition",
                          filterState.minRating === rating
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card hover:bg-muted",
                        ].join(" ")}
                      >
                        <span className="font-bold">{rating}</span>
                        <Star
                          className={`h-3 w-3 ${filterState.minRating >= rating ? "fill-accent text-accent" : ""}`}
                        />
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              <div className="mt-10 flex gap-4">
                <Drawer.Close asChild>
                  <Button variant="outline" className="flex-1 h-14 rounded-2xl text-lg font-bold">
                    Cancel
                  </Button>
                </Drawer.Close>
                <Drawer.Close asChild>
                  <Button className="flex-1 h-14 rounded-2xl text-lg font-bold">
                    Apply Filters
                  </Button>
                </Drawer.Close>
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}
