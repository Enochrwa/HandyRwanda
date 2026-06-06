// File: web/src/routes/onboarding/artisan.tsx
import { useState, useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { artisanService } from "@/services/artisanService";
import { useAuthStore } from "@/store/authStore";
import { Category } from "@/types/category";
import { MapPin, Camera, User, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { RwandaAddressPicker, type RwandaAddress } from "@/components/RwandaAddressPicker";

export const Route = createFileRoute("/onboarding/artisan")({
  component: ArtisanOnboarding,
});

function ArtisanOnboarding() {
  const navigate = useNavigate();
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
    latitude: -1.9441,
    longitude: 30.0619,
    national_id: "",
    id_photo_base64: null as string | null,
    selfie_photo_base64: null as string | null,
  });

  const [artisanAddress, setArtisanAddress] = useState<Partial<RwandaAddress>>({
    province: "Kigali City",
    district: "Gasabo",
    latitude: -1.9441,
    longitude: 30.0619,
  });

  const [previews, setPreviews] = useState({
    id: null as string | null,
    selfie: null as string | null,
  });

  const idInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    artisanService.getCategories().then(setCategories);
  }, []);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (
    type: "id" | "selfie",
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        const previewUrl = URL.createObjectURL(file);

        if (type === "id") {
          setFormData({ ...formData, id_photo_base64: base64 });
          setPreviews({ ...previews, id: previewUrl });
        } else {
          setFormData({ ...formData, selfie_photo_base64: base64 });
          setPreviews({ ...previews, selfie: previewUrl });
        }
      } catch (err) {
        toast.error("Failed to process image");
      }
    }
  };

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
        const lat = artisanAddress.latitude ?? formData.latitude;
        const lng = artisanAddress.longitude ?? formData.longitude;
        const label =
          artisanAddress.formatted ?? artisanAddress.district ?? formData.location_label;
        await artisanService.updateProfile({
          location_label: label,
          service_radius_km: formData.service_radius,
          latitude: lat,
          longitude: lng,
        });
        // Also save structured address to user profile
        if (artisanAddress.district) {
          await import("@/services/api").then(({ default: api }) =>
            api.patch("/auth/profile", {
              province: artisanAddress.province ?? undefined,
              district: artisanAddress.district,
              sector: artisanAddress.sector ?? undefined,
              cell: artisanAddress.cell ?? undefined,
              village: artisanAddress.village ?? undefined,
              address_detail:
                [
                  artisanAddress.house_number,
                  artisanAddress.street_road,
                  artisanAddress.landmark ? `Near ${artisanAddress.landmark}` : "",
                ]
                  .filter(Boolean)
                  .join(", ") || undefined,
            }),
          );
        }
      } else if (step === 4) {
        if (formData.id_photo_base64 && formData.selfie_photo_base64) {
          await artisanService.submitVerification({
            national_id_number: formData.national_id,
            national_id_doc_base64: formData.id_photo_base64,
            selfie_base64: formData.selfie_photo_base64,
          });
        }
        toast.success("Registration complete! Welcome to HandyRwanda.");
        navigate({ to: "/" });
        return;
      }
      setStep(step + 1);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      toast.error(error?.response?.data?.detail ?? "Failed to save progress");
    } finally {
      setLoading(false);
    }
  };

  const isStep1Valid = formData.bio.length > 10;
  const isStep2Valid = formData.category_ids.length > 0;
  const isStep3Valid = !!(artisanAddress.district && artisanAddress.district.length > 1);
  const isStep4Valid =
    formData.national_id.length > 5 && formData.id_photo_base64 && formData.selfie_photo_base64;

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
                  placeholder="Describe your skills and experience..."
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                />
                <p className="text-[10px] mt-1 text-muted-foreground">Minimum 10 characters.</p>
              </div>
              <button
                onClick={handleNext}
                disabled={loading || !isStep1Valid}
                className="w-full rounded-xl bg-primary py-4 font-bold text-white shadow-lift disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
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
                    {formData.category_ids.includes(cat.id) && (
                      <div className="mt-1 flex justify-center">
                        <div className="bg-primary rounded-full p-0.5">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={handleNext}
                disabled={loading || !isStep2Valid}
                className="w-full rounded-xl bg-primary py-4 font-bold text-white shadow-lift disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
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
                    Your Service Area &amp; Home Address
                  </label>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">
                    Pin your location on the map, then complete your address so clients near you can
                    find you first.
                  </p>
                  <RwandaAddressPicker
                    value={artisanAddress}
                    onChange={(addr) => {
                      setArtisanAddress(addr);
                      setFormData((f) => ({
                        ...f,
                        latitude: addr.latitude,
                        longitude: addr.longitude,
                        location_label: addr.formatted,
                      }));
                    }}
                    required
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
              </div>
              <button
                onClick={handleNext}
                disabled={loading || !isStep3Valid}
                className="w-full rounded-xl bg-primary py-4 font-bold text-white shadow-lift flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
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
                  <div
                    onClick={() => idInputRef.current?.click()}
                    className="group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-6 text-center hover:border-primary/50 transition-colors cursor-pointer overflow-hidden aspect-square"
                  >
                    {previews.id ? (
                      <img
                        src={previews.id}
                        className="absolute inset-0 h-full w-full object-cover"
                        alt="ID Preview"
                      />
                    ) : (
                      <>
                        <div className="mb-2 text-2xl">🪪</div>
                        <p className="text-xs font-bold text-foreground">Photo of ID</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">Front side</p>
                      </>
                    )}
                    <input
                      type="file"
                      ref={idInputRef}
                      className="hidden"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handleFileChange("id", e)}
                    />
                    {previews.id && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Camera className="h-8 w-8 text-white" />
                      </div>
                    )}
                  </div>

                  <div
                    onClick={() => selfieInputRef.current?.click()}
                    className="group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-6 text-center hover:border-primary/50 transition-colors cursor-pointer overflow-hidden aspect-square"
                  >
                    {previews.selfie ? (
                      <img
                        src={previews.selfie}
                        className="absolute inset-0 h-full w-full object-cover"
                        alt="Selfie Preview"
                      />
                    ) : (
                      <>
                        <div className="mb-2 text-2xl">🤳</div>
                        <p className="text-xs font-bold text-foreground">Selfie</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">Holding ID</p>
                      </>
                    )}
                    <input
                      type="file"
                      ref={selfieInputRef}
                      className="hidden"
                      accept="image/*"
                      capture="user"
                      onChange={(e) => handleFileChange("selfie", e)}
                    />
                    {previews.selfie && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <User className="h-8 w-8 text-white" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-accent/10 p-4 border border-accent/20">
                <p className="text-xs text-accent leading-normal font-medium">
                  Photos are encrypted and only used for verification. This usually takes 24-48
                  hours.
                </p>
              </div>

              <button
                onClick={handleNext}
                disabled={loading || !isStep4Valid}
                className="w-full rounded-xl bg-primary py-4 font-bold text-white shadow-lift disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Completing..." : "Complete Onboarding"}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
