// File: web/src/routes/join.tsx
/**
 * Sprint 8 — /join?ref=HW-XXX-XXXX
 *
 * Landing page for referred users. Shows an incentive banner ("Your friend
 * invited you — complete your first booking for 500 RWF credit!") and
 * immediately opens the registration modal.
 */
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { Gift, Star, CheckCircle2, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import referralService from "@/services/referralService";
import { AuthModal } from "@/components/AuthModal";
import { useAuthStore } from "@/store/authStore";

export const Route = createFileRoute("/join")({
  validateSearch: (search: Record<string, unknown>) => ({
    ref: typeof search.ref === "string" ? search.ref : undefined,
  }),
  head: () => ({
    meta: [
      { title: "You've Been Invited — HandyRwanda" },
      {
        name: "description",
        content: "Join HandyRwanda and earn 500 RWF credit on your first booking.",
      },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const { ref } = useSearch({ from: "/join" });
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);

  // Redirect authenticated users straight to home
  useEffect(() => {
    if (isAuthenticated) navigate({ to: "/" });
  }, [isAuthenticated, navigate]);

  // Auto-open registration modal after a short delay so the banner renders first
  useEffect(() => {
    const t = setTimeout(() => setModalOpen(true), 800);
    return () => clearTimeout(t);
  }, []);

  const { data: validation } = useQuery({
    queryKey: ["validateRef", ref],
    queryFn: () => referralService.validateCode(ref!),
    enabled: !!ref,
    retry: false,
  });

  const features = [
    "Vetted & background-checked artisans",
    "Transparent pricing — no surprise fees",
    "Real-time booking tracking",
    "Secure escrow payments",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-background to-orange-50 dark:from-amber-950/20 dark:to-background flex flex-col items-center justify-center px-4 py-12">
      {/* Incentive card */}
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
            <Gift size={28} className="text-white" />
          </div>
        </div>

        {/* Headline */}
        <div className="text-center mb-8">
          {validation ? (
            <>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                {validation.referrer_first_name} invited you to HandyRwanda! 🎉
              </h1>
              <p className="text-muted-foreground">
                Complete your first booking and you'll both earn{" "}
                <span className="font-bold text-amber-600">500 RWF credit</span>.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                You've been invited to HandyRwanda! 🎉
              </h1>
              <p className="text-muted-foreground">
                Rwanda's #1 marketplace for trusted home service professionals.
              </p>
            </>
          )}
        </div>

        {/* Reward banner */}
        {ref && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 p-0.5 shadow-lg mb-6">
            <div className="rounded-[14px] bg-card px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                  <Zap size={20} className="text-amber-600" />
                </div>
                <div>
                  <p className="font-bold text-foreground text-sm">Welcome Offer</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Complete your first booking to earn{" "}
                    <span className="font-bold text-amber-600">500 RWF wallet credit</span>. No expiry.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
                <span className="font-mono text-sm font-bold tracking-widest text-amber-700 dark:text-amber-300">
                  {ref.toUpperCase()}
                </span>
                <CheckCircle2 size={14} className="text-amber-500 ml-auto" />
                <span className="text-xs text-amber-600 font-medium">Code applied</span>
              </div>
            </div>
          </div>
        )}

        {/* Features list */}
        <div className="rounded-2xl border border-border bg-card p-5 mb-6 shadow-sm">
          <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Star size={16} className="text-amber-500" />
            Why HandyRwanda?
          </p>
          <ul className="space-y-2">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm text-foreground">
                <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <button
          onClick={() => setModalOpen(true)}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all"
        >
          Create Free Account
        </button>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Already have an account?{" "}
          <button
            onClick={() => setModalOpen(true)}
            className="text-primary font-semibold underline-offset-2 hover:underline"
          >
            Log in
          </button>
        </p>
      </div>

      {/* Auth modal */}
      <AuthModal isOpen={modalOpen} onClose={() => setModalOpen(false)} defaultTab="register" />
    </div>
  );
}
