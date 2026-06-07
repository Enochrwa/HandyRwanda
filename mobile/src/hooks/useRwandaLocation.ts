/**
 * useRwandaLocation — offline-first Rwanda administrative hierarchy hook.
 *
 * Full 5-level hierarchy: Province → District → Sector → Cell → Village[]
 * Data is bundled in src/data/rwanda-addresses.ts — no network needed.
 *
 * FIX: The 11575-line rwanda-addresses.ts file was being parsed synchronously
 * on every render, which was blocking the JS thread and causing the "app not
 * responding" ANR on the location setup screen.
 *
 * Solution: load the data lazily via InteractionManager.runAfterInteractions
 * so parsing happens after the UI has rendered, keeping the main thread free.
 *
 * API:
 *   loading: boolean — true while data is loading
 *   getProvinces()
 *   getDistrictByProvince(province)
 *   getAllDistricts()
 *   getSectors(province, district)
 *   getCells(province, district, sector)
 *   getVillages(province, district, sector, cell)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';

import type { RwandaData } from '../data/rwanda-addresses';

// Module-level singleton so we only parse the file once across all renders
let cachedData: RwandaData | null = null;
let loadCallbacks: Array<() => void> = [];
let isLoading = false;

function ensureDataLoaded(onLoaded: () => void) {
  if (cachedData) {
    onLoaded();
    return;
  }
  loadCallbacks.push(onLoaded);
  if (isLoading) return;

  isLoading = true;
  // Defer heavy parse until after interactions (UI rendering) complete
  InteractionManager.runAfterInteractions(() => {
    // Dynamic require runs synchronously but deferred — off the critical path
    const mod = require('../data/rwanda-addresses') as { default: RwandaData };
    cachedData = mod.default;
    isLoading = false;
    const cbs = loadCallbacks.slice();
    loadCallbacks = [];
    cbs.forEach((cb) => cb());
  });
}

export interface RwandaLocationHook {
  loading: boolean;
  error: null;
  getProvinces: () => string[];
  getDistrictByProvince: (province: string) => string[];
  getAllDistricts: () => string[];
  getSectors: (province: string, district: string) => string[];
  getCells: (province: string, district: string, sector: string) => string[];
  getVillages: (province: string, district: string, sector: string, cell: string) => string[];
}

export function useRwandaLocation(): RwandaLocationHook {
  const [loaded, setLoaded] = useState(cachedData !== null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!cachedData) {
      ensureDataLoaded(() => {
        if (mountedRef.current) setLoaded(true);
      });
    }
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const getData = (): RwandaData => cachedData ?? {};

  const getProvinces = useCallback((): string[] => {
    return Object.keys(getData()).sort();
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const getDistrictByProvince = useCallback(
    (province: string): string[] => {
      return Object.keys(getData()[province] ?? {}).sort();
    },
    [loaded], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const getAllDistricts = useCallback((): string[] => {
    const all = new Set<string>();
    for (const prov of Object.values(getData())) {
      for (const dist of Object.keys(prov)) {
        all.add(dist);
      }
    }
    return [...all].sort();
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const getSectors = useCallback(
    (province: string, district: string): string[] => {
      return Object.keys(getData()[province]?.[district] ?? {}).sort();
    },
    [loaded], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const getCells = useCallback(
    (province: string, district: string, sector: string): string[] => {
      return Object.keys(getData()[province]?.[district]?.[sector] ?? {}).sort();
    },
    [loaded], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const getVillages = useCallback(
    (province: string, district: string, sector: string, cell: string): string[] => {
      return [...(getData()[province]?.[district]?.[sector]?.[cell] ?? [])].sort();
    },
    [loaded], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return {
    loading: !loaded,
    error: null,
    getProvinces,
    getDistrictByProvince,
    getAllDistricts,
    getSectors,
    getCells,
    getVillages,
  };
}
