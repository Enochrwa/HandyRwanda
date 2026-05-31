// File: web/src/routes/pro.tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  TrendingUp,
  Star,
  MapPin,
  Clock,
  Award,
  Flame,
  Trophy,
  ArrowRight,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Header } from "@/components/Header";
import { formatRWF } from "@/services/artisanService";
import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { proService } from "@/services/proService";
import api from "@/services/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/pro")({
  head: () => ({
    meta: [
      { title: "Artisan dashboard — HandyRwanda" },
      {
        name: "description",
        content: "Track your earnings, schedule, and nearby jobs. Built for working artisans.",
      },
    ],
  }),
  component: Pro,
});

function Pro() {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate({ to: "/" });
    }
  }, [isAuthenticated, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["artisan-dashboard"],
    queryFn: proService.getDashboard,
    enabled: isAuthenticated && user?.role === "artisan",
  });

  const { data: myBids = [] } = useQuery({
    queryKey: ["my-bids"],
    queryFn: () => api.get("/artisans/dashboard").then((r) => r.data?.active_bids ?? []),
    enabled: isAuthenticated && user?.role === "artisan",
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ["my-bookings"],
    queryFn: () => api.get("/bookings").then((r) => r.data),
    enabled: isAuthenticated && user?.role === "artisan",
    refetchInterval: 30000,
  });

  const confirmReceipt = useMutation({
    mutationFn: (bookingId: string) => api.post(`/bookings/${bookingId}/confirm-receipt`),
    onSuccess: () => { toast.success("Receipt confirmed! Job is now in progress."); queryClient.invalidateQueries({ queryKey: ["my-bookings"] }); },
    onError: () => toast.error("Failed to confirm receipt"),
  });

  const toggleMutation = useMutation({
    mutationFn: proService.toggleAvailability,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["artisan-dashboard"] });
      toast.success("Availability updated");
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { detail?: string } } };
      toast.error(error?.response?.data?.detail ?? "Failed to update availability");
    },
  });

  if (!isAuthenticated || user?.role !== "artisan") {
    return null;
  }

  return (
    <div className="min-h-dvh">
      <Header />
      <main className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">
          Muraho, {user?.fullName} 👋
        </p>
        <h1 className="mt-1 text-3xl font-extrabold">Today’s dashboard</h1>

        {/* Availability toggle */}
        <button
          onClick={() => toggleMutation.mutate(!data?.is_available)}
          disabled={toggleMutation.isPending}
          className={[
            "mt-5 flex w-full items-center justify-between rounded-2xl border-2 p-5 text-left transition",
            data?.is_available ? "border-success/30 bg-success/10" : "border-border bg-muted",
          ].join(" ")}
        >
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {data?.is_available ? "You’re visible to clients" : "You’re hidden from search"}
            </div>
            <div className="mt-1 text-lg font-bold">
              {data?.is_available ? "Available now" : "Tap to go online"}
            </div>
          </div>
          <div
            className={[
              "relative h-9 w-16 rounded-full transition",
              data?.is_available ? "bg-success" : "bg-muted-foreground/30",
            ].join(" ")}
          >
            <span
              className={[
                "absolute top-1 h-7 w-7 rounded-full bg-card shadow-card transition-all",
                data?.is_available ? "left-8" : "left-1",
              ].join(" ")}
            />
          </div>
        </button>

        {/* Earnings */}
        <section className="mt-5 rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            This month
          </div>
          {isLoading ? (
            <div className="mt-2 h-10 w-48 animate-pulse rounded bg-muted" />
          ) : (
            <div className="mt-1 text-4xl font-extrabold text-success">
              {formatRWF(data?.earnings_this_month ?? 0)}{" "}
              <span className="text-lg font-semibold text-muted-foreground">RWF</span>
            </div>
          )}
          <div className="mt-1 text-sm font-medium text-muted-foreground">
            {data?.jobs_count ?? 0} jobs · ⭐ {data?.avg_rating?.toFixed(1) ?? "0.0"} avg
          </div>

          {/* Sparkline (Placeholder svg) */}
          <svg viewBox="0 0 200 50" className="mt-4 h-14 w-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.55 0.13 152)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="oklch(0.55 0.13 152)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0,38 L25,30 L50,32 L75,18 L100,22 L125,12 L150,16 L175,8 L200,14 L200,50 L0,50 Z"
              fill="url(#g)"
            />
            <path
              d="M0,38 L25,30 L50,32 L75,18 L100,22 L125,12 L150,16 L175,8 L200,14"
              fill="none"
              stroke="oklch(0.42 0.1 152)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>

          {/* Achievements */}
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { icon: Trophy, label: `${data?.jobs_count ?? 0} jobs done` },
              { icon: Star, label: "5-star streak" },
              { icon: Flame, label: "Active artisan" },
              { icon: Award, label: "Verified pro" },
            ].map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1.5 text-xs font-bold"
              >
                <Icon className="h-3.5 w-3.5 text-accent" /> {label}
              </span>
            ))}
          </div>
        </section>

        {/* Today's schedule */}
        <section className="mt-6">
          <h2 className="text-lg font-bold">Today’s schedule</h2>
          <div className="mt-3 space-y-2">
            {isLoading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
              ))
            ) : data?.schedule?.length > 0 ? (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              data.schedule.map((item: any) => (
                <ScheduleRow
                  key={item.id}
                  time={
                    item.time
                      ? new Date(item.time).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "N/A"
                  }
                  title={`${item.title} · ${item.client_name}`}
                  status={item.status === "confirmed" ? "confirmed" : "pending"}
                />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
                No jobs scheduled for today
              </div>
            )}
          </div>
        </section>

        {/* Nearby open jobs */}
        <section className="mt-8">
          <h2 className="text-lg font-bold">Open jobs nearby</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {isLoading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-48 animate-pulse rounded-2xl bg-muted" />
              ))
            ) : data?.nearby_jobs?.length > 0 ? (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              data.nearby_jobs.map((j: any) => <NearbyJobCard key={j.id} job={j} />)
            ) : (
              <div className="col-span-full rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
                No open jobs nearby
              </div>
            )}
          </div>
        </section>

        {/* My active bookings */}
        <section className="mt-8">
          <h2 className="text-lg font-bold mb-3">Active Bookings</h2>
          {bookings.filter((b: any) => ["pending_payment", "confirmed", "in_progress"].includes(b.status)).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-muted-foreground text-sm">
              No active bookings right now.
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.filter((b: any) => ["pending_payment", "confirmed", "in_progress"].includes(b.status)).map((b: any) => (
                <div key={b.id} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{b.title}</p>
                    <p className="text-sm text-muted-foreground">{b.other_name} · {b.agreed_price?.toLocaleString()} RWF</p>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${b.status === "in_progress" ? "bg-success/10 text-success" : b.status === "confirmed" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                      {b.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {b.status === "confirmed" && (
                      <Button size="sm" onClick={() => confirmReceipt.mutate(b.id)} disabled={confirmReceipt.isPending}>
                        Confirm Receipt
                      </Button>
                    )}
                    <Button size="sm" variant="outline" asChild>
                      <a href={`/messages?booking=${b.id}`}>Chat</a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-10 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/10 p-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-primary" />
            <h2 className="text-lg font-bold">
              Artisans on HandyRwanda earn on average {formatRWF(120000)} RWF / month
            </h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Keep your profile updated to increase your chances of being hired.
          </p>
        </section>
      </main>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function NearbyJobCard({ job }: { job: any }) {
  const [expanded, setExpanded] = useState(false);
  const [price, setPrice] = useState(job.budget?.toString() || "");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = async () => {
    if (!price) {
      toast.error("Please enter a price");
      return;
    }
    setIsSubmitting(true);
    try {
      await proService.submitBid(job.id, parseInt(price), note);
      toast.success("Bid submitted!");
      setExpanded(false);
      queryClient.invalidateQueries({ queryKey: ["artisan-dashboard"] });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || "Failed to submit bid");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-card h-fit">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" /> {job.location_label || "Unknown"} · {job.distance} km
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-success">
          <Clock className="h-3 w-3" /> New
        </span>
      </div>
      <h3 className="mt-2 font-bold">
        {job.category} · {job.title}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{job.description}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Budget:{" "}
        <span className="font-semibold text-foreground">{formatRWF(job.budget || 0)} RWF</span>
      </p>

      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 font-bold text-primary-foreground hover:bg-primary/90"
        >
          Submit Bid <ArrowRight className="h-4 w-4" />
        </button>
      ) : (
        <div className="mt-4 space-y-3 border-t pt-4">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-muted-foreground">
              Your Price (RWF)
            </label>
            <Input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Enter your price"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-muted-foreground">Short Note</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Tell the client why you're a good fit..."
              className="resize-none h-20"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setExpanded(false)}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Bid
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}

function ScheduleRow({
  time,
  title,
  status,
}: {
  time: string;
  title: string;
  status: "confirmed" | "pending";
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
      <div className="w-14 shrink-0">
        <div className="text-base font-extrabold">{time}</div>
      </div>
      <div className="flex-1 font-semibold text-sm truncate">{title}</div>
      <span
        className={[
          "rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
          status === "confirmed" && "bg-success/15 text-success",
          status === "pending" && "bg-accent/20 text-foreground",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {status}
      </span>
    </div>
  );
}
