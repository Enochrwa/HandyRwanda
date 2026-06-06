/**
 * RwandaAddressPicker — offline-first cascading address picker.
 *
 * Now uses the bundled useRwandaLocation hook instead of hitting
 * /address/* API endpoints. Zero network required; zero re-render loops.
 *
 * Infinite-loop fix (two layers):
 *  1. Data comes from a static in-memory object, not React Query.
 *     No async state → no "data arrived → setState → re-render" cycle.
 *  2. onChange is stored in a ref. The useEffect dep array never includes
 *     the parent's onChange reference, so a new arrow function on each
 *     parent render never triggers a cascade.
 */
import { Picker } from '@react-native-picker/picker';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useRwandaLocation } from '../hooks/useRwandaLocation';

export interface RwandaAddress {
  province: string;
  district: string;
  sector: string;
  cell: string;
  village: string;
  street_road: string;
  house_number: string;
  landmark: string;
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
  const [houseNumber, setHouseNumber] = useState(value?.house_number ?? '');
  const [landmark, setLandmark] = useState(value?.landmark ?? '');

  // Keep onChange in a ref so the effect dep array is stable
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const { getProvinces, getDistrictByProvince, getSectors, getCells } = useRwandaLocation();

  // Compute dropdown options synchronously — no async, no re-renders from data loading
  const provinces = getProvinces();
  const districts = province ? getDistrictByProvince(province) : [];
  const sectors = district ? getSectors(province, district) : [];
  const cells = sector ? getCells(province, district, sector) : [];

  // iOS picker wheel needs explicit text colour
  const pickerItemStyle = Platform.OS === 'ios' ? { color: '#111827' } : undefined;

  // Stable notify — empty deps, reads onChange via ref
  const notify = useCallback(
    (p: string, d: string, s: string, c: string, v: string, sr: string, hn: string, lm: string) => {
      if (!d) return;
      const parts = [hn, sr, lm ? `Near ${lm}` : '', v, c, s, d, p, 'Rwanda'].filter(Boolean);
      onChangeRef.current({
        province: p,
        district: d,
        sector: s,
        cell: c,
        village: v,
        street_road: sr,
        house_number: hn,
        landmark: lm,
        formatted: parts.join(', '),
      });
    },
    [],
  );

  useEffect(() => {
    notify(province, district, sector, cell, village, streetRoad, houseNumber, landmark);
  }, [province, district, sector, cell, village, streetRoad, houseNumber, landmark, notify]);

  // Cascade resets
  const onProvinceChange = useCallback((v: string) => {
    setProvince(v);
    setDistrict('');
    setSector('');
    setCell('');
    setVillage('');
  }, []);

  const onDistrictChange = useCallback((v: string) => {
    setDistrict(v);
    setSector('');
    setCell('');
    setVillage('');
  }, []);

  const onSectorChange = useCallback((v: string) => {
    setSector(v);
    setCell('');
    setVillage('');
  }, []);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
    >
      <PickerRow
        label="Province *"
        value={province}
        items={provinces}
        pickerItemStyle={pickerItemStyle}
        onValueChange={onProvinceChange}
      />
      <PickerRow
        label="District *"
        value={district}
        items={districts}
        pickerItemStyle={pickerItemStyle}
        onValueChange={onDistrictChange}
        disabled={!province}
      />
      {district ? (
        <PickerRow
          label="Sector"
          value={sector}
          items={sectors}
          pickerItemStyle={pickerItemStyle}
          onValueChange={onSectorChange}
        />
      ) : null}
      {sector ? (
        <PickerRow
          label="Cell"
          value={cell}
          items={cells}
          pickerItemStyle={pickerItemStyle}
          onValueChange={(v) => {
            setCell(v);
            setVillage('');
          }}
        />
      ) : null}

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
      <View style={styles.field}>
        <Text style={styles.label}>House / Plot Number</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. No. 14, Plot 7B, Apt 3F"
          value={houseNumber}
          onChangeText={setHouseNumber}
        />
        <Text style={styles.hint}>Helps artisan find the exact door</Text>
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Nearby Landmark</Text>
        <TextInput
          style={[styles.input, { minHeight: 44 }]}
          placeholder="e.g. Near Total petrol station, opposite MTN office"
          value={landmark}
          onChangeText={setLandmark}
          multiline
        />
        <Text style={styles.hint}>A well-known reference point near your location</Text>
      </View>

      {district ? (
        <View style={styles.preview}>
          <Text style={styles.previewLabel}>Full Address</Text>
          <Text style={styles.previewText}>
            📍{' '}
            {[
              houseNumber,
              streetRoad,
              landmark ? `Near ${landmark}` : '',
              village,
              cell,
              sector,
              district,
              province,
              'Rwanda',
            ]
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
          <Picker.Item label={`Select ${label.replace(' *', '')}…`} value="" />
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
  hint: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
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
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  preview: { backgroundColor: '#EFF6FF', borderRadius: 8, padding: 10, marginTop: 4 },
  previewLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  previewText: { fontSize: 12, color: '#1D4ED8', lineHeight: 18 },
});
