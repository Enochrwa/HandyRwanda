// File: mobile/src/components/NegotiationSheet.tsx
// Sprint 11 — Price Negotiation bottom sheet component (artisan view)
// Handles: view counter-offer, accept/reject/propose-middle actions

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Toast from 'react-native-toast-message';

function formatRWF(n: number): string {
  return new Intl.NumberFormat('rw-RW').format(n);
}

export interface BidNegotiationData {
  id: string;
  proposed_price: number;
  status: string;
  negotiation_round: number;
  max_negotiation_rounds: number;
  counter_price?: number;
  counter_message?: string;
  counter_at?: string;
  artisan_counter_price?: number;
  artisan_counter_message?: string;
  artisan_counter_at?: string;
  current_offer_price?: number;
  is_negotiable?: boolean;
  job_title?: string;
  client_name?: string;
}

interface NegotiationSheetProps {
  visible: boolean;
  bid: BidNegotiationData | null;
  onClose: () => void;
  onAcceptCounter: (bidId: string) => void;
  onRejectCounter: (bidId: string) => void;
  onProposeMiddle: (bidId: string, price: number, message: string) => void;
  isAccepting: boolean;
  isRejecting: boolean;
  isProposing: boolean;
}

const MAX_ROUNDS = 3;

function RoundDots({ round, max }: { round: number; max: number }) {
  return (
    <View className="flex-row items-center gap-1.5">
      {Array.from({ length: max }).map((_, i) => (
        <View key={i} className={`w-2 h-2 rounded-full ${i < round ? 'bg-primary' : 'bg-muted'}`} />
      ))}
      <Text className="text-[10px] text-muted-foreground ml-1">
        {round}/{max} rounds used
      </Text>
    </View>
  );
}

