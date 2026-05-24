import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { MapPin, Briefcase, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/artisans/jobs")({
  component: ArtisanJobFeed,
});

function ArtisanJobFeed() {
  return (
    <div className="min-h-screen bg-muted/30 pb-12">
      <Header />
      <main className="mx-auto max-w-4xl px-4 pt-12">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-extrabold">Available Jobs</h1>
          <div className="flex gap-2">
            <span className="px-4 py-2 rounded-full bg-primary text-white text-sm font-bold">
              Nearby
            </span>
            <span className="px-4 py-2 rounded-full bg-card border border-border text-sm font-bold">
              My Skills
            </span>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="group cursor-pointer rounded-3xl border border-border bg-card p-6 shadow-sm hover:border-primary transition-all"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Briefcase className="h-5 w-5" />
                    </span>
                    <h2 className="text-xl font-bold">Leaking Kitchen Sink</h2>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" /> Kimironko (2.4 km)
                    </span>
                    <span className="font-bold text-foreground">Budget: 15,000 RWF</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-muted-foreground uppercase">Posted 2h ago</p>
                  <button className="mt-3 flex items-center gap-1 font-bold text-primary">
                    View Details <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className="mt-4 text-muted-foreground line-clamp-2">
                The pipe under the kitchen sink is leaking heavily. Need someone to replace the
                washer or the whole pipe if necessary.
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
