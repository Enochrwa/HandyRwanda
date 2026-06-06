/**
 * LocationPicker — universal map + address picker for HandyRwanda.
 *
 * Features:
 *  • Interactive MapView (OSM tiles, tap-to-pin, GPS detect)
 *  • OSM Nominatim reverse-geocode on pin drop → auto-fills address fields
 *  • Rwanda mode: cascading Province→District→Sector→Cell dropdowns (offline, no API)
 *  • International mode: free-text country / city / street (when outside Rwanda)
 *  • Street / Road free-text for both modes
 *  • Zero re-render-loop bugs:
 *      - MapView is driven imperatively via animateToRegion (no `region` prop)
 *      - onChange wrapped in ref so stable callbacks never re-trigger effects
 *
 * Usage:
 *   <LocationPicker
 *     initialCoords={{ latitude: -1.9441, longitude: 30.0619 }}
 *     onChange={(result) => console.log(result)}
 *   />
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
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';

import { useRwandaLocation } from '../hooks/useRwandaLocation';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface LocationResult {
  latitude: number;
  longitude: number;
  /** Human-readable full address string */
  formatted: string;
  /** Rwanda-specific structured fields (undefined for international addresses) */
  rwanda?: {
    province: string;
    district: string;
    sector: string;
    cell: string;
    village: string;
    street_road: string;
    house_number: string;
    landmark: string;
  };
  /** Fields present for all locations */
  country: string;
  city: string;
  streetRoad: string;
  houseNumber: string;
  landmark: string;
}

