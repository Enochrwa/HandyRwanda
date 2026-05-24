import { useState, useEffect } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { MapPin } from "lucide-react";
import { artisanService } from "@/services/artisanService";
import api from "@/services/api";
import { Category } from "@/types/category";

export const Route = createFileRoute("/jobs/post")({
  component: PostJob,
});

function PostJob() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState({
    category_id: "",
    title: "",
    description: "",
    budget: "",
    location_label: "",
  });

  useEffect(() => {
    artisanService.getCategories().then((cats) => {
      setCategories(cats);
      if (cats.length > 0) {
        setFormData((prev) => ({ ...prev, category_id: cats[0].id }));
      }
    });
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await api.post("/jobs", {
        ...formData,
        budget: parseInt(formData.budget),
        latitude: -1.9441,
        longitude: 30.0619,
        photos_base64: [],
      });
      router.navigate({ to: "/search" });
    } catch (err) {
      console.error("Job post error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 pb-12">
      <Header />
      <main className="mx-auto max-w-3xl px-4 pt-12">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
          <h1 className="text-3xl font-extrabold">Post a Job</h1>
          <p className="text-muted-foreground mt-2">
            Describe what you need fixed and get bids from verified artisans.
          </p>

          <div className="mt-10 space-y-8">
            {/* Category selection simplified for MVP web */}
            <div className="space-y-4">
              <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                1. What do you need help with?
              </label>
              <select
                className="w-full rounded-xl border border-border bg-muted/20 p-4 font-semibold outline-none focus:border-primary"
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name_en}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-4">
              <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                2. Job Details
              </label>
              <input
                placeholder="Title (e.g., Fix leaking pipe)"
                className="w-full rounded-xl border border-border bg-muted/20 p-4 font-semibold outline-none focus:border-primary"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
              <textarea
                placeholder="Description of the work..."
                rows={4}
                className="w-full rounded-xl border border-border bg-muted/20 p-4 font-semibold outline-none focus:border-primary"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase">
                  Estimated Budget (RWF)
                </label>
                <input
                  type="number"
                  className="w-full rounded-xl border border-border bg-muted/20 p-4 font-semibold outline-none focus:border-primary"
                  value={formData.budget}
                  onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase">
                  Location
                </label>
                <div className="relative">
                  <input
                    className="w-full rounded-xl border border-border bg-muted/20 p-4 pl-10 font-semibold outline-none focus:border-primary"
                    placeholder="Search area..."
                    value={formData.location_label}
                    onChange={(e) => setFormData({ ...formData, location_label: e.target.value })}
                  />
                  <MapPin className="absolute left-3 top-4 h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading || !formData.title || !formData.category_id}
              className="w-full rounded-2xl bg-primary py-5 text-lg font-bold text-white shadow-lift hover:brightness-95 transition-all disabled:opacity-50"
            >
              {loading ? "Posting..." : "Post Job & See Artisans"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
