// File: mobile/app/auth.tsx
// Updated: full cascading Rwanda address (Province→District→Sector→Cell→Village)
// + house_number, landmark, street_road fields in registration step 2

import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState, useRef, useMemo } from 'react';
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
  Modal,
  FlatList,
} from 'react-native';
import Toast from 'react-native-toast-message';
import * as z from 'zod';

import api from '../src/services/api';
import { useAuthStore } from '../src/store/authStore';
import RWANDA_ADDRESSES from '../src/data/rwanda-addresses';

// ── Rwanda address helpers ─────────────────────────────────────────────────

const getProvinces = (): string[] => Object.keys(RWANDA_ADDRESSES).sort();
const getDistricts = (province: string): string[] =>
  Object.keys((RWANDA_ADDRESSES as any)[province] ?? {}).sort();
const getSectors = (province: string, district: string): string[] =>
  Object.keys((RWANDA_ADDRESSES as any)[province]?.[district] ?? {}).sort();
const getCells = (province: string, district: string, sector: string): string[] =>
  Object.keys((RWANDA_ADDRESSES as any)[province]?.[district]?.[sector] ?? {}).sort();
const getVillages = (province: string, district: string, sector: string, cell: string): string[] =>
  [...((RWANDA_ADDRESSES as any)[province]?.[district]?.[sector]?.[cell] ?? [])].sort();

// ── Schemas ────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
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
  province: z.string().optional(),
  district: z.string().optional(),
  sector: z.string().optional(),
  cell: z.string().optional(),
  village: z.string().optional(),
  street_road: z.string().max(200).optional(),
  house_number: z.string().max(50).optional(),
  landmark: z.string().max(200).optional(),
});

const reg3Schema = z.object({
  agreed_to_terms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the terms and conditions' }),
  }),
});

