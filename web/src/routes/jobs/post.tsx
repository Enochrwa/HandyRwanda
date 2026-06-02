// File: web/src/routes/jobs/post.tsx
import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import {
  MapPin,
  Loader2,
  CheckCircle,
  ArrowRight,
  Info,
  Clock,
  DollarSign,
  FileText,
  Camera,
} from "lucide-react";
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

const URGENCY_OPTIONS = [
  { value: "flexible", label: "Flexible", desc: "Within the next 2 weeks", emoji: "📅" },
  { value: "this_week", label: "This Week", desc: "Within 7 days", emoji: "🗓️" },
  { value: "tomorrow", label: "Tomorrow", desc: "Within 24 hours", emoji: "⏰" },
  { value: "today", label: "Today", desc: "Within the day", emoji: "🔥" },
  { value: "urgent", label: "Urgent!", desc: "Within 2 hours", emoji: "🚨" },
] as const;

const PLACEHOLDER_DESCRIPTIONS: Record<string, string> = {
  default:
    "Describe the problem in detail — what happened, how long it's been going on, what you've already tried, the severity, and any special access requirements (gate code, floor number, etc.)",
  Plumbing:
    "e.g. The kitchen sink has been leaking under the cabinet for 3 days. Water pools on the floor. The shut-off valve still works. I need the pipe connection replaced.",
  Electrical:
    "e.g. Two sockets in the living room stopped working after we had a power surge. The circuit breaker trips when I try to reset it. I need a qualified electrician to diagnose and fix it.",
  Cleaning:
    "e.g. 3-bedroom apartment, last cleaned 2 weeks ago. I need a deep clean including inside fridge, oven, and bathroom tiles. I have cleaning products available.",
  Carpentry:
    "e.g. The bedroom door frame is warped and the door no longer closes properly. I need the frame realigned and the door rehung. Photos attached.",
  Painting:
    "e.g. Living room and two bedrooms need repainting. Walls are 2.7m high, currently magnolia. I'd like them in white. Surfaces have minor cracks to fill first.",
};

