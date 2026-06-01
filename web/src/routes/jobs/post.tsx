// File: web/src/routes/jobs/post.tsx
import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { MapPin, Loader2, CheckCircle, ArrowRight, Calendar, Info } from "lucide-react";
import api from "@/services/api";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import { AuthModal } from "@/components/AuthModal";

export const Route = createFileRoute("/jobs/post")({
  head: () => ({ meta: [{ title: "Post a Job — HandyRwanda" }] }),
  component: PostJob,
});

type Urgency = "flexible" | "this_week" | "tomorrow" | "today" | "urgent";
type JobType = "one_time" | "recurring" | "emergency";

const URGENCY_OPTIONS: { value: Urgency; label: string; emoji: string; desc: string }[] = [
  { value: "flexible", label: "Flexible", emoji: "📅", desc: "No rush" },
  { value: "this_week", label: "This Week", emoji: "🗓️", desc: "Within 7 days" },
  { value: "tomorrow", label: "Tomorrow", emoji: "⏰", desc: "Next day" },
  { value: "today", label: "Today", emoji: "🔥", desc: "Same day" },
  { value: "urgent", label: "Urgent!", emoji: "🚨", desc: "ASAP" },
];

const JOB_TYPE_OPTIONS: { value: JobType; label: string; desc: string }[] = [
  { value: "one_time", label: "One-time Job", desc: "Single task or repair" },
  { value: "recurring", label: "Recurring Work", desc: "Regular ongoing work" },
  { value: "emergency", label: "Emergency Fix", desc: "Urgent repair needed" },
];

