// File: web/src/components/RwandaAddressPicker.tsx
/**
 * Cascading Rwanda address picker:
 *   Province → District → Sector → Cell → Village (free-text)
 *   → Street/Road → House/Plot Number → Landmark
 *
 * Features:
 *  - Offline-first: uses bundled RWANDA_ADDRESSES — zero API calls for hierarchy
 *  - Interactive Leaflet map (react-leaflet + OSM tiles): click or drag pin
 *  - Reverse-geocode via OSM Nominatim on pin drop
 *  - House number & landmark fields for door-step precision
 *  - Emits full RwandaAddress (with lat/lng) via onChange
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import RWANDA_ADDRESSES from "@/data/rwanda-addresses";

// Fix Leaflet default icon paths
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RwandaAddress {
  province: string;
  district: string;
  sector: string;
  cell: string;
  village: string;
  street_road: string;
  house_number: string;
  landmark: string;
  latitude: number;
  longitude: number;
  formatted: string;
}

interface Props {
  value?: Partial<RwandaAddress>;
  onChange: (addr: RwandaAddress) => void;
  required?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Offline hierarchy helpers
// ─────────────────────────────────────────────────────────────────────────────

const getProvinces = (): string[] => Object.keys(RWANDA_ADDRESSES).sort();
const getDistricts = (province: string): string[] =>
  Object.keys(RWANDA_ADDRESSES[province] ?? {}).sort();
const getSectors = (province: string, district: string): string[] =>
  Object.keys(RWANDA_ADDRESSES[province]?.[district] ?? {}).sort();
const getCells = (province: string, district: string, sector: string): string[] =>
  [...(RWANDA_ADDRESSES[province]?.[district]?.[sector] ?? [])].sort();

// ─────────────────────────────────────────────────────────────────────────────
// District centre coordinates for map auto-zoom
// ─────────────────────────────────────────────────────────────────────────────

const DISTRICT_CENTRES: Record<string, [number, number]> = {
  Gasabo: [-1.8845, 30.1167],
  Kicukiro: [-1.9769, 30.0985],
  Nyarugenge: [-1.95, 30.0588],
  Bugesera: [-2.2024, 30.1676],
  Gatsibo: [-1.576, 30.4602],
  Kayonza: [-1.88, 30.6474],
  Kirehe: [-2.169, 30.6748],
  Ngoma: [-2.1583, 30.4386],
  Nyagatare: [-1.2985, 30.3263],
  Rwamagana: [-1.9487, 30.4345],
  Burera: [-1.4801, 29.8511],
  Gakenke: [-1.6905, 29.7832],
  Gicumbi: [-1.5725, 30.0621],
  Musanze: [-1.4991, 29.6346],
  Rulindo: [-1.7194, 30.0332],
  Gisagara: [-2.6095, 29.827],
  Huye: [-2.5967, 29.7397],
  Kamonyi: [-2.0278, 29.88],
  Muhanga: [-2.0833, 29.756],
  Nyamagabe: [-2.4545, 29.4872],
  Nyanza: [-2.3571, 29.7527],
  Nyaruguru: [-2.7316, 29.5441],
  Ruhango: [-2.2179, 29.7906],
  Karongi: [-2.1556, 29.367],
  Ngororero: [-1.8617, 29.5636],
  Nyabihu: [-1.6571, 29.5014],
  Nyamasheke: [-2.336, 29.1349],
  Rubavu: [-1.6812, 29.35],
  Rusizi: [-2.4824, 28.907],
  Rutsiro: [-1.9365, 29.4303],
};

const KIGALI: [number, number] = [-1.9441, 30.0619];

// ─────────────────────────────────────────────────────────────────────────────
// Format address label
// ─────────────────────────────────────────────────────────────────────────────

function buildFormatted(f: {
  house_number: string;
  street_road: string;
  landmark: string;
  village: string;
  cell: string;
  sector: string;
  district: string;
  province: string;
}): string {
  return [
    f.house_number,
    f.street_road,
    f.landmark ? `Near ${f.landmark}` : "",
    f.village,
    f.cell,
    f.sector,
    f.district,
    f.province,
    "Rwanda",
  ]
    .filter(Boolean)
    .join(", ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Nominatim reverse geocode
// ─────────────────────────────────────────────────────────────────────────────

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  neighbourhood?: string;
  suburb?: string;
  county?: string;
  state?: string;
  country?: string;
  house_number?: string;
}

async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<{ address: NominatimAddress } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { "Accept-Language": "en", "User-Agent": "HandyRwanda/1.0" } },
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner map component (must live inside <MapContainer>)
// ─────────────────────────────────────────────────────────────────────────────

function DraggableMarker({
  position,
  onMove,
}: {
  position: [number, number];
  onMove: (lat: number, lng: number) => void;
}) {
  // Click anywhere on the map to move pin
  useMapEvents({
    click(e) {
      onMove(e.latlng.lat, e.latlng.lng);
    },
  });

  return (
    <Marker
      position={position}
      draggable
      eventHandlers={{
        dragend(e) {
          const { lat, lng } = (e.target as L.Marker).getLatLng();
          onMove(lat, lng);
        },
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MapView wrapper — re-centres when centre prop changes
// ─────────────────────────────────────────────────────────────────────────────

function MapRecenter({ centre }: { centre: [number, number] }) {
  const map = useMapEvents({});
  const prevCentreRef = useRef<[number, number]>(centre);
  useEffect(() => {
    if (
      prevCentreRef.current[0] !== centre[0] ||
      prevCentreRef.current[1] !== centre[1]
    ) {
      prevCentreRef.current = centre;
      map.flyTo(centre, Math.max(map.getZoom(), 13), { duration: 0.8 });
    }
  }, [centre, map]);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function RwandaAddressPicker({ value, onChange, required }: Props) {
  const [province, setProvince] = useState(value?.province ?? "Kigali City");
  const [district, setDistrict] = useState(value?.district ?? "Gasabo");
  const [sector, setSector] = useState(value?.sector ?? "");
  const [cell, setCell] = useState(value?.cell ?? "");
  const [village, setVillage] = useState(value?.village ?? "");
  const [streetRoad, setStreetRoad] = useState(value?.street_road ?? "");
  const [houseNumber, setHouseNumber] = useState(value?.house_number ?? "");
  const [landmark, setLandmark] = useState(value?.landmark ?? "");

  // GPS pin state
  const initCentre = DISTRICT_CENTRES["Gasabo"] ?? KIGALI;
  const [pinPos, setPinPos] = useState<[number, number]>([
    value?.latitude ?? initCentre[0],
    value?.longitude ?? initCentre[1],
  ]);
  const [mapCentre, setMapCentre] = useState<[number, number]>(pinPos);
  const [geocoding, setGeocoding] = useState(false);

  // Derived lists
  const provinces = getProvinces();
  const districts = getDistricts(province);
  const sectors = getSectors(province, district);
  const cells = getCells(province, district, sector);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Notify parent whenever any field changes
  const notify = useCallback(
    (
      prov: string,
      dist: string,
      sec: string,
      cel: string,
      vil: string,
      sr: string,
      hn: string,
      lm: string,
      lat: number,
      lng: number,
    ) => {
      if (!dist) return;
      onChangeRef.current({
        province: prov,
        district: dist,
        sector: sec,
        cell: cel,
        village: vil,
        street_road: sr,
        house_number: hn,
        landmark: lm,
        latitude: lat,
        longitude: lng,
        formatted: buildFormatted({
          house_number: hn,
          street_road: sr,
          landmark: lm,
          village: vil,
          cell: cel,
          sector: sec,
          district: dist,
          province: prov,
        }),
      });
    },
    [],
  );

  useEffect(() => {
    notify(
      province, district, sector, cell, village,
      streetRoad, houseNumber, landmark,
      pinPos[0], pinPos[1],
    );
  }, [province, district, sector, cell, village, streetRoad, houseNumber, landmark, pinPos, notify]);

  // Auto-zoom when district changes
  const prevDistrictRef = useRef(district);
  useEffect(() => {
    if (district === prevDistrictRef.current) return;
    prevDistrictRef.current = district;
    const centre = DISTRICT_CENTRES[district];
    if (centre) {
      setPinPos(centre);
      setMapCentre(centre);
    }
  }, [district]);

  // Handle map pin drop → reverse-geocode
  const handlePinMove = useCallback(async (lat: number, lng: number) => {
    setPinPos([lat, lng]);
    setGeocoding(true);
    try {
      const result = await reverseGeocode(lat, lng);
      if (!result?.address) return;
      const addr = result.address;

      // Fill street
      const detectedRoad = addr.road ?? addr.pedestrian ?? addr.neighbourhood ?? "";
      if (detectedRoad) setStreetRoad(detectedRoad);

      // Fill house number
      if (addr.house_number) setHouseNumber(addr.house_number);

      // Try to match a district from Nominatim county/suburb
      const returnedCounty = addr.county ?? addr.suburb ?? "";
      if (returnedCounty) {
        const allDistricts = Object.entries(RWANDA_ADDRESSES).flatMap(([p, dm]) =>
          Object.keys(dm).map((d) => ({ province: p, district: d })),
        );
        const match = allDistricts.find(
          ({ district: d }) =>
            d.toLowerCase() === returnedCounty.toLowerCase() ||
            returnedCounty.toLowerCase().includes(d.toLowerCase()),
        );
        if (match) {
          setProvince(match.province);
          setDistrict(match.district);
          setSector("");
          setCell("");
          setVillage("");
        }
      }
    } finally {
      setGeocoding(false);
    }
  }, []);

  // Cascade resets
  const handleProvince = (val: string) => {
    setProvince(val);
    setDistrict("");
    setSector("");
    setCell("");
    setVillage("");
  };
  const handleDistrict = (val: string) => {
    setDistrict(val);
    setSector("");
    setCell("");
    setVillage("");
  };
  const handleSector = (val: string) => {
    setSector(val);
    setCell("");
    setVillage("");
  };
  const handleCell = (val: string) => {
    setCell(val);
    setVillage("");
  };

  return (
    <div className="space-y-4">
      {/* ── Map ── */}
      <div className="relative">
        <div
          className="w-full rounded-xl overflow-hidden border border-border"
          style={{ height: 240 }}
        >
          <MapContainer
            center={mapCentre}
            zoom={13}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap contributors"
              maxZoom={19}
            />
            <DraggableMarker position={pinPos} onMove={handlePinMove} />
            <MapRecenter centre={mapCentre} />
          </MapContainer>
        </div>

        {/* Hint overlay */}
        <div className="absolute top-2 left-2 z-[999] pointer-events-none">
          <div className="bg-white/90 backdrop-blur-sm text-xs text-muted-foreground rounded-lg px-3 py-1.5 border border-border">
            📍 Click map or drag pin to set exact location
          </div>
        </div>

        {geocoding && (
          <div className="absolute bottom-2 right-2 z-[999]">
            <div className="bg-white/90 backdrop-blur-sm text-xs text-muted-foreground rounded-lg px-3 py-1.5 border border-border animate-pulse">
              Detecting address…
            </div>
          </div>
        )}
      </div>

      {/* GPS coords */}
      <p className="text-[11px] font-mono text-muted-foreground">
        📍 {pinPos[0].toFixed(5)}, {pinPos[1].toFixed(5)}
      </p>

      {/* ── Cascade selects ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Province */}
        <div className="space-y-1">
          <Label>
            Province {required && <span className="text-destructive">*</span>}
          </Label>
          <Select value={province} onValueChange={handleProvince}>
            <SelectTrigger>
              <SelectValue placeholder="Select province" />
            </SelectTrigger>
            <SelectContent>
              {provinces.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* District */}
        <div className="space-y-1">
          <Label>
            District {required && <span className="text-destructive">*</span>}
          </Label>
          <Select value={district} onValueChange={handleDistrict} disabled={!province}>
            <SelectTrigger>
              <SelectValue
                placeholder={province ? "Select district" : "Select province first"}
              />
            </SelectTrigger>
            <SelectContent>
              {districts.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sector */}
        <div className="space-y-1">
          <Label>Sector</Label>
          <Select value={sector} onValueChange={handleSector} disabled={!district}>
            <SelectTrigger>
              <SelectValue
                placeholder={district ? "Select sector" : "Select district first"}
              />
            </SelectTrigger>
            <SelectContent>
              {sectors.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Cell */}
        <div className="space-y-1">
          <Label>Cell</Label>
          <Select value={cell} onValueChange={handleCell} disabled={!sector}>
            <SelectTrigger>
              <SelectValue
                placeholder={sector ? "Select cell" : "Select sector first"}
              />
            </SelectTrigger>
            <SelectContent>
              {cells.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Village — free text */}
        <div className="space-y-1">
          <Label>Village</Label>
          <Input
            placeholder="Village name (e.g. Kimisagara)"
            value={village}
            onChange={(e) => setVillage(e.target.value)}
          />
        </div>

        {/* Street / Road */}
        <div className="space-y-1">
          <Label>Street / Road</Label>
          <Input
            placeholder="e.g. KG 7 Ave, KN 3 Rd"
            value={streetRoad}
            onChange={(e) => setStreetRoad(e.target.value)}
          />
        </div>

        {/* House / Plot Number */}
        <div className="space-y-1">
          <Label>House / Plot Number</Label>
          <Input
            placeholder="e.g. No. 14, Plot 7B, Apt 3F"
            value={houseNumber}
            onChange={(e) => setHouseNumber(e.target.value)}
          />
          <p className="text-[10px] text-muted-foreground">
            Helps artisan find the exact door
          </p>
        </div>

        {/* Landmark */}
        <div className="space-y-1">
          <Label>Nearby Landmark</Label>
          <Input
            placeholder="e.g. Near Total petrol station, opposite MTN"
            value={landmark}
            onChange={(e) => setLandmark(e.target.value)}
          />
          <p className="text-[10px] text-muted-foreground">
            A well-known reference point near your location
          </p>
        </div>
      </div>

      {/* Full address preview */}
      {district && (
        <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2.5">
          <p className="text-[10px] font-bold text-primary uppercase tracking-wide mb-0.5">
            Full Address Preview
          </p>
          <p className="text-sm text-foreground">
            {buildFormatted({
              house_number: houseNumber,
              street_road: streetRoad,
              landmark,
              village,
              cell,
              sector,
              district,
              province,
            })}
          </p>
        </div>
      )}
    </div>
  );
}
