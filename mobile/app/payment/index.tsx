// File: mobile/app/payment/index.tsx
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import Toast from 'react-native-toast-message';

import api from '../../src/services/api';

type PaymentMethod = 'mtn_momo' | 'airtel_money';
type PaymentStep = 'select' | 'instructions' | 'proof' | 'pending' | 'done';

interface PaymentInstructions {
  payment_id: string;
  reference_code: string;
  amount: number;
  method: PaymentMethod;
  method_label: string;
  receiver_phone: string;
  status: string;
  instructions: string[];
  note: string;
}

const METHODS: { key: PaymentMethod; label: string; emoji: string; color: string }[] = [
  { key: 'mtn_momo', label: 'MTN MoMo', emoji: '📱', color: '#FFCC00' },
  { key: 'airtel_money', label: 'Airtel Money', emoji: '💳', color: '#FF0000' },
];

function formatRWF(n: number) {
  return new Intl.NumberFormat('rw-RW').format(n);
}

export default function PaymentScreen() {
  const router = useRouter();
  const { bookingId, amount: amountStr } = useLocalSearchParams<{ bookingId: string; amount: string }>();

  const [step, setStep] = useState<PaymentStep>('select');
  const [method, setMethod] = useState<PaymentMethod>('mtn_momo');
  const [instructions, setInstructions] = useState<PaymentInstructions | null>(null);
  const [transactionId, setTransactionId] = useState('');
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Check for an existing payment on mount (idempotent re-entry)
  useEffect(() => {
    if (!bookingId) return;
    api.get(`/payments/booking/${bookingId}`).then((r) => {
      const s = r.data.status;
      if (s === 'approved') setStep('done');
      else if (s === 'pending_verification') setStep('pending');
      else if (s && s !== 'not_initiated') {
        setInstructions(r.data);
        setStep('instructions');
      }
    }).catch(() => {});
  }, [bookingId]);

  const handleInitiate = async () => {
    setLoading(true);
    try {
      const res = await api.post(`/payments/initiate/${bookingId}`, { method });
      setInstructions(res.data);
      setStep('instructions');
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.response?.data?.detail ?? 'Could not start payment.' });
    } finally {
      setLoading(false);
    }
  };

  const pickScreenshot = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to attach a screenshot.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.6,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setScreenshotBase64(result.assets[0].base64);
      Toast.show({ type: 'success', text1: 'Screenshot attached ✓' });
    }
  };

  const handleSubmitProof = async () => {
    if (transactionId.trim().length < 3) {
      Toast.show({ type: 'error', text1: 'Enter the transaction ID from your MoMo SMS' });
      return;
    }
    setLoading(true);
    try {
      await api.post(`/payments/${instructions!.payment_id}/submit-proof`, {
        client_transaction_id: transactionId.trim(),
        proof_screenshot_base64: screenshotBase64 ?? undefined,
      });
      setStep('pending');
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.response?.data?.detail ?? 'Could not submit proof.' });
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    Toast.show({ type: 'success', text1: `${label} copied!` });
  };

  // ── SELECT METHOD ─────────────────────────────────────────────────────────
  if (step === 'select') {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-background">
        <ScrollView className="flex-1 px-5 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
          <TouchableOpacity onPress={() => router.back()} className="mb-6">
            <Text className="text-primary font-semibold">← Back</Text>
          </TouchableOpacity>
          <Text className="text-2xl font-extrabold text-foreground mb-1">Pay for Service</Text>
          <Text className="text-sm text-muted-foreground mb-6">
            Amount due:{' '}
            <Text className="font-bold text-foreground text-lg">{formatRWF(parseInt(amountStr ?? '0'))} RWF</Text>
          </Text>
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">
            Select Payment Method
          </Text>
          {METHODS.map((m) => (
            <TouchableOpacity
              key={m.key}
              onPress={() => setMethod(m.key)}
              className={`flex-row items-center p-4 rounded-3xl border-2 mb-3 ${method === m.key ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}
            >
              <Text style={{ fontSize: 28 }} className="mr-4">{m.emoji}</Text>
              <View className="flex-1">
                <Text className="font-bold text-base">{m.label}</Text>
                <Text className="text-xs text-muted-foreground">Available across Rwanda</Text>
              </View>
              <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${method === m.key ? 'border-primary bg-primary' : 'border-border'}`}>
                {method === m.key && <View className="w-2 h-2 rounded-full bg-white" />}
              </View>
            </TouchableOpacity>
          ))}
          <View className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mt-2 mb-6">
            <Text className="text-amber-800 text-sm font-medium">
              💡 You'll send money directly via your mobile wallet. Verification takes under 5 minutes.
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleInitiate}
            disabled={loading}
            className={`bg-primary rounded-2xl py-4 items-center ${loading ? 'opacity-60' : ''}`}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-extrabold text-base">
                Continue with {method === 'mtn_momo' ? 'MTN MoMo' : 'Airtel Money'} →
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── INSTRUCTIONS ──────────────────────────────────────────────────────────
  if (step === 'instructions' && instructions) {
    return (
      <ScrollView className="flex-1 bg-background px-5 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
        <TouchableOpacity onPress={() => setStep('select')} className="mb-5">
          <Text className="text-primary font-semibold">← Change method</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-extrabold mb-1">{instructions.method_label} Payment</Text>
        <Text className="text-sm text-muted-foreground mb-5">Follow these steps carefully</Text>

        {/* Amount */}
        <View className="bg-primary/5 border border-primary/20 rounded-3xl p-5 mb-5 items-center">
          <Text className="text-xs text-muted-foreground uppercase tracking-wide">Amount to Send</Text>
          <Text className="text-4xl font-black text-primary mt-1">{formatRWF(instructions.amount)}</Text>
          <Text className="text-sm text-muted-foreground">RWF</Text>
        </View>

        {/* Copy pills */}
        <View className="flex-row gap-3 mb-5">
          <TouchableOpacity onPress={() => copy(instructions.receiver_phone, 'Phone number')} className="flex-1 bg-card border border-border rounded-2xl p-3 items-center">
            <Text className="text-[10px] text-muted-foreground uppercase mb-1">Send To</Text>
            <Text className="font-bold text-foreground">{instructions.receiver_phone}</Text>
            <Text className="text-[10px] text-muted-foreground mt-1">📋 Tap to copy</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => copy(instructions.reference_code, 'Reference')} className="flex-1 bg-card border border-border rounded-2xl p-3 items-center">
            <Text className="text-[10px] text-muted-foreground uppercase mb-1">Reference</Text>
            <Text className="font-bold text-foreground">{instructions.reference_code}</Text>
            <Text className="text-[10px] text-muted-foreground mt-1">📋 Tap to copy</Text>
          </TouchableOpacity>
        </View>

        {/* Steps */}
        <View className="bg-card border border-border rounded-3xl p-5 mb-5">
          <Text className="font-bold text-base mb-3">How to pay:</Text>
          {instructions.instructions.map((s, i) => (
            <View key={i} className="flex-row mb-2">
              <View className="w-6 h-6 rounded-full bg-primary/10 items-center justify-center mr-3 mt-0.5 shrink-0">
                <Text className="text-primary text-[11px] font-bold">{i + 1}</Text>
              </View>
              <Text className="text-sm text-foreground leading-5 flex-1">{s.replace(/^\d+\.\s/, '')}</Text>
            </View>
          ))}
        </View>

        <View className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-5">
          <Text className="text-blue-800 text-sm">{instructions.note}</Text>
        </View>

        <TouchableOpacity onPress={() => setStep('proof')} className="bg-primary rounded-2xl py-4 items-center">
          <Text className="text-white font-extrabold text-base">I've Sent the Payment →</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── PROOF SUBMISSION ──────────────────────────────────────────────────────
  if (step === 'proof') {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-background">
        <ScrollView className="flex-1 px-5 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
          <TouchableOpacity onPress={() => setStep('instructions')} className="mb-6">
            <Text className="text-primary font-semibold">← Back to instructions</Text>
          </TouchableOpacity>
          <Text className="text-2xl font-extrabold mb-1">Confirm Payment</Text>
          <Text className="text-sm text-muted-foreground mb-6">
            Enter the transaction ID from your MoMo confirmation SMS
          </Text>

          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
            Transaction ID <Text className="text-destructive">*</Text>
          </Text>
          <TextInput
            value={transactionId}
            onChangeText={setTransactionId}
            placeholder="e.g. MP250601.1234.X12345"
            className="bg-card border border-border rounded-2xl px-4 py-3.5 text-foreground text-sm mb-5"
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
            Screenshot <Text className="text-muted-foreground font-normal">(optional, speeds up verification)</Text>
          </Text>
          <TouchableOpacity
            onPress={pickScreenshot}
            className={`border-2 border-dashed rounded-2xl p-5 items-center mb-6 ${screenshotBase64 ? 'border-green-400 bg-green-50' : 'border-border bg-card'}`}
          >
            {screenshotBase64 ? (
              <>
                <Text style={{ fontSize: 28 }}>✅</Text>
                <Text className="text-green-700 font-semibold mt-2">Screenshot attached</Text>
                <Text className="text-xs text-muted-foreground mt-1">Tap to replace</Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 28 }}>📎</Text>
                <Text className="text-muted-foreground mt-2 font-medium">Attach confirmation screenshot</Text>
                <Text className="text-xs text-muted-foreground mt-0.5">From your photo gallery</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSubmitProof}
            disabled={loading || transactionId.trim().length < 3}
            className={`bg-primary rounded-2xl py-4 items-center ${loading || transactionId.trim().length < 3 ? 'opacity-50' : ''}`}
          >
            {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-extrabold text-base">Submit Proof</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── PENDING VERIFICATION ──────────────────────────────────────────────────
  if (step === 'pending') {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8">
        <Text style={{ fontSize: 56 }} className="mb-6">⏳</Text>
        <Text className="text-2xl font-extrabold text-center mb-2">Verifying Payment</Text>
        <Text className="text-sm text-muted-foreground text-center mb-6">
          We're checking your payment. This usually takes{' '}
          <Text className="font-bold text-foreground">under 5 minutes</Text>.
        </Text>
        <View className="bg-card border border-border rounded-3xl p-5 w-full mb-6">
          {[
            { label: 'Proof submitted', done: true },
            { label: 'Admin verification', done: false },
            { label: 'Booking confirmed', done: false },
          ].map((item, i) => (
            <View key={i} className="flex-row items-center mb-2">
              <View className={`w-2 h-2 rounded-full mr-2 ${item.done ? 'bg-amber-400' : 'bg-muted'}`} />
              <Text className="text-sm text-muted-foreground">{item.label}</Text>
            </View>
          ))}
        </View>
        <Text className="text-xs text-muted-foreground text-center mb-6">
          You'll receive a notification when verified. You can safely close this screen.
        </Text>
        <TouchableOpacity onPress={() => router.replace('/(tabs)')} className="bg-primary rounded-2xl py-3 px-8">
          <Text className="text-white font-bold">Go to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── DONE ──────────────────────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-background items-center justify-center px-8">
      <Text style={{ fontSize: 56 }} className="mb-6">✅</Text>
      <Text className="text-2xl font-extrabold text-center mb-2">Payment Confirmed!</Text>
      <Text className="text-sm text-muted-foreground text-center mb-8">
        Your payment has been verified. Your artisan has been notified and your booking is active.
      </Text>
      <TouchableOpacity onPress={() => router.replace(`/messages/${bookingId}`)} className="bg-primary rounded-2xl py-3 px-8 mb-3">
        <Text className="text-white font-bold">Open Chat with Artisan</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.replace('/(tabs)')}>
        <Text className="text-primary font-semibold">Back to Home</Text>
      </TouchableOpacity>
    </View>
  );
}
