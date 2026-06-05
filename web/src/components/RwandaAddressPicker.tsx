// File: web/src/components/RwandaAddressPicker.tsx
/**
 * Cascading Rwanda address picker: Province → District → Sector → Cell → Village → Street/Road.
 * Uses the /address/* API endpoints for dynamic loading.
 */
import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  required?: boolean;
}

export function RwandaAddressPicker({ value, onChange, required }: Props) {
  const [province, setProvince] = useState(value?.province ?? "");
  const [district, setDistrict] = useState(value?.district ?? "");
  const [sector, setSector] = useState(value?.sector ?? "");
  const [cell, setCell] = useState(value?.cell ?? "");
  const [village, setVillage] = useState(value?.village ?? "");
  const [streetRoad, setStreetRoad] = useState(value?.street_road ?? "");

  const { data: provinces } = useQuery<string[]>({
    queryKey: ["address-provinces"],
    queryFn: () => api.get("/address/provinces").then((r) => r.data.provinces),
    staleTime: Infinity,
  });

  const { data: districts } = useQuery<string[]>({
    queryKey: ["address-districts", province],
    queryFn: () =>
      api
        .get(`/address/districts?province=${encodeURIComponent(province)}`)
        .then((r) => r.data.districts),
    enabled: !!province,
    staleTime: Infinity,
  });

  const { data: sectors } = useQuery<string[]>({
    queryKey: ["address-sectors", province, district],
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
    queryKey: ["address-cells", province, district, sector],
    queryFn: () =>
      api
        .get(
          `/address/cells?province=${encodeURIComponent(province)}&district=${encodeURIComponent(district)}&sector=${encodeURIComponent(sector)}`,
        )
        .then((r) => r.data.cells),
    enabled: !!province && !!district && !!sector,
    staleTime: Infinity,
  });

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

  const notify = useCallback(
    (p: string, d: string, s: string, c: string, v: string, sr: string) => {
      if (!d) return;
      const parts = [sr, v, c, s, d, p, "Rwanda"].filter(Boolean);
      onChange({
        province: p,
        district: d,
        sector: s,
        cell: c,
        village: v,
        street_road: sr,
        formatted: parts.join(", "),
      });
    },
    [onChange],
  );

  useEffect(() => {
    notify(province, district, sector, cell, village, streetRoad);
  }, [province, district, sector, cell, village, streetRoad, notify]);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {/* Province */}
      <div className="space-y-1">
        <Label>Province {required && <span className="text-destructive">*</span>}</Label>
        <Select value={province} onValueChange={handleProvince}>
          <SelectTrigger>
            <SelectValue placeholder="Select province" />
          </SelectTrigger>
          <SelectContent>
            {(provinces ?? []).map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* District */}
      <div className="space-y-1">
        <Label>District {required && <span className="text-destructive">*</span>}</Label>
        <Select value={district} onValueChange={handleDistrict} disabled={!province}>
          <SelectTrigger>
            <SelectValue placeholder={province ? "Select district" : "Select province first"} />
          </SelectTrigger>
          <SelectContent>
            {(districts ?? []).map((d) => (
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
            <SelectValue placeholder={district ? "Select sector" : "Select district first"} />
          </SelectTrigger>
          <SelectContent>
            {(sectors ?? []).map((s) => (
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
            <SelectValue placeholder={sector ? "Select cell" : "Select sector first"} />
          </SelectTrigger>
          <SelectContent>
            {(cells ?? []).map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Village */}
      <div className="space-y-1">
        <Label>Village</Label>
        <Input
          placeholder="Village name (optional)"
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

      {/* Preview */}
      {district && (
        <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground sm:col-span-2">
          {"📍 "}
          {[streetRoad, village, cell, sector, district, province, "Rwanda"]
            .filter(Boolean)
            .join(", ")}
        </div>
      )}
    </div>
  );
}
