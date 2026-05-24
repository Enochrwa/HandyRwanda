import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Camera, Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/profile/portfolio")({
  component: PortfolioManagement,
});

function PortfolioManagement() {
  return (
    <div className="min-h-screen bg-muted/30 pb-12">
      <Header />
      <main className="mx-auto max-w-4xl px-4 pt-12">
        <h1 className="text-3xl font-extrabold">Your Portfolio</h1>
        <p className="text-muted-foreground mt-2">
          Showcase your best work to attract more clients.
        </p>

        <div className="mt-10 grid grid-cols-2 md:grid-cols-3 gap-6">
          <button className="aspect-square flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border bg-card text-primary hover:border-primary transition-colors">
            <Plus className="h-10 w-10 mb-2" />
            <span className="font-bold">Add Project</span>
          </button>

          {/* Mock Portfolio Items */}
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="group relative aspect-square rounded-3xl overflow-hidden bg-muted"
            >
              <img
                src={`https://picsum.photos/400?random=${i}`}
                alt="Past work"
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                <button className="p-3 rounded-full bg-white text-danger hover:scale-110 transition-transform">
                  <Trash2 className="h-6 w-6" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
