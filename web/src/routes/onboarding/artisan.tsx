import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Header } from "@/components/Header";

export const Route = createFileRoute("/onboarding/artisan")({
  component: ArtisanOnboarding,
});

function ArtisanOnboarding() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    bio: "",
    years_experience: "",
    languages: ["rw"],
    categories: [] as string[],
  });

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
    else router.navigate({ to: "/artisan/home" });
  };

  return (
    <div className="min-h-screen bg-muted/30 pb-12">
      <Header />
      <main className="mx-auto max-w-2xl px-4 pt-12">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-8">
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    s <= step ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
            <p className="mt-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Step {step} of 4
            </p>
          </div>

          {step === 1 && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold text-foreground">Tell us about yourself</h1>
              <div>
                <label className="text-sm font-semibold">Professional Bio</label>
                <textarea
                  className="mt-2 w-full rounded-xl border border-border bg-muted/20 p-4 focus:border-primary focus:ring-1 focus:ring-primary"
                  rows={4}
                  placeholder="Describe your skills..."
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                />
              </div>
              <button
                onClick={handleNext}
                className="w-full rounded-xl bg-primary py-4 font-bold text-white shadow-lift"
              >
                Continue
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold">Select your skills</h1>
              <div className="grid grid-cols-2 gap-4">
                {["Plumbing", "Electrical", "Cleaning", "Carpentry"].map((cat) => (
                  <div
                    key={cat}
                    onClick={() => {
                       const cats = formData.categories.includes(cat)
                        ? formData.categories.filter(c => c !== cat)
                        : [...formData.categories, cat];
                       setFormData({...formData, categories: cats});
                    }}
                    className={`cursor-pointer rounded-2xl border-2 p-4 text-center transition-all ${
                      formData.categories.includes(cat) ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                    }`}
                  >
                    <p className="font-bold">{cat}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={handleNext}
                className="w-full rounded-xl bg-primary py-4 font-bold text-white shadow-lift"
              >
                Next Step
              </button>
            </div>
          )}

          {/* Steps 3 & 4 would follow similar patterns for Location and ID */}
          {step > 2 && (
             <div className="space-y-6 text-center">
                <h1 className="text-2xl font-bold">Verification & Location</h1>
                <p className="text-muted-foreground">This is where you would upload your ID and set your service radius.</p>
                <button
                    onClick={handleNext}
                    className="w-full rounded-xl bg-primary py-4 font-bold text-white shadow-lift"
                >
                    {step === 4 ? "Complete Onboarding" : "Next Step"}
                </button>
             </div>
          )}
        </div>
      </main>
    </div>
  );
}
