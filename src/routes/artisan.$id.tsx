import { useState } from "react";
import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import {
  Star, MapPin, ShieldCheck, Briefcase, Clock, Languages, Award, ArrowRight, MessageCircle, CheckCircle2,
} from "lucide-react";
import { Header } from "@/components/Header";
import { BookingSheet } from "@/components/BookingSheet";
import { artisans, reviews, formatRWF } from "@/lib/data";
import portfolio1 from "@/assets/portfolio-1.jpg";
import portfolio2 from "@/assets/portfolio-2.jpg";
import portfolio3 from "@/assets/portfolio-3.jpg";
import heroWork from "@/assets/hero-work.jpg";

export const Route = createFileRoute("/artisan/$id")({
  loader: ({ params }) => {
    const a = artisans.find((x) => x.id === params.id);
    if (!a) throw notFound();
    return { a };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.a.name} — ${loaderData?.a.category} in ${loaderData?.a.district} | HandyRwanda` },
      { name: "description", content: loaderData?.a.bio ?? "" },
      { property: "og:title", content: `${loaderData?.a.name} on HandyRwanda` },
      { property: "og:description", content: loaderData?.a.bio ?? "" },
      { property: "og:image", content: loaderData?.a.photo },
    ],
  }),
  notFoundComponent: () => (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-bold">Artisan not found</h1>
        <Link to="/search" className="mt-3 inline-block text-primary font-semibold">Browse artisans →</Link>
      </div>
    </div>
  ),
  component: Profile,
});

const portfolio = [portfolio1, portfolio2, portfolio3];

function Profile() {
  const { a } = Route.useLoaderData();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh pb-28">
      <Header />

      {/* Hero */}
      <div className="relative h-[220px] w-full overflow-hidden sm:h-[280px]">
        <img src={heroWork} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      </div>

      <main className="mx-auto -mt-14 max-w-3xl px-4 sm:px-6">
        {/* Header card */}
        <div className="relative rounded-3xl border border-border bg-card p-6 shadow-lift">
          <img
            src={a.photo}
            alt={a.name}
            className="absolute -top-10 left-6 h-20 w-20 rounded-full object-cover ring-4 ring-card shadow-card"
          />
          <div className="ml-24">
            <h1 className="text-2xl font-extrabold leading-tight">{a.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
            {a.categories.map((c: string) => (
              <span key={c} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{c}</span>
              ))}
              {a.verified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--verified)]/10 px-2.5 py-0.5 text-xs font-bold text-[color:var(--verified)]">
                  <ShieldCheck className="h-3.5 w-3.5" /> Verified
                </span>
              )}
            </div>
          </div>

          {/* Trust metrics */}
          <div className="mt-6 grid grid-cols-3 gap-3 rounded-2xl bg-muted/50 p-4">
            <Stat icon={<Star className="h-4 w-4 fill-accent text-accent" />} value={a.rating.toFixed(1)} label="Rating" />
            <Stat icon={<Briefcase className="h-4 w-4 text-success" />} value={a.jobs} label="Completed" />
            <Stat icon={<MapPin className="h-4 w-4 text-primary" />} value={`${a.distanceKm}km`} label="Distance" />
          </div>

          {/* Social proof */}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Clock className="h-4 w-4" /> {a.responseTime}</span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">📈 Booked {a.weeklyBookings} times this week</span>
          </div>
        </div>

        {/* About */}
        <section className="mt-6">
          <h2 className="text-lg font-bold">About</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-foreground">{a.bio}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge icon={<Award className="h-3.5 w-3.5" />}>{a.experienceYears} years experience</Badge>
            <Badge icon={<MapPin className="h-3.5 w-3.5" />}>From {a.district}</Badge>
            {a.languages.map((l: string) => (
              <Badge key={l} icon={<Languages className="h-3.5 w-3.5" />}>Speaks {l}</Badge>
            ))}
            <Badge icon={<CheckCircle2 className="h-3.5 w-3.5" />}>ID verified</Badge>
          </div>
        </section>

        {/* Portfolio */}
        <section className="mt-8">
          <h2 className="text-lg font-bold">Imirimo yakoze</h2>
          <p className="text-sm text-muted-foreground">Work done</p>
          <div className="-mx-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {portfolio.map((src, i) => (
              <div key={i} className="relative aspect-[4/3] w-[78%] shrink-0 snap-start overflow-hidden rounded-2xl bg-muted sm:w-72">
                <img src={src} alt="Past work" loading="lazy" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </section>

        {/* Reviews */}
        <section className="mt-8">
          <div className="flex items-end justify-between">
            <h2 className="text-lg font-bold">Reviews</h2>
            <button className="text-sm font-semibold text-primary hover:underline">See all {a.reviews}</button>
          </div>
          <div className="mt-3 space-y-3">
            {reviews.map((r) => (
              <article key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-accent/20 font-bold text-foreground">
                    {r.name[0]}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{r.name}</p>
                      <span className="text-xs text-muted-foreground">{r.daysAgo} days ago</span>
                    </div>
                    <div className="flex">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-accent text-accent" : "text-muted"}`} />
                      ))}
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-[15px] text-foreground">{r.text}</p>
                {r.reply && (
                  <div className="mt-3 rounded-xl border-l-4 border-primary bg-muted/40 p-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-primary">
                      <MessageCircle className="h-3.5 w-3.5" /> {a.name.split(" ")[0]} replied
                    </div>
                    <p className="mt-1 text-sm text-foreground">{r.reply}</p>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      </main>

      {/* Sticky booking footer */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Starting from</div>
            <div className="text-lg font-extrabold text-foreground">
              {formatRWF(a.startingPrice)} <span className="text-sm font-semibold text-muted-foreground">RWF</span>
            </div>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="flex min-h-12 items-center gap-2 rounded-2xl bg-accent px-6 py-3.5 font-bold text-accent-foreground transition hover:brightness-95"
          >
            Book Now <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <BookingSheet a={a} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: React.ReactNode; label: string }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1.5">
        {icon}
        <div className="text-2xl font-extrabold leading-none">{value}</div>
      </div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function Badge({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-foreground">
      {icon} {children}
    </span>
  );
}
