// File: mobile/src/components/RwandaAddressPicker.tsx
/**
 * Mobile Rwanda address picker with cascading dropdowns.
 * Province → District → Sector → Cell → Village → Street/Road
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

export interface RwandaAddress {
  province: string;
  district: string;
  sector: string;
  cell: string;
  village: string;
  street_road: string;
  formatted: string;
}

interface Props {
  value?: Partial<RwandaAddress>;
  onChange: (addr: RwandaAddress) => void;
}

export function RwandaAddressPicker({ value, onChange }: Props) {
  const [province, setProvince] = useState(value?.province ?? '');
  const [district, setDistrict] = useState(value?.district ?? '');
  const [sector, setSector] = useState(value?.sector ?? '');
  const [cell, setCell] = useState(value?.cell ?? '');
  const [village, setVillage] = useState(value?.village ?? '');
  const [streetRoad, setStreetRoad] = useState(value?.street_road ?? '');

  const { data: provinces } = useQuery<string[]>({
    queryKey: ['addr-provinces'],
    queryFn: () => api.get('/address/provinces').then((r) => r.data.provinces),
    staleTime: Infinity,
  });

  const { data: districts } = useQuery<string[]>({
    queryKey: ['addr-districts', province],
    queryFn: () => api.get(`/address/districts?province=${encodeURIComponent(province)}`).then((r) => r.data.districts),
    enabled: !!province,
    staleTime: Infinity,
  });

  const { data: sectors } = useQuery<string[]>({
    queryKey: ['addr-sectors', province, district],
    queryFn: () => api.get(`/address/sectors?province=${encodeURIComponent(province)}&district=${encodeURIComponent(district)}`).then((r) => r.data.sectors),
    enabled: !!province && !!district,
    staleTime: Infinity,
  });

  const { data: cells } = useQuery<string[]>({
    queryKey: ['addr-cells', province, district, sector],
    queryFn: () => api.get(`/address/cells?province=${encodeURIComponent(province)}&district=${encodeURIComponent(district)}&sector=${encodeURIComponent(sector)}`).then((r) => r.data.cells),
    enabled: !!province && !!district && !!sector,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!district) return;
    const parts = [streetRoad, village, cell, sector, district, 'Rwanda'].filter(Boolean);
    onChange({ province, district, sector, cell, village, street_road: streetRoad, formatted: parts.join(', ') });
  }, [province, district, sector, cell, village, streetRoad]);

  const pickerStyle = { color: '#111' };

  return (
    <View style={styles.container}>
      <PickerRow label="Province *" value={province} items={provinces ?? []} onValueChange={(v) => { setProvince(v); setDistrict(''); setSector(''); setCell(''); setVillage(''); }} />
      <PickerRow label="District *" value={district} items={districts ?? []} onValueChange={(v) => { setDistrict(v); setSector(''); setCell(''); setVillage(''); }} disabled={!province} />
      <PickerRow label="Sector" value={sector} items={sectors ?? []} onValueChange={(v) => { setSector(v); setCell(''); setVillage(''); }} disabled={!district} />
      <PickerRow label="Cell" value={cell} items={cells ?? []} onValueChange={(v) => { setCell(v); setVillage(''); }} disabled={!sector} />

      <View style={styles.field}>
        <Text style={styles.label}>Village</Text>
        <TextInput style={styles.input} placeholder="Village (optional)" value={village} onChangeText={setVillage} />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Street / Road</Text>
        <TextInput style={styles.input} placeholder="e.g. KG 7 Ave, KN 3 Rd" value={streetRoad} onChangeText={setStreetRoad} />
      </View>

      {district ? (
        <View style={styles.preview}>
          <Text style={styles.previewText}>
            📍 {[streetRoad, village, cell, sector, district, province, 'Rwanda'].filter(Boolean).join(', ')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function PickerRow({ label, value, items, onValueChange, disabled }: {
  label: string; value: string; items: string[];
  onValueChange: (v: string) => void; disabled?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, disabled && { opacity: 0.4 }]}>{label}</Text>
      <View style={[styles.pickerWrapper, disabled && { opacity: 0.4 }]}>
        <Picker selectedValue={value} onValueChange={onValueChange} enabled={!disabled}>
          <Picker.Item label={`Select ${label.replace(' *', '')}...`} value="" />
          {items.map((item) => <Picker.Item key={item} label={item} value={item} />)}
        </Picker>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  field: { gap: 4 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  pickerWrapper: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, overflow: 'hidden', backgroundColor: '#F9FAFB' },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: '#F9FAFB' },
  preview: { backgroundColor: '#EFF6FF', borderRadius: 8, padding: 10, marginTop: 4 },
  previewText: { fontSize: 12, color: '#1D4ED8', lineHeight: 18 },
});