interface Props {
  initialCoords?: { latitude: number; longitude: number };
  onChange: (result: LocationResult) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const KIGALI = { latitude: -1.9441, longitude: 30.0619 };

/** Approximate district centres for auto-zoom when user picks a district */
const DISTRICT_CENTRES: Record<string, { latitude: number; longitude: number }> = {
  Gasabo: { latitude: -1.8845, longitude: 30.1167 },
  Kicukiro: { latitude: -1.9769, longitude: 30.0985 },
  Nyarugenge: { latitude: -1.95, longitude: 30.0588 },
  Musanze: { latitude: -1.4991, longitude: 29.6346 },
  Rubavu: { latitude: -1.6812, longitude: 29.35 },
  Nyagatare: { latitude: -1.2985, longitude: 30.3263 },
  Rwamagana: { latitude: -1.9487, longitude: 30.4334 },
  Bugesera: { latitude: -2.1667, longitude: 30.1167 },
  Muhanga: { latitude: -2.0833, longitude: 29.75 },
  Huye: { latitude: -2.6, longitude: 29.75 },
};

// ─────────────────────────────────────────────────────────────────────────────
// Reverse-geocode via OSM Nominatim (free, no key required)
// ─────────────────────────────────────────────────────────────────────────────

interface NominatimResult {
  display_name: string;
  address?: {
    country?: string;
    state?: string; // Province equivalent in some countries
    county?: string; // District equivalent
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    road?: string;
    pedestrian?: string;
    neighbourhood?: string;
  };
}

async function reverseGeocode(lat: number, lon: number): Promise<NominatimResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'HandyRwanda/1.0' },
    });
    if (!res.ok) return null;
    return (await res.json()) as NominatimResult;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function LocationPicker({ initialCoords, onChange }: Props) {
  const mapRef = useRef<MapView>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const rwandaHook = useRwandaLocation();

  const [coords, setCoords] = useState(initialCoords ?? KIGALI);
  const [geocoding, setGeocoding] = useState(false);

  // Mode
  const [isRwanda, setIsRwanda] = useState(true);

  // Rwanda fields
  const [province, setProvince] = useState('Kigali City');
  const [district, setDistrict] = useState('Gasabo');
  const [sector, setSector] = useState('');
  const [cell, setCell] = useState('');
  const [village, setVillage] = useState('');

  // Shared fields
  const [country, setCountry] = useState('Rwanda');
  const [city, setCity] = useState('');
  const [streetRoad, setStreetRoad] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [landmark, setLandmark] = useState('');

  // Track previous district for zoom — avoids needing district in effect deps
  const prevDistrictRef = useRef('');

  // Derived dropdown lists from offline data
  const provinces = rwandaHook.getProvinces();
  const districts = province ? rwandaHook.getDistrictByProvince(province) : [];
  const sectors = district ? rwandaHook.getSectors(province, district) : [];
  const cells = sector ? rwandaHook.getCells(province, district, sector) : [];

  // ── Notify parent (stable: uses ref so never causes child re-renders) ─────
  const notify = useCallback(
    (
      lat: number,
      lon: number,
      prov: string,
      dist: string,
      sec: string,
      cel: string,
      vil: string,
      ctry: string,
      cty: string,
      sr: string,
      hn: string,
      lm: string,
      rw: boolean,
    ) => {
      const parts: string[] = [];
      if (hn) parts.push(hn);
      if (sr) parts.push(sr);
      if (lm) parts.push(`Near ${lm}`);
      if (rw) {
        if (vil) parts.push(vil);
        if (cel) parts.push(cel);
        if (sec) parts.push(sec);
        if (dist) parts.push(dist);
        if (prov) parts.push(prov);
      } else {
        if (cty) parts.push(cty);
        if (ctry) parts.push(ctry);
      }
      if (!parts.length) parts.push('Rwanda');

      const result: LocationResult = {
        latitude: lat,
        longitude: lon,
        formatted: parts.join(', '),
        country: ctry,
        city: cty,
        streetRoad: sr,
        houseNumber: hn,
        landmark: lm,
        ...(rw && dist
          ? {
              rwanda: {
                province: prov,
                district: dist,
                sector: sec,
                cell: cel,
                village: vil,
                street_road: sr,
                house_number: hn,
                landmark: lm,
              },
            }
          : {}),
      };
      onChangeRef.current(result);
    },
    [],
  );

  // Notify whenever any field changes
  useEffect(() => {
    notify(
      coords.latitude,
      coords.longitude,
      province,
      district,
      sector,
      cell,
      village,
      country,
      city,
      streetRoad,
      houseNumber,
      landmark,
      isRwanda,
    );
  }, [
    coords,
    province,
    district,
    sector,
    cell,
    village,
    country,
    city,
    streetRoad,
    houseNumber,
    landmark,
    isRwanda,
    notify,
  ]);

  // ── Zoom map when district changes ────────────────────────────────────────
  useEffect(() => {
    if (!district || district === prevDistrictRef.current) return;
    prevDistrictRef.current = district;
    const centre = DISTRICT_CENTRES[district];
    if (centre) {
      setCoords(centre);
      mapRef.current?.animateToRegion(
        { ...centre, latitudeDelta: 0.06, longitudeDelta: 0.06 },
        600,
      );
    }
  }, [district]);

  // Keep a stable ref to the hook so reverseGeocodeCoords deps stay empty
  const rwandaHookRef = useRef(rwandaHook);
  useEffect(() => {
    rwandaHookRef.current = rwandaHook;
  });

  // ── Reverse-geocode when pin moves ────────────────────────────────────────
  // IMPORTANT: empty dep array → stable callback → no re-render loops.
  // Reads hook methods via ref so we always have the latest version.
  const reverseGeocodeCoords = useCallback(
    async (lat: number, lon: number) => {
      setGeocoding(true);
      try {
        const result = await reverseGeocode(lat, lon);
        if (!result) return;

        const addr = result.address ?? {};
        const detectedCountry = addr.country ?? '';
        const rwandaDetected = detectedCountry.toLowerCase().includes('rwanda');

        setIsRwanda(rwandaDetected);
        setCountry(detectedCountry || 'Rwanda');
        setCity(addr.city ?? addr.town ?? addr.suburb ?? addr.village ?? '');
        const detectedRoad = addr.road ?? addr.pedestrian ?? addr.neighbourhood ?? '';
        if (detectedRoad) setStreetRoad(detectedRoad);
        const hn = (addr as Record<string, string>).house_number;
        if (hn) setHouseNumber(hn);

        if (rwandaDetected) {
          // Try to match returned state/county to our Rwanda data
          const returnedDistrict = addr.county ?? addr.suburb ?? '';
          const hook = rwandaHookRef.current;
          const allProvinces = hook.getProvinces();
          const matchedProvince = allProvinces.find((p) =>
            p.toLowerCase().includes((addr.state ?? '').toLowerCase()),
          );
          const matchedDistrict = hook
            .getAllDistricts()
            .find(
              (d) =>
                d.toLowerCase() === returnedDistrict.toLowerCase() ||
                returnedDistrict.toLowerCase().includes(d.toLowerCase()),
            );
          if (matchedProvince) setProvince(matchedProvince);
          if (matchedDistrict) setDistrict(matchedDistrict);
        }
      } catch {
        // Silently ignore geocoding errors — user can fill manually
      } finally {
        setGeocoding(false);
      }
    },
    [], // stable — reads hook methods via rwandaHookRef
  );

  // ── Handle map tap ────────────────────────────────────────────────────────
  // Guard: ignore taps while a geocode is already in flight to prevent stacking
  const geocodingRef = useRef(false);
  const handleMapPress = useCallback(
    (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
      if (geocodingRef.current) return; // drop tap if already geocoding
      const newCoords = e.nativeEvent.coordinate;
      setCoords(newCoords);
      geocodingRef.current = true;
      reverseGeocodeCoords(newCoords.latitude, newCoords.longitude).finally(() => {
        geocodingRef.current = false;
      });
    },
    [reverseGeocodeCoords],
  );

  // ── Rwanda cascade helpers ────────────────────────────────────────────────
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

  const pickerItemStyle = Platform.OS === 'ios' ? { color: '#111827' } : undefined;

  return (
    <View style={styles.root}>
      {/* ── Map ── */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{ ...KIGALI, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
          onPress={handleMapPress}
          accessibilityLabel="Tap to pin the exact job location"
        >
          <UrlTile
            urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maximumZ={19}
            flipY={false}
          />
          <Marker coordinate={coords} title="Job location" pinColor="#1B5E3B" />
        </MapView>

        {/* Hint overlay */}
        <View style={styles.mapHint}>
          <Text style={styles.mapHintText}>📍 Tap the map to pin the exact spot</Text>
        </View>

        {/* Geocoding spinner */}
        {geocoding && (
          <View style={styles.geocodingOverlay}>
            <ActivityIndicator color="#1B5E3B" size="small" />
            <Text style={styles.geocodingText}>Detecting address…</Text>
          </View>
        )}
      </View>

      {/* ── Address form ── */}
      <ScrollView
        style={styles.form}
        contentContainerStyle={styles.formContent}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {/* Mode toggle */}
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeBtn, isRwanda && styles.modeBtnActive]}
            onPress={() => setIsRwanda(true)}
          >
            <Text style={[styles.modeBtnText, isRwanda && styles.modeBtnTextActive]}>
              🇷🇼 Rwanda
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, !isRwanda && styles.modeBtnActive]}
            onPress={() => setIsRwanda(false)}
          >
            <Text style={[styles.modeBtnText, !isRwanda && styles.modeBtnTextActive]}>
              🌍 International
            </Text>
          </TouchableOpacity>
        </View>

        {isRwanda ? (
          <>
            {/* Province */}
            <PickerRow
              label="Province *"
              value={province}
              items={provinces}
              pickerItemStyle={pickerItemStyle}
              onValueChange={onProvinceChange}
            />

            {/* District */}
            <PickerRow
              label="District *"
              value={district}
              items={districts}
              pickerItemStyle={pickerItemStyle}
              onValueChange={onDistrictChange}
              disabled={!province}
            />

            {/* Sector */}
            {district ? (
              <PickerRow
                label="Sector"
                value={sector}
                items={sectors}
                pickerItemStyle={pickerItemStyle}
                onValueChange={onSectorChange}
              />
            ) : null}

            {/* Cell */}
            {sector ? (
              <PickerRow
                label="Cell"
                value={cell}
                items={cells}
                pickerItemStyle={pickerItemStyle}
                onValueChange={onCellChange}
              />
            ) : null}

            {/* Village — dropdown from offline data */}
            {cell ? (
              <PickerRow
                label="Village"
                value={village}
                items={rwandaHookRef.current.getVillages(province, district, sector, cell)}
                pickerItemStyle={pickerItemStyle}
                onValueChange={setVillage}
              />
            ) : null}
          </>
        ) : (
          <>
            {/* International: country + city */}
            <View style={styles.field}>
              <Text style={styles.label}>Country *</Text>
              <TextInput
                style={styles.input}
                value={country}
                onChangeText={setCountry}
                placeholder="e.g. Uganda"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>City / Town</Text>
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={setCity}
                placeholder="e.g. Kampala"
              />
            </View>
          </>
        )}

        {/* Street / Road — always visible */}
        <View style={styles.field}>
          <Text style={styles.label}>Street / Road</Text>
          <TextInput
            style={styles.input}
            value={streetRoad}
            onChangeText={setStreetRoad}
            placeholder="e.g. KG 7 Ave, KN 3 Rd"
          />
        </View>

        {/* House / Plot Number */}
        <View style={styles.field}>
          <Text style={styles.label}>House / Plot Number</Text>
          <TextInput
            style={styles.input}
            value={houseNumber}
            onChangeText={setHouseNumber}
            placeholder="e.g. No. 14, Plot 7B, Apt 3F"
          />
          <Text style={styles.hint}>Helps artisan find the exact door</Text>
        </View>

        {/* Landmark */}
        <View style={styles.field}>
          <Text style={styles.label}>Nearby Landmark</Text>
          <TextInput
            style={[styles.input, { minHeight: 44 }]}
            value={landmark}
            onChangeText={setLandmark}
            placeholder="e.g. Near Total petrol station, opposite MTN"
            multiline
          />
          <Text style={styles.hint}>A reference point near your location</Text>
        </View>

        {/* Coordinates display */}
        <View style={styles.coordsRow}>
          <Text style={styles.coordsText}>
            📍 {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
          </Text>
        </View>

        {/* Formatted preview */}
        {(isRwanda ? !!district : !!country) ? (
          <View style={styles.preview}>
            <Text style={styles.previewLabel}>Full address</Text>
            <Text style={styles.previewText}>
              {[
                houseNumber,
                streetRoad,
                landmark ? `Near ${landmark}` : '',
                ...(isRwanda ? [village, cell, sector, district, province] : [city, country]),
              ]
                .filter(Boolean)
                .join(', ')}
              {isRwanda ? ', Rwanda' : ''}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PickerRow sub-component
// ─────────────────────────────────────────────────────────────────────────────

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
      <View style={[styles.pickerWrapper, disabled && styles.dimmedBorder]}>
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

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Map
  mapContainer: { height: 220, position: 'relative' },
  map: { flex: 1 },
  mapHint: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  mapHintText: { fontSize: 11, color: '#6B7280', textAlign: 'center', fontWeight: '500' },
  geocodingOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  geocodingText: { fontSize: 11, color: '#6B7280' },

  // Form
  form: { flexGrow: 0 },
  formContent: { gap: 12, paddingTop: 16 },

  // Mode toggle
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  modeBtnActive: {
    backgroundColor: '#1B5E3B',
    borderColor: '#1B5E3B',
  },
  modeBtnText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  modeBtnTextActive: { color: '#fff' },

  // Fields
  field: { gap: 4 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  hint: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  dimmed: { opacity: 0.45 },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F9FAFB',
  },
  dimmedBorder: { opacity: 0.45 },
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

  // GPS coords
  coordsRow: {
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  coordsText: {
    fontSize: 11,
    color: '#166534',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Preview
  preview: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 12,
    gap: 2,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  previewLabel: { fontSize: 10, fontWeight: '700', color: '#1D4ED8', textTransform: 'uppercase' },
  previewText: { fontSize: 12, color: '#1E40AF', lineHeight: 18 },
});
