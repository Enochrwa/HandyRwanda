// File: mobile/app/auth.tsx

import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Toast from 'react-native-toast-message';
import * as z from 'zod';

import api from '../src/services/api';
import { useAuthStore } from '../src/store/authStore';

// ── Schemas ────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const otpSchema = z.object({
  otp: z
    .string()
    .length(6, 'OTP must be exactly 6 digits')
    .regex(/^\d{6}$/, 'Digits only'),
});

const reg1Schema = z.object({
  role: z.enum(['client', 'artisan']),
  fullName: z
    .string()
    .min(2, 'Name too short')
    .refine((v) => v.trim().split(/\s+/).length >= 2, 'Please enter first and last name'),
  phone: z.string().regex(/^\+2507[2-9]\d{7}$/, 'Valid Rwanda number: +2507XXXXXXXX'),
  email: z.string().email('Invalid email'),
  preferred_lang: z.enum(['rw', 'en', 'fr']),
});

const reg2Schema = z.object({
  gender: z.enum(['male', 'female', 'prefer_not_to_say']).optional(),
  date_of_birth: z
    .string()
    .optional()
    .refine((v) => {
      if (!v) return true;
      const age = (Date.now() - new Date(v).getTime()) / (365.25 * 24 * 3600 * 1000);
      return age >= 18;
    }, 'Must be at least 18 years old'),
  national_id: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{16}$/.test(v), 'NID must be exactly 16 digits'),
  district: z.string().optional(),
});

const reg3Schema = z.object({
  agreed_to_terms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the terms and conditions' }),
  }),
});

type LoginData = z.infer<typeof loginSchema>;
type OTPData = z.infer<typeof otpSchema>;
type Reg1Data = z.infer<typeof reg1Schema>;
type Reg2Data = z.infer<typeof reg2Schema>;
type Reg3Data = z.infer<typeof reg3Schema>;

type RegistrationData = z.infer<typeof reg1Schema> & z.infer<typeof reg2Schema>;

const DISTRICTS = [
  'Gasabo',
  'Kicukiro',
  'Nyarugenge',
  'Bugesera',
  'Gatsibo',
  'Kayonza',
  'Kirehe',
  'Ngoma',
  'Nyagatare',
  'Rwamagana',
  'Burera',
  'Gakenke',
  'Gicumbi',
  'Musanze',
  'Rulindo',
  'Gisagara',
  'Huye',
  'Kamonyi',
  'Muhanga',
  'Nyamagabe',
  'Nyanza',
  'Nyaruguru',
  'Ruhango',
  'Karongi',
  'Ngororero',
  'Nyabihu',
  'Rubavu',
  'Rusizi',
  'Rutsiro',
].sort();

/** Inline shadow — toggling NativeWind `shadow-sm` in className breaks navigation context. */
const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.08,
  shadowRadius: 3,
  elevation: 2,
} as const;

