// File: web/src/components/AuthModal.tsx
// Updated: full cascading Rwanda address (Province→District→Sector→Cell→Village)
// + house_number, landmark, street_road in registration step 2

import React, { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  Loader2,
  User,
  Phone,
  Mail,
  MapPin,
  Shield,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Info,
  Home,
  Navigation,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/authStore";
import api from "@/services/api";
import RWANDA_ADDRESSES from "@/data/rwanda-addresses";

// ── Rwanda helpers ──────────────────────────────────────────────────────────

const getProvinces = () => Object.keys(RWANDA_ADDRESSES).sort();
const getDistricts = (province: string) => Object.keys(RWANDA_ADDRESSES[province] ?? {}).sort();
const getSectors = (province: string, district: string) =>
  Object.keys(RWANDA_ADDRESSES[province]?.[district] ?? {}).sort();
const getCells = (province: string, district: string, sector: string) =>
  Object.keys(RWANDA_ADDRESSES[province]?.[district]?.[sector] ?? {}).sort();
const getVillages = (province: string, district: string, sector: string, cell: string) =>
  [...(RWANDA_ADDRESSES[province]?.[district]?.[sector]?.[cell] ?? [])].sort();

// ── Validation schemas ──────────────────────────────────────────────────────

const step1Schema = z.object({
  role: z.enum(["client", "artisan"]),
  fullName: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .refine((v) => v.trim().split(/\s+/).length >= 2, "Please enter first and last name"),
  phone: z.string().regex(/^\+2507[2-9]\d{7}$/, "Enter a valid Rwanda number: +2507XXXXXXXX"),
  email: z.string().email("Invalid email address"),
  preferred_lang: z.enum(["rw", "en", "fr"]),
});

const step2Schema = z.object({
  gender: z.enum(["male", "female", "prefer_not_to_say"]).optional(),
  date_of_birth: z
    .string()
    .optional()
    .refine((v) => {
      if (!v) return true;
      const d = new Date(v);
      const age = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
      return age >= 18 && age <= 120;
    }, "You must be at least 18 years old"),
  national_id: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{16}$/.test(v), "National ID must be exactly 16 digits"),
  province: z.string().optional(),
  district: z.string().optional(),
  sector: z.string().optional(),
  cell: z.string().optional(),
  village: z.string().optional(),
  street_road: z.string().max(200).optional(),
  house_number: z.string().max(50).optional(),
  landmark: z.string().max(200).optional(),
});

const step3Schema = z.object({
  agreed_to_terms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the terms and conditions" }),
  }),
});

const loginSchema = z.object({ email: z.string().email("Invalid email address") });

