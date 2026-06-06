// File: mobile/src/components/RwandaAddressPicker.tsx
/**
 * Mobile Rwanda address picker with cascading dropdowns.
 * Province → District → Sector → Cell → Village → Street/Road
 */
import { Picker } from '@react-native-picker/picker';
import { useQuery } from '@tanstack/react-query';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

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

  // iOS picker wheel needs an explicit text color; Android ignores itemStyle.
  // pickerStyle was defined but never consumed — wired up here via Platform.
  const pickerStyle = Platform.OS === 'ios' ? { color: '#111' } : undefined;

  const { data: provinces } = useQuery<string[]>({
    queryKey: ['addr-provinces'],
    queryFn: () => api.get('/address/provinces').then((r) => r.data.provinces),
    staleTime: Infinity,
  });

  const { data: districts } = useQuery<string[]>({
    queryKey: ['addr-districts', province],
    queryFn: () =>
      api
        .get(`/address/districts?province=${encodeURIComponent(province)}`)
        .then((r) => r.data.districts),
    enabled: !!province,
    staleTime: Infinity,
  });

  const { data: sectors } = useQuery<string[]>({
    queryKey: ['addr-sectors', province, district],
    queryFn: () =>
      api
        .get(
          `/address/sectors?province=${encodeURIComponent(province)}&district=${encodeURIComponent(district)}`,
        )
        .then((r) => r.data.sectors),
    enabled: !!province && !!district,
    staleTime: Infinity,
  });

  const { data: cells } = useQuery<string[]>({
    queryKey: ['addr-cells', province, district, sector],
    queryFn: () =>
      api
        .get(
          `/address/cells?province=${encodeURIComponent(province)}&district=${encodeURIComponent(district)}&sector=${encodeURIComponent(sector)}`,
        )
        .then((r) => r.data.cells),
    enabled: !!province && !!district && !!sector,
    staleTime: Infinity,
  });

  // Stable notify — mirrors the web version's useCallback pattern so onChange
  // can safely live in the useEffect dep array without causing infinite loops.
  const notify = useCallback(
    (p: string, d: string, s: string, c: string, v: string, sr: string) => {
      if (!d) return;
      const parts = [sr, v, c, s, d, p, 'Rwanda'].filter(Boolean);
      onChange({
        province: p,
        district: d,
        sector: s,
        cell: c,
        village: v,
        street_road: sr,
        formatted: parts.join(', '),
      });
    },
    [onChange],
  );

  useEffect(() => {
    notify(province, district, sector, cell, village, streetRoad);
  }, [province, district, sector, cell, village, streetRoad, notify]);

  return (
    // ScrollView lets the full picker list scroll on small screens without
    // clipping the lower fields — nestedScrollEnabled for Android list views.
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
    >
      <PickerRow
        label="Province *"
        value={province}
        items={provinces ?? []}
        pickerItemStyle={pickerStyle}
        onValueChange={(v) => {
          setProvince(v);
          setDistrict('');
          setSector('');
          setCell('');
          setVillage('');
        }}
      />
      <PickerRow
        label="District *"
        value={district}
        items={districts ?? []}
        pickerItemStyle={pickerStyle}
        onValueChange={(v) => {
          setDistrict(v);
          setSector('');
          setCell('');
          setVillage('');
        }}
        disabled={!province}
      />
      <PickerRow
        label="Sector"
        value={sector}
        items={sectors ?? []}
        pickerItemStyle={pickerStyle}
        onValueChange={(v) => {
          setSector(v);
          setCell('');
          setVillage('');
        }}
        disabled={!district}
      />
      <PickerRow
        label="Cell"
        value={cell}
        items={cells ?? []}
        pickerItemStyle={pickerStyle}
        onValueChange={(v) => {
          setCell(v);
          setVillage('');
        }}
        disabled={!sector}
      />

      <View style={styles.field}>
        <Text style={styles.label}>Village</Text>
        <TextInput
          style={styles.input}
          placeholder="Village (optional)"
          value={village}
          onChangeText={setVillage}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Street / Road</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. KG 7 Ave, KN 3 Rd"
          value={streetRoad}
          onChangeText={setStreetRoad}
        />
      </View>

      {district ? (
        <View style={styles.preview}>
          <Text style={styles.previewText}>
            📍{' '}
            {[streetRoad, village, cell, sector, district, province, 'Rwanda']
              .filter(Boolean)
              .join(', ')}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function PickerRow({
  label,
  value,
  items,
  onValueChange,
  pickerItemStyle,
  disabled,
}: {
  label: string;
  value: string;
  items: string[];
  onValueChange: (v: string) => void;
  pickerItemStyle?: { color: string } | undefined;
  disabled?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, disabled && styles.dimmed]}>{label}</Text>
      <View style={[styles.pickerWrapper, disabled && styles.dimmed]}>
        <Picker
          selectedValue={value}
          onValueChange={onValueChange}
          enabled={!disabled}
          itemStyle={pickerItemStyle}
        >
          <Picker.Item label={`Select ${label.replace(' *', '')}...`} value="" />
          {items.map((item) => (
            <Picker.Item key={item} label={item} value={item} />
          ))}
        </Picker>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  container: { gap: 12 },
  field: { gap: 4 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  dimmed: { opacity: 0.4 },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F9FAFB',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#F9FAFB',
  },
  preview: { backgroundColor: '#EFF6FF', borderRadius: 8, padding: 10, marginTop: 4 },
  previewText: { fontSize: 12, color: '#1D4ED8', lineHeight: 18 },
});