// ── Helpers ─────────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <Text className="text-destructive text-xs mt-1">⚠ {message}</Text>;
}

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <View className="flex-row items-center gap-2 justify-center mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          className={`rounded-full ${
            i === current
              ? 'w-6 h-2 bg-primary'
              : i < current
                ? 'w-2 h-2 bg-muted-foreground'
                : 'w-2 h-2 bg-muted'
          }`}
        />
      ))}
    </View>
  );
}

function SectionLabel({
  emoji,
  title,
  subtitle,
}: {
  emoji: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View className="mb-4">
      <Text className="text-xl font-bold">
        {emoji} {title}
      </Text>
      {subtitle && <Text className="text-muted-foreground text-sm mt-1">{subtitle}</Text>}
    </View>
  );
}

function InfoBox({
  message,
  variant = 'info',
}: {
  message: string;
  variant?: 'info' | 'warn' | 'success';
}) {
  const styles = {
    info: 'bg-blue-50 border-blue-200',
    warn: 'bg-amber-50 border-amber-200',
    success: 'bg-green-50 border-green-200',
  };
  const icons = { info: 'ℹ️', warn: '⚠️', success: '✅' };
  return (
    <View className={`rounded-xl border p-3 mb-3 ${styles[variant]}`}>
      <Text className="text-xs text-foreground/80">
        {icons[variant]} {message}
      </Text>
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────

export default function AuthScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(
    mode === 'register' ? 'register' : 'login',
  );
  const [loginStep, setLoginStep] = useState<'request' | 'verify'>('request');
  const [regStep, setRegStep] = useState<0 | 1 | 2>(0);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [regData, setRegData] = useState<RegistrationData>({
    role: 'client',
    fullName: '',
    phone: '',
    email: '',
    preferred_lang: 'rw',
    gender: undefined,
    date_of_birth: undefined,
    national_id: undefined,
    district: undefined,
  });
  const [showDistrictPicker, setShowDistrictPicker] = useState(false);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const loginForm = useForm<LoginData>({ resolver: zodResolver(loginSchema) });
  const otpForm = useForm<OTPData>({ resolver: zodResolver(otpSchema) });
  const reg1Form = useForm<Reg1Data>({
    resolver: zodResolver(reg1Schema),
    defaultValues: { role: 'client', preferred_lang: 'rw' },
  });
  const reg2Form = useForm<Reg2Data>({ resolver: zodResolver(reg2Schema) });
  const reg3Form = useForm<Reg3Data>({ resolver: zodResolver(reg3Schema) });

  // ── Cooldown ──────────────────────────────────────────────────────────

  const startCooldown = (seconds: number) => {
    setOtpCooldown(seconds);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setOtpCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // ── Login handlers ────────────────────────────────────────────────────

  const onSendOTP = async (data: LoginData) => {
    setLoading(true);
    try {
      await api.post('/auth/otp/request', { email: data.email, lang: 'en' });
      setEmail(data.email);
      setLoginStep('verify');
      startCooldown(60);
      Toast.show({
        type: 'success',
        text1: 'Code sent!',
        text2: `Check your inbox at ${data.email}`,
      });
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : detail?.message;
      Toast.show({ type: 'error', text1: 'Error', text2: msg ?? 'Failed to send code' });
    } finally {
      setLoading(false);
    }
  };

  const onVerifyOTP = async (data: OTPData) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/otp/verify', { email, otp_code: data.otp });
      const { user, access_token, refresh_token } = res.data;
      setAuth(
        {
          id: user.id,
          fullName: user.full_name,
          phone: user.phone_number,
          email: user.email,
          role: user.role,
          avatarUrl: user.avatar_url ?? undefined,
          district: user.district ?? null,
          preferredLang: user.preferred_lang ?? 'rw',
          accountStatus: user.account_status,
        },
        access_token,
        refresh_token,
      );
      Toast.show({ type: 'success', text1: `Welcome, ${user.full_name.split(' ')[0]}!` });
      router.replace('/(tabs)');
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : detail?.message;
      Toast.show({ type: 'error', text1: 'Error', text2: msg ?? 'Invalid code' });
    } finally {
      setLoading(false);
    }
  };

  const onResendOTP = async () => {
    if (otpCooldown > 0) return;
    setLoading(true);
    try {
      await api.post('/auth/otp/request', { email, lang: 'en' });
      startCooldown(60);
      Toast.show({ type: 'success', text1: 'New code sent!' });
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to resend. Try again.' });
    } finally {
      setLoading(false);
    }
  };

  // ── Registration handlers ─────────────────────────────────────────────

  const onReg1 = (data: Reg1Data) => {
    setRegData((prev) => {
      // Merge data, but ignore undefined fields to avoid overwriting with undefined
      const filteredData = Object.entries(data).reduce(
        (acc, [key, val]) => {
          return val !== undefined ? { ...acc, [key]: val } : acc;
        },
        {} as Record<string, unknown>,
      );
      return { ...prev, ...filteredData };
    });
    setRegStep(1);
  };

  const onReg2 = (data: Reg2Data) => {
    setRegData((prev) => {
      // Merge data, but ignore undefined fields to avoid overwriting with undefined
      const filteredData = Object.entries(data).reduce(
        (acc, [key, val]) => {
          return val !== undefined ? { ...acc, [key]: val } : acc;
        },
        {} as Record<string, unknown>,
      );
      return { ...prev, ...filteredData };
    });
    setRegStep(2);
  };

  const onReg3 = async (data: Reg3Data) => {
    const merged = { ...regData, ...data };
    setLoading(true);
    try {
      const payload = {
        full_name: merged.fullName,
        phone_number: merged.phone,
        email: merged.email,
        role: merged.role,
        preferred_lang: merged.preferred_lang ?? 'rw',
        gender: merged.gender ?? null,
        date_of_birth: merged.date_of_birth || null,
        national_id: merged.national_id || null,
        district: merged.district || null,
        agreed_to_terms: true,
        terms_version: 'v1.0',
      };
      await api.post('/auth/register', payload);
      Toast.show({
        type: 'success',
        text1: 'Account created!',
        text2: 'A verification code was sent to your email',
      });
      // Transition to login OTP verify
      setEmail(merged.email);
      loginForm.setValue('email', merged.email);
      setActiveTab('login');
      setLoginStep('verify');
      startCooldown(60);
      setRegStep(0);
      setRegData({
        role: 'client',
        fullName: '',
        phone: '',
        email: '',
        preferred_lang: 'rw',
        gender: undefined,
        date_of_birth: undefined,
        national_id: undefined,
        district: undefined,
      });
    } catch (err: any) {
      const detail = err.response?.data?.detail;

      if (Array.isArray(detail)) {
        Toast.show({
          type: 'error',
          text1: 'Registration failed',
          text2: detail[0]?.msg ?? 'Please check your details',
        });
        return;
      }

      const msg = typeof detail === 'string' ? detail : detail?.message;
      const field = typeof detail === 'object' ? detail?.field : null;

      if (field === 'email') {
        setRegStep(0);
        reg1Form.setError('email', { message: msg });
      } else if (field === 'phone_number') {
        setRegStep(0);
        reg1Form.setError('phone', { message: msg });
      }
      Toast.show({
        type: 'error',
        text1: 'Registration failed',
        text2: msg ?? 'Please check your details',
      });
    } finally {
      setLoading(false);
    }
  };

  const role = reg1Form.watch('role');

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        className="p-5"
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="mt-12 mb-8 items-center">
          <Text className="text-4xl font-black text-primary">HandyRwanda</Text>
          <Text className="text-muted-foreground text-center mt-2 text-sm">
            Connecting you with trusted artisans across Rwanda
          </Text>
        </View>

        {/* Tab Switcher */}
        <View className="flex-row bg-muted rounded-2xl p-1 mb-6">
          {(['login', 'register'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              accessibilityLabel={tab === 'login' ? 'Sign In tab' : 'Register tab'}
              onPress={() => {
                setActiveTab(tab);
                if (tab === 'register') setRegStep(0);
              }}
              className={`flex-1 py-2.5 rounded-xl ${activeTab === tab ? 'bg-card' : ''}`}
              style={activeTab === tab ? cardShadow : undefined}
            >
              <Text
                className={`text-center font-bold text-sm ${
                  activeTab === tab ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {tab === 'login' ? 'Sign In' : 'Register'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── LOGIN ──────────────────────────────────────────────────── */}
        {activeTab === 'login' && (
          <View className="bg-card p-6 rounded-3xl border border-border" style={cardShadow}>
            {loginStep === 'request' ? (
              <View>
                <SectionLabel
                  emoji="👋"
                  title="Welcome back"
                  subtitle="Enter your email to receive a login code"
                />
                <InfoBox message="No password needed — we send a secure one-time code to your email." />

                <Controller
                  control={loginForm.control}
                  name="email"
                  render={({ field: { onChange, value }, fieldState: { error } }) => (
                    <View className="mb-4">
                      <Text className="text-sm font-semibold mb-2">Email Address</Text>
                      <TextInput
                        className={`bg-muted/50 p-4 rounded-xl border ${error ? 'border-destructive' : 'border-border'}`}
                        placeholder="email@example.com"
                        value={value}
                        onChangeText={onChange}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        autoComplete="email"
                      />
                      <FieldError message={error?.message} />
                    </View>
                  )}
                />

                <TouchableOpacity
                  accessibilityLabel="Send verification code"
                  onPress={loginForm.handleSubmit(onSendOTP)}
                  disabled={loading}
                  className="bg-primary p-4 rounded-xl items-center"
                >
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white font-bold">Send Verification Code</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <SectionLabel emoji="🔒" title="Enter your code" subtitle={`Sent to ${email}`} />
                <InfoBox
                  message="Code expires in 5 minutes. Check your spam folder if you don't see it."
                  variant="info"
                />

                <Controller
                  control={otpForm.control}
                  name="otp"
                  render={({ field: { onChange, value }, fieldState: { error } }) => (
                    <View className="mb-4">
                      <TextInput
                        className={`bg-muted/50 p-4 rounded-xl border text-center text-3xl tracking-[0.5em] font-bold ${
                          error ? 'border-destructive' : 'border-primary'
                        }`}
                        placeholder="------"
                        value={value}
                        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, 6))}
                        keyboardType="number-pad"
                        maxLength={6}
                        autoFocus
                      />
                      <FieldError message={error?.message} />
                    </View>
                  )}
                />

                <TouchableOpacity
                  accessibilityLabel="Verify code and sign in"
                  onPress={otpForm.handleSubmit(onVerifyOTP)}
                  disabled={loading}
                  className="bg-primary p-4 rounded-xl items-center mb-3"
                >
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white font-bold">Verify & Sign In</Text>
                  )}
                </TouchableOpacity>

                <View className="flex-row justify-between items-center">
                  <TouchableOpacity
                    accessibilityLabel="Change email"
                    onPress={() => setLoginStep('request')}
                  >
                    <Text className="text-muted-foreground text-sm">← Change email</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityLabel="Resend code"
                    onPress={onResendOTP}
                    disabled={otpCooldown > 0 || loading}
                  >
                    <Text
                      className={`text-sm font-medium ${otpCooldown > 0 ? 'text-muted-foreground' : 'text-primary'}`}
                    >
                      {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : 'Resend code'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── REGISTER ──────────────────────────────────────────────── */}
        {activeTab === 'register' && (
          <View className="bg-card p-6 rounded-3xl border border-border" style={cardShadow}>
            <StepDots current={regStep} total={3} />

            {/* Step 0 — Core Identity */}
            {regStep === 0 && (
              <View>
                <SectionLabel emoji="👤" title="Your Identity" subtitle="Tell us who you are" />

                {/* Role */}
                <Controller
                  control={reg1Form.control}
                  name="role"
                  render={({ field: { onChange, value } }) => (
                    <View className="mb-5">
                      <Text className="text-sm font-semibold mb-2">I want to…</Text>
                      <View className="flex-row gap-3">
                        {(['client', 'artisan'] as const).map((r) => (
                          <TouchableOpacity
                            key={r}
                            accessibilityLabel={r === 'client' ? 'I need help' : 'I offer services'}
                            onPress={() => onChange(r)}
                            className={`flex-1 p-4 rounded-2xl border-2 items-center ${
                              value === r
                                ? 'bg-primary/10 border-primary'
                                : 'bg-muted/50 border-border'
                            }`}
                          >
                            <Text className="text-2xl mb-1">{r === 'client' ? '🔍' : '🔨'}</Text>
                            <Text
                              className={`font-bold text-sm ${value === r ? 'text-primary' : 'text-foreground'}`}
                            >
                              {r === 'client' ? 'Find Help' : 'Offer Services'}
                            </Text>
                            <Text className="text-xs text-muted-foreground mt-0.5">
                              {r === 'client' ? 'I need an artisan' : "I'm an artisan"}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                />

                {/* Full Name */}
                <Controller
                  control={reg1Form.control}
                  name="fullName"
                  render={({ field: { onChange, value }, fieldState: { error } }) => (
                    <View className="mb-4">
                      <Text className="text-sm font-semibold mb-1">
                        Full Name <Text className="text-destructive">*</Text>
                      </Text>
                      <TextInput
                        className={`bg-muted/50 p-4 rounded-xl border ${error ? 'border-destructive' : 'border-border'}`}
                        placeholder="Amina Uwimana"
                        value={value}
                        onChangeText={onChange}
                        autoCapitalize="words"
                      />
                      <Text className="text-xs text-muted-foreground mt-1">
                        As it appears on your ID — first and last name
                      </Text>
                      <FieldError message={error?.message} />
                    </View>
                  )}
                />

                {/* Phone */}
                <Controller
                  control={reg1Form.control}
                  name="phone"
                  render={({ field: { onChange, value }, fieldState: { error } }) => (
                    <View className="mb-4">
                      <Text className="text-sm font-semibold mb-1">
                        Phone Number <Text className="text-destructive">*</Text>
                      </Text>
                      <TextInput
                        className={`bg-muted/50 p-4 rounded-xl border ${error ? 'border-destructive' : 'border-border'}`}
                        placeholder="+250780000000"
                        value={value}
                        onChangeText={onChange}
                        keyboardType="phone-pad"
                      />
                      <Text className="text-xs text-muted-foreground mt-1">
                        Rwanda number starting with +2507
                      </Text>
                      <FieldError message={error?.message} />
                    </View>
                  )}
                />

                {/* Email */}
                <Controller
                  control={reg1Form.control}
                  name="email"
                  render={({ field: { onChange, value }, fieldState: { error } }) => (
                    <View className="mb-4">
                      <Text className="text-sm font-semibold mb-1">
                        Email Address <Text className="text-destructive">*</Text>
                      </Text>
                      <TextInput
                        className={`bg-muted/50 p-4 rounded-xl border ${error ? 'border-destructive' : 'border-border'}`}
                        placeholder="amina@example.com"
                        value={value}
                        onChangeText={onChange}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        autoComplete="email"
                      />
                      <Text className="text-xs text-muted-foreground mt-1">
                        Used for verification codes — no spam
                      </Text>
                      <FieldError message={error?.message} />
                    </View>
                  )}
                />

                {/* Language */}
                <Controller
                  control={reg1Form.control}
                  name="preferred_lang"
                  render={({ field: { onChange, value } }) => (
                    <View className="mb-5">
                      <Text className="text-sm font-semibold mb-2">Preferred Language</Text>
                      <View className="flex-row gap-2">
                        {(
                          [
                            ['rw', '🇷🇼 Kinyarwanda'],
                            ['en', '🇬🇧 English'],
                            ['fr', '🇫🇷 Français'],
                          ] as const
                        ).map(([code, label]) => (
                          <TouchableOpacity
                            key={code}
                            accessibilityLabel={label}
                            onPress={() => onChange(code)}
                            className={`flex-1 py-2.5 px-2 rounded-xl border items-center ${
                              value === code
                                ? 'bg-primary/10 border-primary'
                                : 'bg-muted/50 border-border'
                            }`}
                          >
                            <Text className="text-xs font-semibold">{label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                />

                <TouchableOpacity
                  accessibilityLabel="Continue to next step"
                  onPress={reg1Form.handleSubmit(onReg1)}
                  className="bg-primary p-4 rounded-xl items-center"
                >
                  <Text className="text-white font-bold">Continue →</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Step 1 — Location & Identity */}
            {regStep === 1 && (
              <View>
                <SectionLabel
                  emoji="📍"
                  title="Location & Identity"
                  subtitle="Optional but helps us serve you better"
                />

                <InfoBox
                  message="Providing your district and NID helps verify trusted artisans and improves matching."
                  variant="info"
                />

                {role === 'artisan' && (
                  <InfoBox
                    message="Artisans: your NID and district are required before accepting paid bookings."
                    variant="warn"
                  />
                )}

                {/* Gender */}
                <Controller
                  control={reg2Form.control}
                  name="gender"
                  render={({ field: { onChange, value } }) => (
                    <View className="mb-4">
                      <Text className="text-sm font-semibold mb-2">Gender</Text>
                      <View className="flex-row gap-2">
                        {(
                          [
                            ['male', '♂ Male'],
                            ['female', '♀ Female'],
                            ['prefer_not_to_say', '— Prefer not'],
                          ] as const
                        ).map(([v, label]) => (
                          <TouchableOpacity
                            key={v}
                            accessibilityLabel={label}
                            onPress={() => onChange(v)}
                            className={`flex-1 py-2.5 px-1 rounded-xl border items-center ${
                              value === v
                                ? 'bg-primary/10 border-primary'
                                : 'bg-muted/50 border-border'
                            }`}
                          >
                            <Text
                              className={`text-xs font-semibold ${value === v ? 'text-primary' : 'text-foreground'}`}
                            >
                              {label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                />

                {/* Date of Birth */}
                <Controller
                  control={reg2Form.control}
                  name="date_of_birth"
                  render={({ field: { onChange, value }, fieldState: { error } }) => (
                    <View className="mb-4">
                      <Text className="text-sm font-semibold mb-1">Date of Birth</Text>
                      <TextInput
                        className={`bg-muted/50 p-4 rounded-xl border ${error ? 'border-destructive' : 'border-border'}`}
                        placeholder="YYYY-MM-DD (e.g. 1992-05-14)"
                        value={value}
                        onChangeText={onChange}
                        keyboardType="numeric"
                        maxLength={10}
                      />
                      <Text className="text-xs text-muted-foreground mt-1">
                        You must be 18 or older
                      </Text>
                      <FieldError message={error?.message} />
                    </View>
                  )}
                />

                {/* National ID */}
                <Controller
                  control={reg2Form.control}
                  name="national_id"
                  render={({ field: { onChange, value }, fieldState: { error } }) => (
                    <View className="mb-4">
                      <Text className="text-sm font-semibold mb-1">National ID (Indangamuntu)</Text>
                      <TextInput
                        className={`bg-muted/50 p-4 rounded-xl border tracking-widest ${error ? 'border-destructive' : 'border-border'}`}
                        placeholder="16 digits  e.g. 1200080000000000"
                        value={value}
                        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, 16))}
                        keyboardType="numeric"
                        maxLength={16}
                      />
                      <Text
                        className={`text-xs mt-1 ${value && value.length === 16 ? 'text-green-600' : 'text-muted-foreground'}`}
                      >
                        {value
                          ? `${value.length}/16 digits${value.length === 16 ? ' ✓' : ''}`
                          : '16-digit Rwanda National ID'}
                      </Text>
                      <FieldError message={error?.message} />
                    </View>
                  )}
                />

                {/* District picker */}
                <Controller
                  control={reg2Form.control}
                  name="district"
                  render={({ field: { onChange, value } }) => (
                    <View className="mb-5">
                      <Text className="text-sm font-semibold mb-1">District</Text>
                      <TouchableOpacity
                        accessibilityLabel="Select district"
                        onPress={() => setShowDistrictPicker(true)}
                        className="bg-muted/50 p-4 rounded-xl border border-border flex-row justify-between items-center"
                      >
                        <Text className={value ? 'text-foreground' : 'text-muted-foreground'}>
                          {value || 'Select your district'}
                        </Text>
                        <Text className="text-muted-foreground">▼</Text>
                      </TouchableOpacity>
                      {showDistrictPicker && (
                        <View className="bg-card border border-border rounded-xl mt-2 max-h-48 overflow-hidden">
                          <ScrollView nestedScrollEnabled>
                            {DISTRICTS.map((d) => (
                              <TouchableOpacity
                                key={d}
                                accessibilityLabel={d}
                                onPress={() => {
                                  onChange(d);
                                  setShowDistrictPicker(false);
                                }}
                                className={`p-3 border-b border-border/50 ${value === d ? 'bg-primary/10' : ''}`}
                              >
                                <Text
                                  className={
                                    value === d ? 'text-primary font-semibold' : 'text-foreground'
                                  }
                                >
                                  {d}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  )}
                />

                <View className="flex-row gap-3">
                  <TouchableOpacity
                    accessibilityLabel="Go back to previous step"
                    onPress={() => setRegStep(0)}
                    className="flex-1 bg-muted p-4 rounded-xl items-center"
                  >
                    <Text className="font-bold text-foreground">← Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityLabel="Continue to review step"
                    onPress={reg2Form.handleSubmit(onReg2)}
                    className="flex-2 flex-grow bg-primary p-4 rounded-xl items-center"
                  >
                    <Text className="text-white font-bold">Continue →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Step 2 — Review & Terms */}
            {regStep === 2 && (
              <View>
                <SectionLabel
                  emoji="✅"
                  title="Review & Confirm"
                  subtitle="Check your details before creating account"
                />

                {/* Summary */}
                <View className="bg-muted/50 rounded-2xl p-4 mb-4 gap-2">
                  {[
                    ['Name', regData.fullName],
                    ['Email', regData.email],
                    ['Phone', regData.phone],
                    ['Role', regData.role.toUpperCase()],
                    ...(regData.district ? [['District', regData.district]] : []),
                    ...(regData.national_id
                      ? [
                          [
                            'NID',
                            `${regData.national_id.slice(0, 4)}…${regData.national_id.slice(-4)}`,
                          ],
                        ]
                      : []),
                  ].map(([label, val]) => (
                    <View key={label} className="flex-row justify-between">
                      <Text className="text-muted-foreground text-sm">{label}</Text>
                      <Text className="text-foreground font-semibold text-sm">{val}</Text>
                    </View>
                  ))}
                </View>

                {/* Terms */}
                <Controller
                  control={reg3Form.control}
                  name="agreed_to_terms"
                  render={({ field: { onChange, value }, fieldState: { error } }) => (
                    <TouchableOpacity
                      accessibilityLabel="Agree to terms and conditions"
                      onPress={() => onChange(value === true ? undefined : true)}
                      className={`flex-row items-start gap-3 p-4 rounded-xl border mb-4 ${
                        error
                          ? 'border-destructive bg-destructive/5'
                          : value
                            ? 'border-primary bg-primary/5'
                            : 'border-border bg-muted/30'
                      }`}
                    >
                      <View
                        className={`w-5 h-5 rounded border-2 mt-0.5 items-center justify-center ${value ? 'bg-primary border-primary' : 'border-muted-foreground'}`}
                      >
                        {value && <Text className="text-white text-xs font-bold">✓</Text>}
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-semibold">
                          I agree to Terms & Privacy Policy
                        </Text>
                        <Text className="text-xs text-muted-foreground mt-1">
                          By registering, you confirm you're at least 18 and agree to HandyRwanda's
                          Terms of Service and Privacy Policy.
                        </Text>
                        <FieldError message={error?.message} />
                      </View>
                    </TouchableOpacity>
                  )}
                />

                <InfoBox
                  message="After creating your account, a verification code will be sent to your email to activate it."
                  variant="success"
                />

                <View className="flex-row gap-3">
                  <TouchableOpacity
                    accessibilityLabel="Go back to identity step"
                    onPress={() => setRegStep(1)}
                    disabled={loading}
                    className="flex-1 bg-muted p-4 rounded-xl items-center"
                  >
                    <Text className="font-bold text-foreground">← Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityLabel="Create account"
                    onPress={reg3Form.handleSubmit(onReg3)}
                    disabled={loading}
                    className="flex-grow flex-2 bg-primary p-4 rounded-xl items-center"
                  >
                    {loading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text className="text-white font-bold">Create Account ✓</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        <View className="h-10" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
