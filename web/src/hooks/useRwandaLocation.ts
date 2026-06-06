/**
 * useRwandaLocation — offline-first Rwanda administrative hierarchy hook.
 *
 * Mirrors mobile/src/hooks/useRwandaLocation.ts exactly so web and mobile
 * share the same hook API. Data bundled in src/data/rwanda-addresses.ts.
 *
 * Full 5-level hierarchy: Province → District → Sector → Cell → Village[]
 *
 * API:
 *   getProvinces()
 *   getDistrictByProvince(province)
 *   getAllDistricts()
 *   getSectors(province, district)
 *   getCells(province, district, sector)
 *   getVillages(province, district, sector, cell)
 */

import { useCallback } from "react";
import RWANDA_ADDRESSES from "@/data/rwanda-addresses";

export interface RwandaLocationHook {
  loading: false;
  error: null;
  getProvinces: () => string[];
  getDistrictByProvince: (province: string) => string[];
  getAllDistricts: () => string[];
  getSectors: (province: string, district: string) => string[];
  getCells: (province: string, district: string, sector: string) => string[];
  getVillages: (province: string, district: string, sector: string, cell: string) => string[];
}

export function useRwandaLocation(): RwandaLocationHook {
  const getProvinces = useCallback((): string[] => {
    return Object.keys(RWANDA_ADDRESSES).sort();
  }, []);

  const getDistrictByProvince = useCallback((province: string): string[] => {
    return Object.keys(RWANDA_ADDRESSES[province] ?? {}).sort();
  }, []);

  const getAllDistricts = useCallback((): string[] => {
    const all = new Set<string>();
    for (const prov of Object.values(RWANDA_ADDRESSES)) {
      for (const dist of Object.keys(prov)) {
        all.add(dist);
      }
    }
    return [...all].sort();
  }, []);

  const getSectors = useCallback((province: string, district: string): string[] => {
    return Object.keys(RWANDA_ADDRESSES[province]?.[district] ?? {}).sort();
  }, []);

  const getCells = useCallback(
    (province: string, district: string, sector: string): string[] => {
      return Object.keys(RWANDA_ADDRESSES[province]?.[district]?.[sector] ?? {}).sort();
    },
    [],
  );

  const getVillages = useCallback(
    (province: string, district: string, sector: string, cell: string): string[] => {
      return [...(RWANDA_ADDRESSES[province]?.[district]?.[sector]?.[cell] ?? [])].sort();
    },
    [],
  );

  return {
    loading: false,
    error: null,
    getProvinces,
    getDistrictByProvince,
    getAllDistricts,
    getSectors,
    getCells,
    getVillages,
  };
}