type LoginData = z.infer<typeof loginSchema>;
type Reg1Data = z.infer<typeof reg1Schema>;
type Reg2Data = z.infer<typeof reg2Schema>;
type Reg3Data = z.infer<typeof reg3Schema>;
type RegistrationData = Reg1Data & Reg2Data;

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
  const labels = ['Identity', 'Location', 'Confirm'];
  return (
    <View className="flex-row items-center justify-center mb-6 gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <React.Fragment key={i}>
          <View className="items-center gap-1">
            <View
              className={`rounded-full items-center justify-center ${
                i === current
                  ? 'w-7 h-7 bg-primary'
                  : i < current
                    ? 'w-5 h-5 bg-primary/60'
                    : 'w-5 h-5 bg-muted'
              }`}
            >
              {i < current ? (
                <Text className="text-white text-xs font-bold">✓</Text>
              ) : (
                <Text
                  className={`text-xs font-bold ${i === current ? 'text-white' : 'text-muted-foreground'}`}
                >
                  {i + 1}
                </Text>
              )}
            </View>
            <Text
              className={`text-[9px] ${i === current ? 'text-primary font-bold' : 'text-muted-foreground'}`}
            >
              {labels[i]}
            </Text>
          </View>
          {i < total - 1 && (
            <View className={`h-0.5 flex-1 mb-3 ${i < current ? 'bg-primary/60' : 'bg-muted'}`} />
          )}
        </React.Fragment>
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

// ── Inline dropdown picker ──────────────────────────────────────────────────

function DropdownPicker({
  label,
  value,
  options,
  onSelect,
  placeholder,
  disabled,
}: {
  label: string;
  value?: string;
  options: string[];
  onSelect: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View className="flex-1">
      <Text className="text-xs font-semibold mb-1 text-foreground/80">{label}</Text>
      <TouchableOpacity
        onPress={() => !disabled && setOpen(true)}
        className={`p-3 rounded-xl border flex-row justify-between items-center ${
          disabled ? 'bg-muted/30 border-border/40' : 'bg-muted/50 border-border'
        }`}
        accessibilityLabel={`Select ${label}`}
      >
        <Text
          className={`text-xs ${value ? 'text-foreground' : 'text-muted-foreground'} ${disabled ? 'opacity-40' : ''}`}
          numberOfLines={1}
        >
          {value || placeholder || `Select ${label.toLowerCase()}`}
        </Text>
        <Text className={`text-muted-foreground text-xs ${disabled ? 'opacity-40' : ''}`}>▼</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity
          className="flex-1 bg-black/40"
          activeOpacity={1}
          onPress={() => setOpen(false)}
        />
        <View
          className="bg-card rounded-t-3xl max-h-72 border-t border-border"
          style={{ ...cardShadow, position: 'absolute', bottom: 0, left: 0, right: 0 }}
        >
          <View className="p-4 border-b border-border flex-row justify-between items-center">
            <Text className="font-bold text-base">Select {label}</Text>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Text className="text-primary font-semibold">Done</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  onSelect(item);
                  setOpen(false);
                }}
                className={`p-4 border-b border-border/30 ${value === item ? 'bg-primary/10' : ''}`}
                accessibilityLabel={item}
              >
                <Text
                  className={`${value === item ? 'text-primary font-semibold' : 'text-foreground'} text-sm`}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

// ── AddressSection ──────────────────────────────────────────────────────────

function AddressSection({ form }: { form: ReturnType<typeof useForm<Reg2Data>> }) {
  const province = form.watch('province') ?? '';
  const district = form.watch('district') ?? '';
  const sector = form.watch('sector') ?? '';
  const cell = form.watch('cell') ?? '';

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
    <View>
      <Text className="text-sm font-bold mb-3 text-foreground">📍 Administrative Address</Text>

      {/* Province + District */}
      <View className="flex-row gap-2 mb-3">
        <Controller
          control={form.control}
          name="province"
          render={({ field: { onChange, value } }) => (
            <DropdownPicker
              label="Province"
              value={value}
              options={provinces}
              onSelect={(v) => {
                onChange(v);
                form.setValue('district', '');
                form.setValue('sector', '');
                form.setValue('cell', '');
                form.setValue('village', '');
              }}
            />
          )}
        />
        <Controller
          control={form.control}
          name="district"
          render={({ field: { onChange, value } }) => (
            <DropdownPicker
              label="District"
              value={value}
              options={districts}
              disabled={!province}
              placeholder={province ? 'Select district' : 'Province first'}
              onSelect={(v) => {
                onChange(v);
                form.setValue('sector', '');
                form.setValue('cell', '');
                form.setValue('village', '');
              }}
            />
          )}
        />
      </View>

      {/* Sector + Cell */}
      <View className="flex-row gap-2 mb-3">
        <Controller
          control={form.control}
          name="sector"
          render={({ field: { onChange, value } }) => (
            <DropdownPicker
              label="Sector"
              value={value}
              options={sectors}
              disabled={!district}
              placeholder={district ? 'Select sector' : 'District first'}
              onSelect={(v) => {
                onChange(v);
                form.setValue('cell', '');
                form.setValue('village', '');
              }}
            />
          )}
        />
        <Controller
          control={form.control}
          name="cell"
          render={({ field: { onChange, value } }) => (
            <DropdownPicker
              label="Cell"
              value={value}
              options={cells}
              disabled={!sector}
              placeholder={sector ? 'Select cell' : 'Sector first'}
              onSelect={(v) => {
                onChange(v);
                form.setValue('village', '');
              }}
            />
          )}
        />
      </View>

      {/* Village */}
      <View className="mb-3">
        <Controller
          control={form.control}
          name="village"
          render={({ field: { onChange, value } }) => (
            <DropdownPicker
              label="Village"
              value={value}
              options={villages}
              disabled={!cell}
              placeholder={cell ? 'Select village' : 'Cell first'}
              onSelect={onChange}
            />
          )}
        />
      </View>

      <View className="h-px bg-border/50 my-2" />
      <Text className="text-xs font-semibold text-muted-foreground mb-2">
        🏠 Street Details (optional)
      </Text>

      {/* Street + House */}
      <View className="flex-row gap-2 mb-3">
        <View className="flex-1">
          <Text className="text-xs font-semibold mb-1">Street / Road</Text>
          <Controller
            control={form.control}
            name="street_road"
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <>
                <TextInput
                  className={`bg-muted/50 p-3 rounded-xl border text-xs ${error ? 'border-destructive' : 'border-border'}`}
                  placeholder="e.g. KG 15 Ave"
                  value={value}
                  onChangeText={onChange}
                />
                <FieldError message={error?.message} />
              </>
            )}
          />
        </View>
        <View className="flex-1">
          <Text className="text-xs font-semibold mb-1">House / Plot No.</Text>
          <Controller
            control={form.control}
            name="house_number"
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <>
                <TextInput
                  className={`bg-muted/50 p-3 rounded-xl border text-xs ${error ? 'border-destructive' : 'border-border'}`}
                  placeholder="e.g. 42B"
                  value={value}
                  onChangeText={onChange}
                />
                <FieldError message={error?.message} />
              </>
            )}
          />
        </View>
      </View>

      {/* Landmark */}
      <View className="mb-1">
        <Text className="text-xs font-semibold mb-1">Landmark</Text>
        <Controller
          control={form.control}
          name="landmark"
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <>
              <TextInput
                className={`bg-muted/50 p-3 rounded-xl border text-xs ${error ? 'border-destructive' : 'border-border'}`}
                placeholder="e.g. Near Kigali Convention Centre"
                value={value}
                onChangeText={onChange}
              />
              <Text className="text-[10px] text-muted-foreground mt-1">
                Helps artisans find you easily
              </Text>
              <FieldError message={error?.message} />
            </>
          )}
        />
      </View>
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
  const [otpValue, setOtpValue] = useState('');
  const [otpError, setOtpError] = useState('');

  const [regData, setRegData] = useState<RegistrationData>({
    role: 'client',
    fullName: '',
    phone: '',
    email: '',
    preferred_lang: 'rw',
  });

  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const loginForm = useForm<LoginData>({ resolver: zodResolver(loginSchema) });
  const reg1Form = useForm<Reg1Data>({
    resolver: zodResolver(reg1Schema),
    defaultValues: { role: 'client', preferred_lang: 'rw' },
  });
  const reg2Form = useForm<Reg2Data>({ resolver: zodResolver(reg2Schema) });
  const reg3Form = useForm<Reg3Data>({ resolver: zodResolver(reg3Schema) });

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

  const onSendOTP = async (data: LoginData) => {
    setLoading(true);
    try {
      await api.post('/auth/otp/request', { email: data.email, lang: 'en' });
      setEmail(data.email);
      setOtpValue('');
      setOtpError('');
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

  const onVerifyOTP = async () => {
    if (!otpValue) {
      setOtpError('Please enter the verification code');
      return;
    }
    if (otpValue.length !== 6 || !/^\d{6}$/.test(otpValue)) {
      setOtpError('OTP must be exactly 6 digits');
      return;
    }
    setOtpError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/otp/verify', { email, otp_code: otpValue });
      const { user, access_token, refresh_token } = res.data;
      setAuth(
        {
          id: user.id,
          fullName: user.full_name,
          phone: user.phone_number,
          email: user.email,
          role: user.role,
          avatarUrl: user.avatar_url ?? undefined,
          province: user.province ?? null,
          district: user.district ?? null,
          sector: user.sector ?? null,
          cell: user.cell ?? null,
          village: user.village ?? null,
          streetRoad: user.street_road ?? null,
          houseNumber: user.house_number ?? null,
          landmark: user.landmark ?? null,
          addressDetail: user.address_detail ?? null,
          preferredLang: user.preferred_lang ?? 'rw',
          accountStatus: user.account_status,
          emailVerified: user.email_verified ?? true,
        },
        access_token,
        refresh_token,
      );
      Toast.show({ type: 'success', text1: `Welcome, ${user.full_name.split(' ')[0]}!` });
      router.replace('/(tabs)');
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : detail?.message;
      setOtpError(msg ?? 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onResendOTP = async () => {
    if (otpCooldown > 0) return;
    setLoading(true);
    try {
      await api.post('/auth/otp/request', { email, lang: 'en' });
      setOtpValue('');
      setOtpError('');
      startCooldown(60);
      Toast.show({ type: 'success', text1: 'New code sent!' });
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to resend. Try again.' });
    } finally {
      setLoading(false);
    }
  };

  const onReg1 = (data: Reg1Data) => {
    setRegData((prev) => ({ ...prev, ...data }));
    setRegStep(1);
  };

  const onReg2 = (data: Reg2Data) => {
    setRegData((prev) => ({ ...prev, ...data }));
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
        province: merged.province || null,
        district: merged.district || null,
        sector: merged.sector || null,
        cell: merged.cell || null,
        village: merged.village || null,
        street_road: merged.street_road || null,
        house_number: merged.house_number || null,
        landmark: merged.landmark || null,
        agreed_to_terms: true,
        terms_version: 'v1.0',
      };
      await api.post('/auth/register', payload);
      Toast.show({
        type: 'success',
        text1: 'Account created!',
        text2: 'A verification code was sent to your email',
      });
      setEmail(merged.email);
      loginForm.setValue('email', merged.email);
      setOtpValue('');
      setOtpError('');
      setActiveTab('login');
      setLoginStep('verify');
      startCooldown(60);
      setRegStep(0);
      setRegData({ role: 'client', fullName: '', phone: '', email: '', preferred_lang: 'rw' });
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
                className={`text-center font-bold text-sm ${activeTab === tab ? 'text-primary' : 'text-muted-foreground'}`}
              >
                {tab === 'login' ? 'Sign In' : 'Register'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── LOGIN ─────────────────────────────────────────────────────── */}
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
                  message="Code expires in 5 minutes. Check your spam folder if needed."
                  variant="info"
                />
                <View className="mb-4">
                  <TextInput
                    className={`bg-muted/50 p-4 rounded-xl border text-center text-3xl tracking-[0.5em] font-bold ${otpError ? 'border-destructive' : 'border-primary'}`}
                    placeholder="------"
                    value={otpValue}
                    onChangeText={(t) => {
                      const c = t.replace(/\D/g, '').slice(0, 6);
                      setOtpValue(c);
                      if (otpError) setOtpError('');
                    }}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                    autoCorrect={false}
                    autoComplete="one-time-code"
                    textContentType="oneTimeCode"
                  />
                  <FieldError message={otpError} />
                </View>
                <TouchableOpacity
                  accessibilityLabel="Verify code and sign in"
                  onPress={onVerifyOTP}
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
                    onPress={() => {
                      setLoginStep('request');
                      setOtpValue('');
                      setOtpError('');
                    }}
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

        {/* ── REGISTER ──────────────────────────────────────────────────── */}
        {activeTab === 'register' && (
          <View className="bg-card p-6 rounded-3xl border border-border" style={cardShadow}>
            <StepDots current={regStep} total={3} />

            {/* Step 0 — Core Identity */}
            {regStep === 0 && (
              <View>
                <SectionLabel emoji="👤" title="Your Identity" subtitle="Tell us who you are" />

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
                            className={`flex-1 p-4 rounded-2xl border-2 items-center ${value === r ? 'bg-primary/10 border-primary' : 'bg-muted/50 border-border'}`}
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

                {[
                  {
                    name: 'fullName' as const,
                    label: 'Full Name',
                    placeholder: 'Amina Uwimana',
                    hint: 'First and last name as on your ID',
                    cap: 'words' as const,
                    keyboard: 'default' as const,
                  },
                  {
                    name: 'phone' as const,
                    label: 'Phone Number',
                    placeholder: '+250780000000',
                    hint: 'Rwanda number starting with +2507',
                    cap: 'none' as const,
                    keyboard: 'phone-pad' as const,
                  },
                  {
                    name: 'email' as const,
                    label: 'Email Address',
                    placeholder: 'amina@example.com',
                    hint: 'Used for verification codes',
                    cap: 'none' as const,
                    keyboard: 'email-address' as const,
                  },
                ].map(({ name, label, placeholder, hint, cap, keyboard }) => (
                  <Controller
                    key={name}
                    control={reg1Form.control}
                    name={name}
                    render={({ field: { onChange, value }, fieldState: { error } }) => (
                      <View className="mb-4">
                        <Text className="text-sm font-semibold mb-1">
                          {label} <Text className="text-destructive">*</Text>
                        </Text>
                        <TextInput
                          className={`bg-muted/50 p-4 rounded-xl border ${error ? 'border-destructive' : 'border-border'}`}
                          placeholder={placeholder}
                          value={value}
                          onChangeText={onChange}
                          autoCapitalize={cap}
                          keyboardType={keyboard}
                        />
                        <Text className="text-xs text-muted-foreground mt-1">{hint}</Text>
                        <FieldError message={error?.message} />
                      </View>
                    )}
                  />
                ))}

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
                            className={`flex-1 py-2.5 px-2 rounded-xl border items-center ${value === code ? 'bg-primary/10 border-primary' : 'bg-muted/50 border-border'}`}
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
                  subtitle="Optional — helps us find artisans near you"
                />
                <InfoBox
                  message="Your full address helps artisans reach you precisely. The more detail, the better."
                  variant="info"
                />
                {role === 'artisan' && (
                  <InfoBox
                    message="As an artisan, your location helps clients find you. NID required before accepting paid bookings."
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
                            className={`flex-1 py-2.5 px-1 rounded-xl border items-center ${value === v ? 'bg-primary/10 border-primary' : 'bg-muted/50 border-border'}`}
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
                        placeholder="16-digit NID"
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

                {/* Full cascading address */}
                <View className="bg-muted/20 rounded-2xl p-3 mb-2 border border-border/50">
                  <AddressSection form={reg2Form} />
                </View>

                <View className="flex-row gap-3 mt-2">
                  <TouchableOpacity
                    accessibilityLabel="Go back"
                    onPress={() => setRegStep(0)}
                    className="flex-1 bg-muted p-4 rounded-xl items-center"
                  >
                    <Text className="font-bold text-foreground">← Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityLabel="Continue to review"
                    onPress={reg2Form.handleSubmit(onReg2)}
                    className="flex-grow flex-2 bg-primary p-4 rounded-xl items-center"
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

                <View className="bg-muted/50 rounded-2xl p-4 mb-4 gap-2">
                  {[
                    ['Name', regData.fullName],
                    ['Email', regData.email],
                    ['Phone', regData.phone],
                    ['Role', regData.role?.toUpperCase()],
                    ...(regData.province ? [['Province', regData.province]] : []),
                    ...(regData.district ? [['District', regData.district]] : []),
                    ...(regData.sector || regData.cell || regData.village
                      ? [
                          [
                            'Area',
                            [regData.village, regData.cell, regData.sector]
                              .filter(Boolean)
                              .join(', '),
                          ],
                        ]
                      : []),
                    ...(regData.house_number || regData.street_road
                      ? [
                          [
                            'Street',
                            [regData.house_number, regData.street_road].filter(Boolean).join(', '),
                          ],
                        ]
                      : []),
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
                      <Text
                        className="text-foreground font-semibold text-sm flex-1 text-right ml-4"
                        numberOfLines={1}
                      >
                        {val}
                      </Text>
                    </View>
                  ))}
                </View>

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
                          You confirm you're at least 18 and agree to HandyRwanda's Terms of Service
                          and Privacy Policy.
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
                    accessibilityLabel="Go back"
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
