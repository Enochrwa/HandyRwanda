/**
 * useRwandaLocation — offline-first Rwanda administrative hierarchy hook.
 *
 * Mirrors the web app's hook API exactly so components can be shared:
 *   getProvinces()
 *   getDistrictByProvince(province)
 *   getAllDistricts()
 *   getSectors(province, district)
 *   getCells(province, district, sector)
 *   getVillages(province, district, sector, cell)
 *
 * Data is bundled in src/data/rwanda-addresses.ts — no network needed.
 * This eliminates the per-keystroke API calls that were causing freezes
 * when combined with cascading state updates.
 */
import { useCallback } from 'react';

import RWANDA_ADDRESSES from '../data/rwanda-addresses';

export interface RwandaLocationHook {
  loading: false;
  error: null;
  getProvinces: () => string[];
  getDistrictByProvince: (province: string) => string[];
  getAllDistricts: () => string[];
  getSectors: (province: string, district: string) => string[];
  getCells: (province: string, district: string, sector: string) => string[];
  /** In the mobile data, cells and villages share the same leaf array. */
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

  const getCells = useCallback((province: string, district: string, sector: string): string[] => {
    return [...(RWANDA_ADDRESSES[province]?.[district]?.[sector] ?? [])].sort();
  }, []);

  /**
   * The bundled data stores cells at the sector level.
   * Villages are free-text in Rwanda's smallest unit; we return the same
   * array so callers that expect a village list still get something useful.
   * Users can always type a custom village into the free-text field.
   */
  const getVillages = useCallback(
    (province: string, district: string, sector: string, _cell: string): string[] => {
      return [...(RWANDA_ADDRESSES[province]?.[district]?.[sector] ?? [])].sort();
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
