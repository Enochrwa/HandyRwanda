import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import api from '../src/services/api';
import { useAuthStore } from '../src/store/authStore';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const otpSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name is too short'),
  phone: z.string().regex(/^\+2507[2-9]\d{7}$/, 'Invalid Rwanda phone number (+2507...)'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['client', 'artisan']),
});

type LoginData = z.infer<typeof loginSchema>;
type OTPData = z.infer<typeof otpSchema>;
type RegisterData = z.infer<typeof registerSchema>;

export default function AuthScreen() {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const loginForm = useForm<LoginData>({ resolver: zodResolver(loginSchema) });
  const otpForm = useForm<OTPData>({ resolver: zodResolver(otpSchema) });
  const registerForm = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'client' }
  });

  const onSendOTP = async (data: LoginData) => {
    setLoading(true);
    try {
      await api.post('/auth/otp/request', { email: data.email, lang: 'en' });
      setEmail(data.email);
      setStep('verify');
      Toast.show({ type: 'success', text1: 'OTP sent!', text2: 'Check your email' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.response?.data?.detail ?? 'Failed to send OTP' });
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
          avatarUrl: user.avatar_url,
        },
        access_token,
        refresh_token
      );
      Toast.show({ type: 'success', text1: 'Welcome back!', text2: `Hello, ${user.full_name}` });
      router.replace('/(tabs)');
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.response?.data?.detail ?? 'Invalid OTP' });
    } finally {
      setLoading(false);
    }
  };

  const onRegister = async (data: RegisterData) => {
    setLoading(true);
    try {
      await api.post('/auth/register', {
        full_name: data.fullName,
        phone_number: data.phone,
        email: data.email,
        role: data.role,
      });
      Toast.show({ type: 'success', text1: 'Account created!', text2: 'Check your email for OTP' });
      setActiveTab('login');
      setStep('request');
      loginForm.setValue('email', data.email);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.response?.data?.detail ?? 'Registration failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="p-6">
        <View className="mt-10 mb-8">
          <Text className="text-3xl font-bold text-primary text-center">HandyRwanda</Text>
          <Text className="text-muted-foreground text-center mt-2">Connecting Kigali to the best artisans</Text>
        </View>

        <View className="flex-row bg-muted rounded-xl p-1 mb-6">
          <TouchableOpacity accessibilityLabel="Button"
            onPress={() => setActiveTab('login')}
            className={`flex-1 py-2 rounded-lg ${activeTab === 'login' ? 'bg-card shadow-sm' : ''}`}
          >
            <Text className={`text-center font-semibold ${activeTab === 'login' ? 'text-foreground' : 'text-muted-foreground'}`}>Login</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityLabel="Button"
            onPress={() => setActiveTab('register')}
            className={`flex-1 py-2 rounded-lg ${activeTab === 'register' ? 'bg-card shadow-sm' : ''}`}
          >
            <Text className={`text-center font-semibold ${activeTab === 'register' ? 'text-foreground' : 'text-muted-foreground'}`}>Register</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'login' ? (
          <View className="bg-card p-6 rounded-3xl border border-border shadow-sm">
            {step === 'request' ? (
              <View>
                <Text className="text-xl font-bold mb-4">Welcome back</Text>
                <Text className="text-muted-foreground mb-6">Enter your email to receive a login code</Text>

                <Controller
                  control={loginForm.control}
                  name="email"
                  render={({ field: { onChange, value }, fieldState: { error } }) => (
                    <View className="mb-4">
                      <Text className="text-sm font-medium mb-1">Email Address</Text>
                      <TextInput
                        className={`bg-muted/50 p-4 rounded-xl border ${error ? 'border-destructive' : 'border-border'}`}
                        placeholder="email@example.com"
                        value={value}
                        onChangeText={onChange}
                        autoCapitalize="none"
                        keyboardType="email-address"
                      />
                      {error && <Text className="text-destructive text-xs mt-1">{error.message}</Text>}
                    </View>
                  )}
                />

                <TouchableOpacity accessibilityLabel="Button"
                  onPress={loginForm.handleSubmit(onSendOTP)}
                  disabled={loading}
                  className="bg-primary p-4 rounded-xl items-center"
                >
                  {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">Send OTP</Text>}
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Text className="text-xl font-bold mb-4">Verify OTP</Text>
                <Text className="text-muted-foreground mb-6">Enter the 6-digit code sent to {email}</Text>

                <Controller
                  control={otpForm.control}
                  name="otp"
                  render={({ field: { onChange, value }, fieldState: { error } }) => (
                    <View className="mb-4">
                      <TextInput
                        className={`bg-muted/50 p-4 rounded-xl border text-center text-2xl tracking-widest ${error ? 'border-destructive' : 'border-border'}`}
                        placeholder="000000"
                        value={value}
                        onChangeText={onChange}
                        keyboardType="number-pad"
                        maxLength={6}
                      />
                      {error && <Text className="text-destructive text-xs mt-1 text-center">{error.message}</Text>}
                    </View>
                  )}
                />

                <TouchableOpacity accessibilityLabel="Button"
                  onPress={otpForm.handleSubmit(onVerifyOTP)}
                  disabled={loading}
                  className="bg-primary p-4 rounded-xl items-center mb-4"
                >
                  {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">Verify & Login</Text>}
                </TouchableOpacity>

                <TouchableOpacity accessibilityLabel="Button" onPress={() => setStep('request')}>
                  <Text className="text-primary text-center font-medium">Change Email</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <View className="bg-card p-6 rounded-3xl border border-border shadow-sm">
            <Text className="text-xl font-bold mb-4">Create Account</Text>

            <Controller
              control={registerForm.control}
              name="fullName"
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <View className="mb-4">
                  <Text className="text-sm font-medium mb-1">Full Name</Text>
                  <TextInput
                    className={`bg-muted/50 p-4 rounded-xl border ${error ? 'border-destructive' : 'border-border'}`}
                    placeholder="Full Name"
                    value={value}
                    onChangeText={onChange}
                  />
                  {error && <Text className="text-destructive text-xs mt-1">{error.message}</Text>}
                </View>
              )}
            />

            <Controller
              control={registerForm.control}
              name="phone"
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <View className="mb-4">
                  <Text className="text-sm font-medium mb-1">Phone Number</Text>
                  <TextInput
                    className={`bg-muted/50 p-4 rounded-xl border ${error ? 'border-destructive' : 'border-border'}`}
                    placeholder="+250780000000"
                    value={value}
                    onChangeText={onChange}
                    keyboardType="phone-pad"
                  />
                  {error && <Text className="text-destructive text-xs mt-1">{error.message}</Text>}
                </View>
              )}
            />

            <Controller
              control={registerForm.control}
              name="email"
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <View className="mb-4">
                  <Text className="text-sm font-medium mb-1">Email Address</Text>
                  <TextInput
                    className={`bg-muted/50 p-4 rounded-xl border ${error ? 'border-destructive' : 'border-border'}`}
                    placeholder="email@example.com"
                    value={value}
                    onChangeText={onChange}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                  {error && <Text className="text-destructive text-xs mt-1">{error.message}</Text>}
                </View>
              )}
            />

            <Controller
              control={registerForm.control}
              name="role"
              render={({ field: { onChange, value } }) => (
                <View className="mb-6">
                  <Text className="text-sm font-medium mb-2">I am a...</Text>
                  <View className="flex-row gap-2">
                    <TouchableOpacity accessibilityLabel="Button"
                      onPress={() => onChange('client')}
                      className={`flex-1 p-3 rounded-xl border ${value === 'client' ? 'bg-primary/10 border-primary' : 'bg-muted/50 border-border'}`}
                    >
                      <Text className={`text-center font-bold ${value === 'client' ? 'text-primary' : 'text-muted-foreground'}`}>Client</Text>
                    </TouchableOpacity>
                    <TouchableOpacity accessibilityLabel="Button"
                      onPress={() => onChange('artisan')}
                      className={`flex-1 p-3 rounded-xl border ${value === 'artisan' ? 'bg-primary/10 border-primary' : 'bg-muted/50 border-border'}`}
                    >
                      <Text className={`text-center font-bold ${value === 'artisan' ? 'text-primary' : 'text-muted-foreground'}`}>Artisan</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />

            <TouchableOpacity accessibilityLabel="Button"
              onPress={registerForm.handleSubmit(onRegister)}
              disabled={loading}
              className="bg-primary p-4 rounded-xl items-center"
            >
              {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">Register</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