function PostJob() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [selectedUrgency, setSelectedUrgency] = useState("flexible");
  const [formData, setFormData] = useState({
    category_id: "",
    title: "",
    description: "",
    additional_notes: "",
    budget: "",
    budget_negotiable: true,
    location_label: "",
    scheduled_date: "",
    scheduled_time: "",
  });

  const {
    data: categories = [],
    isLoading: categoriesLoading,
    isError: categoriesError,
    refetch: refetchCategories,
  } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get("/categories").then((r) => r.data),
    staleTime: 1000 * 60 * 10, // 10 minutes — categories rarely change
  });

  const set = (k: string, v: string | boolean) => setFormData((p) => ({ ...p, [k]: v }));

  const selectedCatName =
    categories.find((c: { id: string; name_en: string }) => c.id === formData.category_id)
      ?.name_en || "default";
  const descriptionPlaceholder =
    PLACEHOLDER_DESCRIPTIONS[selectedCatName] || PLACEHOLDER_DESCRIPTIONS["default"];

  const buildScheduledTime = (): string | undefined => {
    if (!formData.scheduled_date) return undefined;
    const time = formData.scheduled_time || "09:00";
    return new Date(`${formData.scheduled_date}T${time}:00`).toISOString();
  };

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      setAuthOpen(true);
      return;
    }
    if (!formData.category_id) {
      toast.error("Select a service category");
      return;
    }
    if (!formData.title.trim() || formData.title.length < 5) {
      toast.error("Add a job title (at least 5 characters)");
      return;
    }
    if (!formData.description.trim() || formData.description.length < 15) {
      toast.error("Describe the work in more detail (at least 15 characters)");
      return;
    }
    if (!formData.location_label.trim()) {
      toast.error("Please specify a location");
      return;
    }

    setLoading(true);
    try {
      await api.post("/jobs", {
        category_id: formData.category_id,
        title: formData.title.trim(),
        description: formData.description.trim(),
        additional_notes: formData.additional_notes.trim() || undefined,
        location_label: formData.location_label.trim(),
        latitude: -1.9441,
        longitude: 30.0619,
        urgency: selectedUrgency,
        scheduled_time: buildScheduledTime(),
        budget_negotiable: formData.budget_negotiable,
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
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-extrabold">Job posted! 🎉</h1>
          <p className="mt-3 text-muted-foreground">
            Verified artisans will see your job and start bidding. You'll be notified as bids
            arrive.
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
              View My Jobs & Bids
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
        {/* Progress indicator */}
        <div className="mb-6 flex items-center gap-2">
          <span className="text-sm text-muted-foreground font-medium">Post a Job</span>
          <span className="text-muted-foreground">→</span>
          <span className="text-sm text-primary font-bold">Job Details</span>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8 space-y-8">
          <div>
            <h1 className="text-2xl font-extrabold sm:text-3xl">What do you need done?</h1>
            <p className="mt-1 text-muted-foreground text-sm">
              The more detail you provide, the more accurate and competitive the bids you'll
              receive.
            </p>
          </div>

          {/* 1. Category */}
          <section>
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">
                1
              </span>
              Service Category <span className="text-destructive">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {categoriesLoading && (
                <div className="col-span-full flex items-center justify-center py-8 gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading categories…
                </div>
              )}
              {categoriesError && (
                <div className="col-span-full flex flex-col items-center py-6 gap-2">
                  <p className="text-sm text-destructive">Failed to load categories.</p>
                  <button
                    onClick={() => refetchCategories()}
                    className="text-xs text-primary underline hover:no-underline"
                  >
                    Retry
                  </button>
                </div>
              )}
              {!categoriesLoading &&
                !categoriesError &&
                categories.map((cat: { id: string; name_en: string; icon_emoji?: string }) => (
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
          </section>

          {/* 2. Title */}
          <section>
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">
                2
              </span>
              <FileText className="h-3.5 w-3.5" /> Job Title{" "}
              <span className="text-destructive">*</span>
            </label>
            <input
              value={formData.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Fix leaking kitchen sink under cabinet"
              maxLength={200}
              className="w-full rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>Be specific — what exactly needs to be done?</span>
              <span>{formData.title.length}/200</span>
            </div>
          </section>

          {/* 3. Description */}
          <section>
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">
                3
              </span>
              Describe the Work <span className="text-destructive">*</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder={descriptionPlaceholder}
              rows={5}
              maxLength={2000}
              className="w-full rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40 resize-none"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>Include: what's wrong, how long, what you've tried, access requirements</span>
              <span>{formData.description.length}/2000</span>
            </div>
          </section>

          {/* 4. Additional Notes */}
          <section>
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              <span className="w-5 h-5 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-bold">
                4
              </span>
              Additional Notes{" "}
              <span className="text-muted-foreground text-[10px] font-normal">(optional)</span>
            </label>
            <textarea
              value={formData.additional_notes}
              onChange={(e) => set("additional_notes", e.target.value)}
              placeholder="Materials available on-site, preferred artisan qualities (e.g. female artisan), parking available, gate code, etc."
              rows={2}
              maxLength={1000}
              className="w-full rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40 resize-none"
            />
          </section>

          {/* 5. Urgency */}
          <section>
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">
                5
              </span>
              <Clock className="h-3.5 w-3.5" /> How Urgently Do You Need This?{" "}
              <span className="text-destructive">*</span>
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {URGENCY_OPTIONS.map((u) => (
                <button
                  key={u.value}
                  onClick={() => setSelectedUrgency(u.value)}
                  title={u.desc}
                  className={`flex flex-col items-center rounded-xl border-2 py-2.5 px-1 text-center transition ${selectedUrgency === u.value ? "border-primary bg-primary/10" : "border-border bg-muted/30 hover:bg-muted"}`}
                >
                  <span className="text-lg">{u.emoji}</span>
                  <span
                    className={`text-[10px] font-bold mt-0.5 ${selectedUrgency === u.value ? "text-primary" : "text-foreground"}`}
                  >
                    {u.label}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {URGENCY_OPTIONS.find((u) => u.value === selectedUrgency)?.desc}
            </p>
          </section>

          {/* 6. Scheduled date/time (optional) */}
          <section>
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              <span className="w-5 h-5 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-bold">
                6
              </span>
              Preferred Date & Time{" "}
              <span className="text-muted-foreground text-[10px] font-normal">(optional)</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={formData.scheduled_date}
                onChange={(e) => set("scheduled_date", e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
              <input
                type="time"
                value={formData.scheduled_time}
                onChange={(e) => set("scheduled_time", e.target.value)}
                className="rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </section>

          {/* 7. Budget & Location */}
          <section>
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">
                7
              </span>
              Budget & Location
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground mb-1 block">
                  <DollarSign className="inline h-3 w-3 mr-0.5" /> Budget (RWF) — optional
                </label>
                <input
                  type="number"
                  value={formData.budget}
                  onChange={(e) => set("budget", e.target.value)}
                  placeholder="e.g. 15000"
                  min={500}
                  className="w-full rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
                {formData.budget && (
                  <p className="text-[10px] text-primary mt-0.5">
                    ≈ {formatRWF(parseInt(formData.budget))} RWF
                  </p>
                )}
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground mb-1 block">
                  <MapPin className="inline h-3 w-3 mr-0.5" /> Location{" "}
                  <span className="text-destructive">*</span>
                </label>
                <input
                  value={formData.location_label}
                  onChange={(e) => set("location_label", e.target.value)}
                  placeholder="Neighbourhood / district e.g. Kiyovu, Kigali"
                  className="w-full rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
            {formData.budget && (
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.budget_negotiable}
                  onChange={(e) => set("budget_negotiable", e.target.checked)}
                  className="rounded"
                />
                <span className="text-xs text-muted-foreground">
                  I'm open to negotiate if needed
                </span>
              </label>
            )}
          </section>

          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  <strong>Tips for getting great bids:</strong>
                </p>
                <ul className="list-disc list-inside space-y-0.5 ml-1">
                  <li>Add photos if you can — artisans quote more accurately</li>
                  <li>Mention if you have materials ready</li>
                  <li>Specify your preferred timing clearly</li>
                  <li>Include access instructions (apartment floor, gate code)</li>
                </ul>
              </div>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full rounded-2xl bg-primary py-4 font-extrabold text-primary-foreground shadow-sm hover:brightness-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            {loading ? "Posting your job…" : "Post Job — Free ✓"}
          </button>
        </div>

        {/* How it works */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h3 className="font-bold mb-3">How it works after posting</h3>
          <div className="space-y-3">
            {[
              {
                n: "1",
                t: "Artisans bid",
                d: "Verified artisans in your area see the job and submit competitive quotes.",
              },
              {
                n: "2",
                t: "Compare bids",
                d: "Review artisan profiles, ratings, and prices before choosing.",
              },
              {
                n: "3",
                t: "Accept & pay",
                d: "Accept the best bid. Pay via MoMo — funds held until job is confirmed.",
              },
              {
                n: "4",
                t: "Rate & review",
                d: "After the job, leave a review to help others find great artisans.",
              },
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
