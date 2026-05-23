import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Camera, MapPin, Calendar, Clock } from "lucide-react";

export const Route = createFileRoute("/jobs/post")({
  component: PostJob,
});

function PostJob() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  return (
    <div className="min-h-screen bg-muted/30 pb-12">
      <Header />
      <main className="mx-auto max-w-3xl px-4 pt-12">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
          <h1 className="text-3xl font-extrabold">Post a Job</h1>
          <p className="text-muted-foreground mt-2">Describe what you need fixed and get bids from verified artisans.</p>

          <div className="mt-10 space-y-8">
            {/* Category selection simplified for MVP web */}
            <div className="space-y-4">
              <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">1. What do you need help with?</label>
              <select className="w-full rounded-xl border border-border bg-muted/20 p-4 font-semibold outline-none focus:border-primary">
                <option>Plumbing</option>
                <option>Electrical</option>
                <option>Cleaning</option>
                <option>Painting</option>
              </select>
            </div>

            <div className="space-y-4">
              <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">2. Job Details</label>
              <input
                placeholder="Title (e.g., Fix leaking pipe)"
                className="w-full rounded-xl border border-border bg-muted/20 p-4 font-semibold outline-none focus:border-primary"
              />
              <textarea
                placeholder="Description of the work..."
                rows={4}
                className="w-full rounded-xl border border-border bg-muted/20 p-4 font-semibold outline-none focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <label className="text-xs font-bold text-muted-foreground uppercase">Estimated Budget (RWF)</label>
                 <input type="number" className="w-full rounded-xl border border-border bg-muted/20 p-4 font-semibold" />
               </div>
               <div className="space-y-2">
                 <label className="text-xs font-bold text-muted-foreground uppercase">Location</label>
                 <div className="relative">
                   <input className="w-full rounded-xl border border-border bg-muted/20 p-4 pl-10 font-semibold" placeholder="Search area..." />
                   <MapPin className="absolute left-3 top-4 h-5 w-5 text-muted-foreground" />
                 </div>
               </div>
            </div>

            <button
              onClick={() => router.navigate({ to: "/search" })}
              className="w-full rounded-2xl bg-primary py-5 text-lg font-bold text-white shadow-lift hover:brightness-95 transition-all"
            >
              Post Job & See Artisans
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
