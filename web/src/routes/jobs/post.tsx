// File: web/src/routes/jobs/post.tsx
import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { MapPin, Loader2, CheckCircle, ArrowRight } from "lucide-react";
import api from "@/services/api";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import { AuthModal } from "@/components/AuthModal";
import { formatRWF } from "@/services/artisanService";

export const Route = createFileRoute("/jobs/post")({
  head: () => ({ meta: [{ title: "Post a Job — HandyRwanda" }] }),
  component: PostJob,
});

function PostJob() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [when, setWhen] = useState("Tomorrow");
  const [formData, setFormData] = useState({
    category_id: "",
    title: "",
    description: "",
    budget: "",
    location_label: "",
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get("/artisans/categories").then((r) => r.data),
  });

  const set = (k: string, v: string) => setFormData((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      setAuthOpen(true);
      return;
    }
    if (!formData.title.trim() || formData.title.length < 5) {
      toast.error("Add a job title (at least 5 characters)");
      return;
    }
    if (!formData.description.trim() || formData.description.length < 15) {
      toast.error("Add more description (at least 15 characters)");
      return;
    }
    if (!formData.category_id) {
      toast.error("Select a service category");
      return;
    }

    setLoading(true);
    try {
      const dateOffset: Record<string, number> = {
        Today: 0,
        Tomorrow: 1,
        "This week": 4,
        Flexible: 7,
      };
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + (dateOffset[when] ?? 1));
      scheduledDate.setHours(9, 0, 0, 0);

      await api.post("/jobs", {
        category_id: formData.category_id,
        title: formData.title.trim(),
        description: formData.description.trim(),
        location_label: formData.location_label.trim() || "Kigali",
        latitude: -1.9441,
        longitude: 30.0619,
        scheduled_time: scheduledDate.toISOString(),
        ...(formData.budget && { budget: parseInt(formData.budget) }),
      });
      setDone(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof msg === "string" ? msg : "Failed to post job. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-dvh bg-muted/30">
        <Header />
        <main className="mx-auto max-w-xl px-4 pt-20 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
            <CheckCircle className="h-10 w-10 text-success" />
          </div>
          <h1 className="text-3xl font-extrabold">Job posted! 🎉</h1>
          <p className="mt-3 text-muted-foreground">
            Verified artisans nearby will see your job and submit bids. You'll get a notification
            when you receive a bid.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <button
              onClick={() => navigate({ to: "/search" })}
              className="w-full rounded-2xl bg-primary py-4 font-bold text-primary-foreground hover:brightness-95 transition"
            >
              Browse Artisans Now <ArrowRight className="inline h-4 w-4 ml-1" />
            </button>
            <button
              onClick={() => navigate({ to: "/messages" })}
              className="w-full rounded-2xl border border-border bg-card py-4 font-bold hover:bg-muted transition"
            >
              View My Messages
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-muted/30 pb-16">
      <Header />
      <main className="mx-auto max-w-2xl px-4 pt-8 sm:pt-12">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-card sm:p-8">
          <h1 className="text-2xl font-extrabold sm:text-3xl">Post a Job</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Describe what you need and get bids from verified artisans nearby.
          </p>

          <div className="mt-8 space-y-6">
            {/* Category */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 block">
                1. Service Category *
              </label>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {categories.map((cat: { id: string; name_en: string; icon_emoji?: string }) => (
                  <button
                    key={cat.id}
                    onClick={() => set("category_id", cat.id)}
                    className={`flex flex-col items-center rounded-2xl border-2 p-3 text-center transition ${formData.category_id === cat.id ? "border-primary bg-primary/10" : "border-border bg-muted/30 hover:bg-muted"}`}
                  >
                    <span className="text-xl mb-1">{cat.icon_emoji ?? "🛠️"}</span>
                    <span
                      className={`text-[11px] font-semibold ${formData.category_id === cat.id ? "text-primary" : "text-foreground"}`}
                    >
                      {cat.name_en}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                2. Job Title *
              </label>
              <input
                value={formData.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. Fix leaking kitchen sink"
                maxLength={100}
                className="w-full rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
              <div className="text-right text-[10px] text-muted-foreground mt-1">
                {formData.title.length}/100
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                3. Describe the Work *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Explain the problem clearly — what happened, how long, what you've tried…"
                rows={4}
                maxLength={500}
                className="w-full rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />
              <div className="text-right text-[10px] text-muted-foreground mt-1">
                {formData.description.length}/500
              </div>
            </div>

            {/* When */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                4. When do you need it?
              </label>
              <div className="grid grid-cols-4 gap-2">
                {["Today", "Tomorrow", "This week", "Flexible"].map((w) => (
                  <button
                    key={w}
                    onClick={() => setWhen(w)}
                    className={`rounded-xl border-2 py-2.5 text-xs font-bold transition ${when === w ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 hover:bg-muted"}`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            {/* Budget + Location */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  Budget (RWF) — optional
                </label>
                <input
                  type="number"
                  value={formData.budget}
                  onChange={(e) => set("budget", e.target.value)}
                  placeholder="e.g. 15000"
                  className="w-full rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  Location
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <input
                    value={formData.location_label}
                    onChange={(e) => set("location_label", e.target.value)}
                    placeholder="Neighbourhood / district"
                    className="w-full rounded-2xl border border-border bg-muted/30 pl-9 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full rounded-2xl bg-accent py-4 font-extrabold text-accent-foreground shadow-lift hover:brightness-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
              {loading ? "Posting…" : "Post Job — Free ✓"}
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h3 className="font-bold mb-3">How it works</h3>
          <div className="space-y-3">
            {[
              { n: "1", t: "Post for free", d: "No fees to post a job request." },
              { n: "2", t: "Receive bids", d: "Artisans submit competitive quotes within hours." },
              { n: "3", t: "Choose the best", d: "Compare profiles, ratings, and prices." },
              { n: "4", t: "Pay via MoMo", d: "Pay directly to the artisan. No hidden fees." },
            ].map((s) => (
              <div key={s.n} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">{s.n}</span>
                </div>
                <div>
                  <p className="font-semibold text-sm">{s.t}</p>
                  <p className="text-xs text-muted-foreground">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
