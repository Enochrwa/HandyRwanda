// File: mobile/src/components/NegotiationTimeline.tsx
// Sprint 11 — Negotiation history timeline for both client and artisan views

import { formatDistanceToNow } from 'date-fns';
import React from 'react';
import { View, Text } from 'react-native';

function formatRWF(n: number): string {
  return new Intl.NumberFormat('rw-RW').format(n);
}

export interface TimelineEvent {
  event_type: string;
  actor: string;
  role: 'client' | 'artisan';
  price: number;
  message?: string;
  timestamp: string;
  is_accepted: boolean;
}

interface NegotiationTimelineProps {
  events: TimelineEvent[];
  artisanName?: string;
  clientName?: string;
}

const EVENT_LABELS: Record<string, string> = {
  bid_submitted: 'submitted bid',
  client_counter: 'countered with',
  artisan_counter: 'proposed',
};

export function NegotiationTimeline({ events, artisanName, clientName }: NegotiationTimelineProps) {
  if (!events || events.length <= 1) return null;

  const savings = events.length > 1 ? events[0].price - events[events.length - 1].price : 0;

  return (
    <View className="mt-4 bg-muted/30 border border-border rounded-2xl p-4">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-xs font-bold text-foreground">📋 Negotiation History</Text>
        {savings > 0 && (
          <Text className="text-[10px] font-bold text-green-600">
            -{formatRWF(savings)} RWF saved
          </Text>
        )}
      </View>

      {events.map((event, i) => (
        <View key={i} className="flex-row items-start gap-3 mb-3">
          {/* Role dot + line */}
          <View className="items-center" style={{ width: 28 }}>
            <View
              className={`w-6 h-6 rounded-full items-center justify-center ${
                event.role === 'client' ? 'bg-blue-100' : 'bg-orange-100'
              }`}
            >
              <Text
                className={`text-[9px] font-extrabold ${
                  event.role === 'client' ? 'text-blue-700' : 'text-orange-700'
                }`}
              >
                {event.role === 'client' ? 'C' : 'A'}
              </Text>
            </View>
            {i < events.length - 1 && (
              <View className="w-px flex-1 bg-border mt-1" style={{ minHeight: 12 }} />
            )}
          </View>

          {/* Content */}
          <View className="flex-1 pb-1">
            <View className="flex-row items-baseline flex-wrap gap-1">
              <Text className="text-xs font-bold text-foreground">{event.actor}</Text>
              <Text className="text-xs text-muted-foreground">
                {EVENT_LABELS[event.event_type] ?? 'offered'}
              </Text>
              <Text className="text-xs font-extrabold text-foreground">
                {formatRWF(event.price)} RWF
              </Text>
              {event.is_accepted && (
                <View className="bg-green-100 rounded-full px-1.5 py-0.5">
                  <Text className="text-[9px] font-bold text-green-700">✓ Agreed</Text>
                </View>
              )}
            </View>
            {event.message && (
              <Text className="text-[11px] text-muted-foreground italic mt-0.5">
                "{event.message}"
              </Text>
            )}
            <Text className="text-[10px] text-muted-foreground mt-0.5">
              {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