function PostJob() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [urgency, setUrgency] = useState<Urgency>("flexible");
  const [jobType, setJobType] = useState<JobType>("one_time");
  const [isRemotePossible, setIsRemotePossible] = useState(false);
  const [formData, setFormData] = useState({
    category_id: "",
    title: "",
    description: "",
    budget: "",
    budget_max: "",
    location_label: "",
    special_requirements: "",
    scheduled_time: "",
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
      const body: Record<string, unknown> = {
        category_id: formData.category_id,
        title: formData.title.trim(),
        description: formData.description.trim(),
        location_label: formData.location_label.trim() || "Kigali",
        latitude: -1.9441,
        longitude: 30.0619,
        job_type: jobType,
        urgency,
        is_remote_possible: isRemotePossible,
        ...(formData.budget && { budget: parseInt(formData.budget) }),
        ...(formData.budget_max && { budget_max: parseInt(formData.budget_max) }),
        ...(formData.special_requirements.trim() && {
          special_requirements: formData.special_requirements.trim(),
        }),
        ...(formData.scheduled_time && {
          scheduled_time: new Date(formData.scheduled_time).toISOString(),
        }),
      };

      // If no explicit scheduled time, derive from urgency
      if (!formData.scheduled_time) {
        const urgencyOffsets: Record<string, number> = {
          flexible: 7,
          this_week: 5,
          tomorrow: 1,
          today: 0,
          urgent: 0,
        };
        const d = new Date();
        d.setDate(d.getDate() + (urgencyOffsets[urgency] ?? 1));
        d.setHours(9, 0, 0, 0);
        body.scheduled_time = d.toISOString();
      }

      await api.post("/jobs", body);
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
            Verified artisans nearby will see your job and submit bids. You'll get a notification
            when you receive a bid.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <button
              onClick={() => navigate({ to: "/search" })}
              className="w-full rounded-2xl bg-primary py-4 font-bold text-white hover:brightness-95 transition"
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
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-extrabold sm:text-3xl">Post a Job</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Describe what you need and get bids from verified artisans nearby.
          </p>

          <div className="mt-8 space-y-7">
            {/* 1. Category */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 block">
                1. Service Category *
              </label>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {(categories as { id: string; name_en: string; icon_emoji?: string }[]).map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => set("category_id", cat.id)}
                    className={`flex flex-col items-center rounded-2xl border-2 p-3 text-center transition ${
                      formData.category_id === cat.id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-muted/30 hover:bg-muted"
                    }`}
                  >
                    <span className="text-xl mb-1">{cat.icon_emoji ?? "🛠️"}</span>
                    <span
                      className={`text-[11px] font-semibold leading-tight ${
                        formData.category_id === cat.id ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {cat.name_en}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Title */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                2. Job Title *
              </label>
              <input
                value={formData.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. Fix leaking kitchen sink pipe in Kiyovu"
                maxLength={200}
                className="w-full rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
              <div className="text-right text-[10px] text-muted-foreground mt-1">
                {formData.title.length}/200
              </div>
            </div>

            {/* 3. Description */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                3. Describe the Work *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Explain the problem in detail — what happened, how long, severity, access requirements, materials needed, preferred approach…"
                rows={5}
                maxLength={2000}
                className="w-full rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />
              <div className="text-right text-[10px] text-muted-foreground mt-1">
                {formData.description.length}/2000
              </div>
            </div>

            {/* 4. Job Type */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                4. Job Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {JOB_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setJobType(opt.value)}
                    className={`rounded-2xl border-2 px-3 py-3 text-left transition ${
                      jobType === opt.value
                        ? "border-primary bg-primary/10"
                        : "border-border bg-muted/30 hover:bg-muted"
                    }`}
                  >
                    <p className={`text-xs font-bold ${jobType === opt.value ? "text-primary" : "text-foreground"}`}>
                      {opt.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Urgency */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                5. When do you need it?
              </label>
              <div className="flex flex-wrap gap-2">
                {URGENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setUrgency(opt.value)}
                    className={`flex items-center gap-1.5 rounded-xl border-2 px-3 py-2 text-xs font-bold transition ${
                      urgency === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/30 hover:bg-muted text-foreground"
                    }`}
                  >
                    <span>{opt.emoji}</span>
                    {opt.label}
                    <span className="text-[10px] font-normal opacity-70">— {opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 6. Scheduled Date & Time */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5 block">
                <Calendar className="h-3.5 w-3.5" /> 6. Preferred Date & Time (optional)
              </label>
              <input
                type="datetime-local"
                value={formData.scheduled_time}
                onChange={(e) => set("scheduled_time", e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Leave blank — your urgency preference will be used instead
              </p>
            </div>

            {/* 7. Budget + Location */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                7. Budget & Location
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground">Min / Fixed (RWF)</label>
                      <input
                        type="number"
                        value={formData.budget}
                        onChange={(e) => set("budget", e.target.value)}
                        placeholder="e.g. 10000"
                        className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Max (optional)</label>
                      <input
                        type="number"
                        value={formData.budget_max}
                        onChange={(e) => set("budget_max", e.target.value)}
                        placeholder="e.g. 30000"
                        className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Leave blank to receive open bids from artisans
                  </p>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Location / Neighbourhood</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <input
                      value={formData.location_label}
                      onChange={(e) => set("location_label", e.target.value)}
                      placeholder="e.g. Kiyovu, Gasabo District"
                      className="w-full rounded-xl border border-border bg-muted/30 pl-9 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 8. Special Requirements */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                8. Special Requirements (optional)
              </label>
              <textarea
                value={formData.special_requirements}
                onChange={(e) => set("special_requirements", e.target.value)}
                placeholder="e.g. Must bring own tools, must speak Kinyarwanda, need 3+ years of experience in electrical work…"
                rows={2}
                maxLength={500}
                className="w-full rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />
            </div>

            {/* Remote toggle */}
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/20 p-4">
              <input
                type="checkbox"
                id="remote"
                checked={isRemotePossible}
                onChange={(e) => setIsRemotePossible(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary cursor-pointer"
              />
              <label htmlFor="remote" className="cursor-pointer">
                <p className="text-sm font-semibold">Remote / Phone consultation possible?</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Check if an artisan could help remotely or via video call first
                </p>
              </label>
            </div>

            {/* Info box */}
            <div className="flex gap-2.5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 leading-5">
                Posting is always free. Verified artisans matching your category and location will
                see your job. You can compare bids and chat before accepting.
              </p>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full rounded-2xl bg-amber-500 py-4 font-extrabold text-white shadow-sm hover:brightness-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
              {loading ? "Posting…" : "Post Job — Free ✓"}
            </button>
          </div>
        </div>

        {/* How it works */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h3 className="font-bold mb-3">How it works</h3>
          <div className="space-y-3">
            {[
              { n: "1", t: "Post for free", d: "No fees to post a job request." },
              { n: "2", t: "Receive bids", d: "Skilled artisans submit competitive quotes within hours." },
              { n: "3", t: "Compare & choose", d: "Review profiles, ratings, prices and reviews." },
              { n: "4", t: "Pay via MoMo", d: "Pay directly to the artisan. No hidden platform fees." },
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
