/**
 * RwandaAddressPicker — offline-first cascading address picker.
 *
 * Full 5-level cascade: Province → District → Sector → Cell → Village (all dropdowns)
 * → Street/Road → House/Plot Number → Landmark
 *
 * Data comes from the bundled RWANDA_ADDRESSES (src/data/rwanda-addresses.ts).
 * No API calls. No re-render loops.
 */
import { Picker } from '@react-native-picker/picker';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

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

  const { loading, getProvinces, getDistrictByProvince, getSectors, getCells, getVillages } =
    useRwandaLocation();

  // All computed synchronously — no async, no re-renders from data loading
  const provinces = loading ? [] : getProvinces();
  const districts = !loading && province ? getDistrictByProvince(province) : [];
  const sectors = !loading && district ? getSectors(province, district) : [];
  const cells = !loading && sector ? getCells(province, district, sector) : [];
  const villages = !loading && cell ? getVillages(province, district, sector, cell) : [];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#1B5E3B" />
        <Text style={styles.loadingText}>Loading address data…</Text>
      </View>
    );
  }

  const pickerItemStyle = Platform.OS === 'ios' ? { color: '#111827' } : undefined;

  // Stable notify — reads onChange via ref
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

  const onCellChange = useCallback((v: string) => {
    setCell(v);
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
          onValueChange={onCellChange}
        />
      ) : null}
      {cell ? (
        <PickerRow
          label="Village"
          value={village}
          items={villages}
          pickerItemStyle={pickerItemStyle}
          onValueChange={setVillage}
        />
      ) : null}

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
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    justifyContent: 'center',
  },
  loadingText: { fontSize: 13, color: '#6B7280' },
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