// ── Step indicator ──────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  const labels = ["Identity", "Location", "Confirm"];
  return (
    <div className="flex items-center gap-2 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                i < current
                  ? "bg-primary text-primary-foreground"
                  : i === current
                    ? "bg-primary/20 text-primary border-2 border-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i < current ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
            </div>
            <span
              className={`text-[10px] font-medium ${i === current ? "text-primary" : "text-muted-foreground"}`}
            >
              {labels[i]}
            </span>
          </div>
          {i < total - 1 && (
            <div className={`flex-1 h-0.5 mb-4 ${i < current ? "bg-primary" : "bg-muted"}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── AddressSection — cascading dropdowns ────────────────────────────────────

interface AddressValues {
  province?: string;
  district?: string;
  sector?: string;
  cell?: string;
  village?: string;
  street_road?: string;
  house_number?: string;
  landmark?: string;
}

function AddressSection({
  form,
}: {
  form: ReturnType<typeof useForm<z.infer<typeof step2Schema>>>;
}) {
  const province = form.watch("province");
  const district = form.watch("district");
  const sector = form.watch("sector");
  const cell = form.watch("cell");

  const provinces = useMemo(() => getProvinces(), []);
  const districts = useMemo(() => (province ? getDistricts(province) : []), [province]);
  const sectors = useMemo(
    () => (province && district ? getSectors(province, district) : []),
    [province, district],
  );
  const cells = useMemo(
    () => (province && district && sector ? getCells(province, district, sector) : []),
    [province, district, sector],
  );
  const villages = useMemo(
    () =>
      province && district && sector && cell ? getVillages(province, district, sector, cell) : [],
    [province, district, sector, cell],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-1">
        <MapPin className="w-4 h-4 text-primary" />
        Rwanda Administrative Address
      </div>

      {/* Province + District */}
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="province"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Province</FormLabel>
              <Select
                onValueChange={(v) => {
                  field.onChange(v);
                  form.setValue("district", "");
                  form.setValue("sector", "");
                  form.setValue("cell", "");
                  form.setValue("village", "");
                }}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select province" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {provinces.map((p) => (
                    <SelectItem key={p} value={p} className="text-xs">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="district"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">District</FormLabel>
              <Select
                onValueChange={(v) => {
                  field.onChange(v);
                  form.setValue("sector", "");
                  form.setValue("cell", "");
                  form.setValue("village", "");
                }}
                value={field.value}
                disabled={!province}
              >
                <FormControl>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue
                      placeholder={province ? "Select district" : "Pick province first"}
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="max-h-48">
                  {districts.map((d) => (
                    <SelectItem key={d} value={d} className="text-xs">
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Sector + Cell */}
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="sector"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Sector</FormLabel>
              <Select
                onValueChange={(v) => {
                  field.onChange(v);
                  form.setValue("cell", "");
                  form.setValue("village", "");
                }}
                value={field.value}
                disabled={!district}
              >
                <FormControl>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder={district ? "Select sector" : "Pick district first"} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="max-h-48">
                  {sectors.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="cell"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Cell</FormLabel>
              <Select
                onValueChange={(v) => {
                  field.onChange(v);
                  form.setValue("village", "");
                }}
                value={field.value}
                disabled={!sector}
              >
                <FormControl>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder={sector ? "Select cell" : "Pick sector first"} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="max-h-48">
                  {cells.map((c) => (
                    <SelectItem key={c} value={c} className="text-xs">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Village */}
      <FormField
        control={form.control}
        name="village"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">Village</FormLabel>
            <Select onValueChange={field.onChange} value={field.value} disabled={!cell}>
              <FormControl>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder={cell ? "Select village" : "Pick cell first"} />
                </SelectTrigger>
              </FormControl>
              <SelectContent className="max-h-48">
                {villages.map((v) => (
                  <SelectItem key={v} value={v} className="text-xs">
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Street + House */}
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="street_road"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Street / Road</FormLabel>
              <FormControl>
                <div className="relative">
                  <Navigation className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input className="pl-8 h-9 text-xs" placeholder="e.g. KG 15 Ave" {...field} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="house_number"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">House / Plot No.</FormLabel>
              <FormControl>
                <div className="relative">
                  <Home className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input className="pl-8 h-9 text-xs" placeholder="e.g. 42B" {...field} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Landmark */}
      <FormField
        control={form.control}
        name="landmark"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">Landmark</FormLabel>
            <FormControl>
              <div className="relative">
                <MapPin className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 h-9 text-xs"
                  placeholder="e.g. Near Kigali Convention Centre"
                  {...field}
                />
              </div>
            </FormControl>
            <FormDescription className="text-[11px]">
              Helps artisans find you easily
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "login" | "register";
}

type RegStep = 0 | 1 | 2;

type RegistrationData = z.infer<typeof step1Schema> & z.infer<typeof step2Schema>;

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, defaultTab = "login" }) => {
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [regStep, setRegStep] = useState<RegStep>(0);
  const [loginStep, setLoginStep] = useState<"request" | "verify">("request");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

  const [regData, setRegData] = useState<RegistrationData>({
    role: "client",
    fullName: "",
    phone: "",
    email: "",
    preferred_lang: "rw",
  });

  const setAuth = useAuthStore((state) => state.setAuth);

  const step1Form = useForm<z.infer<typeof step1Schema>>({
    resolver: zodResolver(step1Schema),
    defaultValues: { role: "client", fullName: "", phone: "", email: "", preferred_lang: "rw" },
  });

  const step2Form = useForm<z.infer<typeof step2Schema>>({
    resolver: zodResolver(step2Schema),
    defaultValues: {},
  });

  const step3Form = useForm<z.infer<typeof step3Schema>>({
    resolver: zodResolver(step3Schema),
  });

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "" },
  });

  const startCooldown = (seconds: number) => {
    setOtpCooldown(seconds);
    const iv = setInterval(() => {
      setOtpCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(iv);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleRequestOtp = async (values: z.infer<typeof loginSchema>) => {
    setIsLoading(true);
    try {
      await api.post("/auth/otp/request", { email: values.email, lang: "en" });
      setEmail(values.email);
      setLoginStep("verify");
      startCooldown(60);
      toast.success("Verification code sent!", {
        description: `Check your inbox at ${values.email}`,
      });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string | { message?: string } } } };
      const detail = err.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : (detail as { message?: string })?.message;
      toast.error(msg || "Failed to send code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (otp: string) => {
    if (otp.length !== 6) return;
    setIsLoading(true);
    try {
      const res = await api.post("/auth/otp/verify", { email, otp_code: otp });
      const { user, access_token, refresh_token } = res.data;
      setAuth(
        {
          id: user.id,
          fullName: user.full_name,
          phone: user.phone_number,
          email: user.email,
          role: user.role,
          avatarUrl: user.avatar_url,
          province: user.province ?? null,
          district: user.district ?? null,
          sector: user.sector ?? null,
          cell: user.cell ?? null,
          village: user.village ?? null,
          streetRoad: user.street_road ?? null,
          houseNumber: user.house_number ?? null,
          landmark: user.landmark ?? null,
          addressDetail: user.address_detail ?? null,
          preferredLang: user.preferred_lang ?? "rw",
          accountStatus: user.account_status,
          emailVerified: user.email_verified ?? true,
          // Sprint 8: Referral System
          referralCode: user.referral_code ?? null,
          walletBalanceRwf: user.wallet_balance_rwf ?? 0,
        },
        access_token,
        refresh_token,
      );
      toast.success(`Welcome back, ${user.full_name.split(" ")[0]}!`);
      onClose();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: { message?: string } | string } } };
      const detail = err.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : (detail as { message?: string })?.message;
      toast.error(msg || "Invalid code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpCooldown > 0) return;
    setIsLoading(true);
    try {
      await api.post("/auth/otp/request", { email, lang: "en" });
      startCooldown(60);
      toast.success("New code sent!");
    } catch {
      toast.error("Failed to resend. Please wait and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStep1 = (values: z.infer<typeof step1Schema>) => {
    setRegData((prev) => ({ ...prev, ...values }));
    setRegStep(1);
  };

  const handleStep2 = (values: z.infer<typeof step2Schema>) => {
    setRegData((prev) => ({ ...prev, ...values }));
    setRegStep(2);
  };

  const handleStep3 = async (values: z.infer<typeof step3Schema>) => {
    const merged = { ...regData, ...values };
    setIsLoading(true);
    try {
      // Sprint 8: pick up ?ref=HW-XXX-XXXX from URL if present
      const urlRef = new URLSearchParams(window.location.search).get("ref");

      const payload = {
        full_name: merged.fullName,
        phone_number: merged.phone,
        email: merged.email,
        role: merged.role,
        preferred_lang: merged.preferred_lang || "rw",
        gender: merged.gender || null,
        date_of_birth: merged.date_of_birth || null,
        national_id: merged.national_id || null,
        province: merged.province || null,
        district: merged.district || null,
        sector: merged.sector || null,
        cell: merged.cell || null,
        village: merged.village || null,
        street_road: merged.street_road || null,
        house_number: merged.house_number || null,
        landmark: merged.landmark || null,
        agreed_to_terms: true,
        terms_version: "v1.0",
      };
      const url = urlRef
        ? `/auth/register?ref=${encodeURIComponent(urlRef)}`
        : "/auth/register";
      const res = await api.post(url, payload);
      toast.success("Account created!", {
        description: res.data.message || "Check your email for a verification code.",
      });
      loginForm.setValue("email", merged.email);
      setEmail(merged.email);
      setActiveTab("login");
      setLoginStep("verify");
      startCooldown(60);
      setRegStep(0);
      setRegData({ role: "client", fullName: "", phone: "", email: "", preferred_lang: "rw" });
    } catch (error: unknown) {
      const err = error as {
        response?: {
          data?: { detail?: string | { code?: string; message?: string; field?: string } };
        };
      };
      const detail = err.response?.data?.detail;
      if (typeof detail === "object" && detail?.field === "email") {
        setRegStep(0);
        step1Form.setError("email", { message: detail.message });
        toast.error("Email already registered.");
      } else if (typeof detail === "object" && detail?.field === "phone_number") {
        setRegStep(0);
        step1Form.setError("phone", { message: detail.message });
        toast.error("Phone number already registered.");
      } else {
        const msg = typeof detail === "string" ? detail : detail?.message;
        toast.error(msg || "Registration failed. Please check your details.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const roleWatched = step1Form.watch("role");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px] bg-surface border border-border text-text shadow-card rounded-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-text">
            {activeTab === "login" ? "Welcome Back" : "Create Account"}
          </DialogTitle>
          {activeTab === "login" && (
            <p className="text-sm text-muted-foreground">Sign in to your HandyRwanda account</p>
          )}
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(t) => {
            setActiveTab(t);
            if (t === "register") setRegStep(0);
          }}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="login">Sign In</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>

          {/* ── LOGIN TAB ─────────────────────────────────────────────── */}
          <TabsContent value="login">
            {loginStep === "request" ? (
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(handleRequestOtp)} className="space-y-4">
                  <div className="bg-primary/5 rounded-lg p-3 flex gap-2 text-sm text-muted-foreground">
                    <Info className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                    <span>We'll send a 6-digit code to your email — no password needed.</span>
                  </div>
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input className="pl-9" placeholder="name@example.com" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Send Verification Code
                  </Button>
                </form>
              </Form>
            ) : (
              <div className="space-y-5">
                <div className="bg-green-500/10 rounded-lg p-3 flex gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-green-600" />
                  <span>
                    Code sent to <strong>{email}</strong>. Check your inbox (and spam).
                  </span>
                </div>
                <div className="flex justify-center">
                  <div className="space-y-3 text-center">
                    <p className="text-sm text-muted-foreground">Enter the 6-digit code</p>
                    <InputOTP
                      maxLength={6}
                      onComplete={handleVerifyOtp}
                      disabled={isLoading}
                      autoFocus
                    >
                      <InputOTPGroup>
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                          <InputOTPSlot key={i} index={i} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                    {isLoading && (
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <Button variant="ghost" size="sm" onClick={() => setLoginStep("request")}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Change email
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResendOtp}
                    disabled={otpCooldown > 0 || isLoading}
                  >
                    {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : "Resend code"}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── REGISTER TAB ──────────────────────────────────────────── */}
          <TabsContent value="register">
            <StepIndicator current={regStep} total={3} />

            {/* Step 0 — Core Identity */}
            {regStep === 0 && (
              <Form {...step1Form}>
                <form onSubmit={step1Form.handleSubmit(handleStep1)} className="space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-sm">Who are you?</span>
                  </div>

                  <FormField
                    control={step1Form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>I want to…</FormLabel>
                        <div className="grid grid-cols-2 gap-2">
                          {(["client", "artisan"] as const).map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => field.onChange(r)}
                              className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                                field.value === r
                                  ? "bg-primary/10 border-primary text-primary"
                                  : "border-border text-muted-foreground hover:border-primary/50"
                              }`}
                            >
                              {r === "client" ? "🔍 Find Services" : "🔨 Offer Services"}
                              <div className="text-xs font-normal mt-0.5 opacity-70">
                                {r === "client" ? "I need help" : "I'm an artisan"}
                              </div>
                            </button>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step1Form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Full Name <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input className="pl-9" placeholder="Amina Uwimana" {...field} />
                          </div>
                        </FormControl>
                        <FormDescription>As it appears on your ID</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step1Form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Phone Number <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input className="pl-9" placeholder="+250780000000" {...field} />
                          </div>
                        </FormControl>
                        <FormDescription>Rwanda number starting with +2507</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step1Form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Email Address <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input className="pl-9" placeholder="amina@example.com" {...field} />
                          </div>
                        </FormControl>
                        <FormDescription>Used for login verification codes</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step1Form.control}
                    name="preferred_lang"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preferred Language</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="rw">🇷🇼 Kinyarwanda</SelectItem>
                            <SelectItem value="en">🇬🇧 English</SelectItem>
                            <SelectItem value="fr">🇫🇷 Français</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full">
                    Continue <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </form>
              </Form>
            )}

            {/* Step 1 — Location & Identity */}
            {regStep === 1 && (
              <Form {...step2Form}>
                <form onSubmit={step2Form.handleSubmit(handleStep2)} className="space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-sm">Location & Identity</span>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      Optional
                    </Badge>
                  </div>

                  <div className="bg-blue-500/5 rounded-lg p-3 flex gap-2 text-xs text-muted-foreground">
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-500" />
                    <span>
                      Your location helps us match you with nearby artisans. The more detail you
                      provide, the better the match.
                    </span>
                  </div>

                  {/* Gender + DOB */}
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={step2Form.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gender</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                              <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={step2Form.control}
                      name="date_of_birth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of Birth</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              {...field}
                              max={
                                new Date(Date.now() - 18 * 365.25 * 86400000)
                                  .toISOString()
                                  .split("T")[0]
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* National ID */}
                  <FormField
                    control={step2Form.control}
                    name="national_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>National ID (Indangamuntu)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Shield className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              className="pl-9 tracking-widest"
                              placeholder="16-digit ID number"
                              maxLength={16}
                              {...field}
                              onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ""))}
                            />
                          </div>
                        </FormControl>
                        {field.value && (
                          <p
                            className={`text-xs mt-1 ${field.value.length === 16 ? "text-green-600" : "text-muted-foreground"}`}
                          >
                            {field.value.length}/16 digits {field.value.length === 16 ? "✓" : ""}
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {roleWatched === "artisan" && (
                    <div className="bg-amber-500/10 rounded-lg p-3 flex gap-2 text-xs">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
                      <span className="text-amber-700">
                        As an artisan, your location helps clients find you. Your National ID will
                        be used to verify your identity before accepting paid jobs.
                      </span>
                    </div>
                  )}

                  {/* Full cascading address */}
                  <div className="border rounded-xl p-3 bg-muted/20">
                    <AddressSection form={step2Form} />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setRegStep(0)}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" /> Back
                    </Button>
                    <Button type="submit" className="flex-1">
                      Continue <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </form>
              </Form>
            )}

            {/* Step 2 — Terms & Submit */}
            {regStep === 2 && (
              <Form {...step3Form}>
                <form onSubmit={step3Form.handleSubmit(handleStep3)} className="space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-sm">Review & Confirm</span>
                  </div>

                  <div className="bg-muted/50 rounded-xl p-4 space-y-2 text-sm">
                    {[
                      ["Name", regData.fullName],
                      ["Email", regData.email],
                      ["Phone", regData.phone],
                    ].map(([label, val]) => (
                      <div key={label} className="flex justify-between">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">{val}</span>
                      </div>
                    ))}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Role</span>
                      <Badge variant={regData.role === "artisan" ? "default" : "secondary"}>
                        {regData.role}
                      </Badge>
                    </div>
                    {regData.province && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Province</span>
                        <span className="font-medium">{regData.province}</span>
                      </div>
                    )}
                    {regData.district && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">District</span>
                        <span className="font-medium">{regData.district}</span>
                      </div>
                    )}
                    {(regData.sector || regData.cell || regData.village) && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Area</span>
                        <span className="font-medium text-right text-xs">
                          {[regData.village, regData.cell, regData.sector]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </div>
                    )}
                    {(regData.street_road || regData.house_number) && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Street</span>
                        <span className="font-medium text-xs">
                          {[regData.house_number, regData.street_road].filter(Boolean).join(", ")}
                        </span>
                      </div>
                    )}
                  </div>

                  <FormField
                    control={step3Form.control}
                    name="agreed_to_terms"
                    render={({ field }) => (
                      <FormItem className="flex gap-3 items-start space-y-0 rounded-xl border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value === true}
                            onCheckedChange={(v) => field.onChange(v === true ? true : undefined)}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="cursor-pointer">
                            I agree to the Terms & Conditions and Privacy Policy
                          </FormLabel>
                          <FormDescription>
                            By registering, you confirm you are at least 18 years old and agree to
                            HandyRwanda's{" "}
                            <a href="/terms" className="text-primary underline" target="_blank">
                              Terms of Service
                            </a>{" "}
                            and{" "}
                            <a href="/privacy" className="text-primary underline" target="_blank">
                              Privacy Policy
                            </a>
                            .
                          </FormDescription>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />

                  <div className="bg-primary/5 rounded-lg p-3 flex gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
                    <span>
                      After registration, we'll send a 6-digit code to your email to activate your
                      account.
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setRegStep(1)}
                      disabled={isLoading}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" /> Back
                    </Button>
                    <Button type="submit" className="flex-1" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account…
                        </>
                      ) : (
                        <>
                          Create Account <CheckCircle2 className="w-4 h-4 ml-1" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
