import { useState, useEffect } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { artisanService } from "@/services/artisanService";
import { useAuthStore } from "@/store/authStore";
import { Category } from "@/types/category";

export const Route = createFileRoute("/onboarding/artisan")({
  component: ArtisanOnboarding,
});

function ArtisanOnboarding() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState({
    bio: "",
    years_experience: "0",
    languages: ["rw"],
    category_ids: [] as string[],
    service_radius: 15,
    location_label: "",
    national_id: "",
    id_photo_base64: null as string | null,
    selfie_photo_base64: null as string | null,
  });

  useEffect(() => {
    artisanService.getCategories().then(setCategories);
  }, []);

  const handleNext = async () => {
    setLoading(true);
    try {
      if (step === 1) {
        await artisanService.updateProfile({
          bio: formData.bio,
          years_experience: parseInt(formData.years_experience),
          spoken_languages: formData.languages.join(","),
        });
      } else if (step === 2) {
        await artisanService.updateSkills(formData.category_ids);
      } else if (step === 3) {
        await artisanService.updateProfile({
          location_label: formData.location_label,
          service_radius_km: formData.service_radius,
          // Placeholder for real map coordinates
          latitude: -1.9441,
          longitude: 30.0619,
        });
      } else if (step === 4) {
        if (formData.id_photo_base64 && formData.selfie_photo_base64) {
          await artisanService.submitVerification({
            national_id_number: formData.national_id,
            national_id_doc_base64: formData.id_photo_base64,
            selfie_base64: formData.selfie_photo_base64,
          });
        }
        router.navigate({ to: "/" });
        return;
      }
      setStep(step + 1);
    } catch (err) {
      console.error("Onboarding error:", err);
    } finally {
      setLoading(false);
    }
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
                disabled={loading || !formData.location_label}
                className="w-full rounded-xl bg-primary py-4 font-bold text-white shadow-lift disabled:opacity-50"
              >
                {loading ? "Saving..." : "Continue"}
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold">Select your skills</h1>
              <div className="grid grid-cols-2 gap-4">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    onClick={() => {
                      const cats = formData.category_ids.includes(cat.id)
                        ? formData.category_ids.filter((id) => id !== cat.id)
                        : [...formData.category_ids, cat.id];
                      setFormData({ ...formData, category_ids: cats });
                    }}
                    className={`cursor-pointer rounded-2xl border-2 p-4 text-center transition-all ${
                      formData.category_ids.includes(cat.id)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="text-2xl mb-1">{cat.icon_emoji}</div>
                    <p className="font-bold">{cat.name_en}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={handleNext}
                disabled={loading || formData.category_ids.length === 0}
                className="w-full rounded-xl bg-primary py-4 font-bold text-white shadow-lift disabled:opacity-50"
              >
                {loading ? "Saving..." : "Next Step"}
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold">Where do you work?</h1>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-muted-foreground">
                    Your Base Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Kimironko, Kigali"
                    className="mt-2 w-full rounded-xl border border-border bg-muted/20 p-4"
                    value={formData.location_label}
                    onChange={(e) => setFormData({ ...formData, location_label: e.target.value })}
                  />
                </div>
                <div>
                  <div className="flex justify-between text-sm font-semibold">
                    <label>Service Radius</label>
                    <span className="text-primary">{formData.service_radius} km</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    className="mt-4 w-full accent-primary"
                    value={formData.service_radius}
                    onChange={(e) =>
                      setFormData({ ...formData, service_radius: parseInt(e.target.value) })
                    }
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Clients within this radius will be able to find and book you.
                  </p>
                </div>
                <div className="aspect-video w-full rounded-2xl bg-muted/30 flex items-center justify-center border-2 border-dashed border-border">
                  <p className="text-sm text-muted-foreground">Map selection placeholder</p>
                </div>
              </div>
              <button
                onClick={handleNext}
                className="w-full rounded-xl bg-primary py-4 font-bold text-white shadow-lift"
              >
                Continue
              </button>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold">Verify your identity</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                To build trust on HandyRwanda, we require all artisans to verify their identity with
                a National ID.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold">National ID Number</label>
                  <input
                    type="text"
                    placeholder="1 19XX 8 XXXXXX X XX"
                    className="mt-2 w-full rounded-xl border border-border bg-muted/20 p-4"
                    value={formData.national_id}
                    onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-6 text-center hover:border-primary/50 transition-colors">
                    <div className="mb-2 text-2xl">🪪</div>
                    <p className="text-xs font-bold text-foreground">Photo of ID</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">Front side</p>
                  </div>
                  <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-6 text-center hover:border-primary/50 transition-colors">
                    <div className="mb-2 text-2xl">🤳</div>
                    <p className="text-xs font-bold text-foreground">Selfie</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">Holding ID</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-accentLight p-4">
                <p className="text-xs text-accent leading-normal">
                  Verification usually takes 24-48 hours. You can still browse jobs while we review
                  your documents.
                </p>
              </div>

              <button
                onClick={handleNext}
                disabled={loading || !formData.national_id}
                className="w-full rounded-xl bg-primary py-4 font-bold text-white shadow-lift disabled:opacity-50"
              >
                {loading ? "Completing..." : "Complete Onboarding"}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