export function NegotiationSheet({
  visible,
  bid,
  onClose,
  onAcceptCounter,
  onRejectCounter,
  onProposeMiddle,
  isAccepting,
  isRejecting,
  isProposing,
}: NegotiationSheetProps) {
  const [showMiddleInput, setShowMiddleInput] = useState(false);
  const [middlePrice, setMiddlePrice] = useState('');
  const [middleMessage, setMiddleMessage] = useState('');

  // Pre-fill with suggested middle ground
  React.useEffect(() => {
    if (bid && bid.counter_price) {
      const suggested = Math.round((bid.proposed_price + bid.counter_price) / 2);
      setMiddlePrice(String(suggested));
    }
  }, [bid]);

  if (!bid) return null;

  const counterPrice = bid.counter_price ?? 0;
  const originalAsk = bid.proposed_price;
  const roundsLeft = MAX_ROUNDS - bid.negotiation_round;
  const isLastRound = roundsLeft <= 1;
  const canPropose = roundsLeft > 0 && bid.status === 'countered_by_client';

  const handlePropose = () => {
    const price = parseInt(middlePrice, 10);
    if (!price || isNaN(price) || price < 500) {
      Toast.show({ type: 'error', text1: 'Invalid price', text2: 'Minimum 500 RWF' });
      return;
    }
    onProposeMiddle(bid.id, price, middleMessage.trim());
    setShowMiddleInput(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View className="bg-card rounded-t-3xl overflow-hidden">
            {/* Handle */}
            <View className="items-center pt-3 pb-1">
              <View className="w-10 h-1 rounded-full bg-muted" />
            </View>

            <ScrollView
              className="px-5 pt-2 pb-8"
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Header */}
              <View className="flex-row items-center justify-between mb-4">
                <View>
                  <Text className="text-lg font-extrabold text-foreground">
                    💬 Counter-Offer Received
                  </Text>
                  {bid.job_title && (
                    <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>
                      {bid.job_title}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  className="w-8 h-8 rounded-full bg-muted items-center justify-center"
                >
                  <Text className="text-foreground font-bold text-base">✕</Text>
                </TouchableOpacity>
              </View>

              {/* Round indicator */}
              <View className="mb-4">
                <RoundDots round={bid.negotiation_round} max={MAX_ROUNDS} />
                {isLastRound && bid.status === 'countered_by_client' && (
                  <View className="mt-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    <Text className="text-xs font-bold text-amber-700">
                      ⚠️ Last negotiation round — accept, reject, or propose a final price
                    </Text>
                  </View>
                )}
              </View>

              {/* Price comparison card */}
              <View className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-5">
                <Text className="text-[10px] font-bold uppercase text-muted-foreground mb-3">
                  Price Comparison
                </Text>
                <View className="flex-row justify-between items-center">
                  <View className="items-center flex-1">
                    <Text className="text-[10px] text-muted-foreground mb-1">Your ask</Text>
                    <Text className="text-xl font-extrabold text-foreground">
                      {formatRWF(originalAsk)}
                    </Text>
                    <Text className="text-[10px] text-muted-foreground">RWF</Text>
                  </View>
                  <View className="items-center px-3">
                    <Text className="text-2xl">⟷</Text>
                  </View>
                  <View className="items-center flex-1">
                    <Text className="text-[10px] text-muted-foreground mb-1">
                      {bid.client_name ?? 'Client'} offers
                    </Text>
                    <Text className="text-xl font-extrabold text-blue-600">
                      {formatRWF(counterPrice)}
                    </Text>
                    <Text className="text-[10px] text-muted-foreground">RWF</Text>
                  </View>
                </View>

                {/* Difference */}
                <View className="mt-3 pt-3 border-t border-primary/10 items-center">
                  <Text className="text-xs text-muted-foreground">
                    Difference:{' '}
                    <Text className="font-bold text-red-500">
                      -{formatRWF(originalAsk - counterPrice)} RWF
                    </Text>{' '}
                    ({Math.round(((originalAsk - counterPrice) / originalAsk) * 100)}% less)
                  </Text>
                </View>

                {/* Middle ground suggestion */}
                {canPropose && !showMiddleInput && (
                  <View className="mt-2 items-center">
                    <Text className="text-[10px] text-muted-foreground">
                      Suggested middle:{' '}
                      <Text className="font-bold text-primary">
                        {formatRWF(Math.round((originalAsk + counterPrice) / 2))} RWF
                      </Text>
                    </Text>
                  </View>
                )}
              </View>

              {/* Client message */}
              {bid.counter_message && (
                <View className="bg-muted/30 rounded-xl px-4 py-3 mb-4">
                  <Text className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                    Client's note
                  </Text>
                  <Text className="text-sm text-foreground italic">"{bid.counter_message}"</Text>
                </View>
              )}

              {/* ── Middle ground input ── */}
              {showMiddleInput && (
                <View className="bg-primary/5 border-2 border-primary/30 rounded-2xl p-4 mb-4">
                  <Text className="text-sm font-bold text-primary mb-3">
                    🔄 Propose a Middle Ground
                  </Text>

                  <Text className="text-xs font-semibold text-foreground mb-2">
                    Your counter price (RWF)
                  </Text>
                  <TextInput
                    value={middlePrice}
                    onChangeText={setMiddlePrice}
                    keyboardType="number-pad"
                    placeholder="Enter price…"
                    className="bg-background border border-border rounded-xl px-4 py-3 text-foreground text-base font-bold mb-3"
                  />

                  <Text className="text-xs font-semibold text-foreground mb-2">
                    Note to client{' '}
                    <Text className="font-normal text-muted-foreground">(optional)</Text>
                  </Text>
                  <TextInput
                    value={middleMessage}
                    onChangeText={(t) => setMiddleMessage(t.slice(0, 300))}
                    placeholder="E.g. This covers materials and 3 hours of work…"
                    multiline
                    numberOfLines={2}
                    className="bg-background border border-border rounded-xl px-4 py-3 text-foreground text-sm mb-1"
                    style={{ textAlignVertical: 'top', minHeight: 60 }}
                  />
                  <Text className="text-[10px] text-muted-foreground text-right mb-3">
                    {middleMessage.length}/300
                  </Text>

                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => setShowMiddleInput(false)}
                      className="flex-1 border border-border rounded-xl py-3 items-center"
                    >
                      <Text className="text-sm font-semibold text-muted-foreground">Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handlePropose}
                      disabled={isProposing}
                      className="flex-[2] bg-primary rounded-xl py-3 items-center flex-row justify-center gap-2"
                    >
                      {isProposing ? (
                        <ActivityIndicator color="white" size="small" />
                      ) : (
                        <Text className="text-white font-bold text-sm">Send Counter</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ── Action buttons ── */}
              {!showMiddleInput && bid.status === 'countered_by_client' && (
                <View className="gap-3">
                  {/* Accept counter */}
                  <TouchableOpacity
                    onPress={() => onAcceptCounter(bid.id)}
                    disabled={isAccepting || isRejecting}
                    className="bg-green-600 rounded-2xl py-4 items-center flex-row justify-center gap-2"
                  >
                    {isAccepting ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <>
                        <Text className="text-2xl">✅</Text>
                        <View>
                          <Text className="text-white font-extrabold text-base">
                            Accept {formatRWF(counterPrice)} RWF
                          </Text>
                          <Text className="text-green-100 text-[11px]">
                            Booking created immediately
                          </Text>
                        </View>
                      </>
                    )}
                  </TouchableOpacity>

                  {/* Propose middle ground */}
                  {canPropose && (
                    <TouchableOpacity
                      onPress={() => setShowMiddleInput(true)}
                      className="border-2 border-primary rounded-2xl py-4 items-center flex-row justify-center gap-2 bg-primary/5"
                    >
                      <Text className="text-2xl">🔄</Text>
                      <View>
                        <Text className="text-primary font-extrabold text-base">
                          Propose Middle Ground
                        </Text>
                        <Text className="text-primary/70 text-[11px]">
                          Suggest ~{formatRWF(Math.round((originalAsk + counterPrice) / 2))} RWF
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Decline counter */}
                  <TouchableOpacity
                    onPress={() => onRejectCounter(bid.id)}
                    disabled={isRejecting || isAccepting}
                    className="border border-border rounded-2xl py-3 items-center flex-row justify-center gap-2"
                  >
                    {isRejecting ? (
                      <ActivityIndicator size="small" />
                    ) : (
                      <>
                        <Text className="text-base">❌</Text>
                        <Text className="text-muted-foreground font-semibold text-sm">
                          Decline Counter-Offer
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
