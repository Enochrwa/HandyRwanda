// File: mobile/src/hooks/usePreviousArtisans.ts
/**
 * Sprint 4 — Hook for fetching a client's previous artisans.
 *
 * Powers the "Book Again 🔄" horizontal scroll row on the home screen.
 * Returns a list of artisans the client has successfully worked with,
 * ordered by most recent, with `instant_book_eligible` flag for UI.
 */

import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import type { PreviousArtisan } from '../components/InstantBookSheet';

export function usePreviousArtisans(enabled: boolean) {
  return useQuery<PreviousArtisan[]>({
    queryKey: ['previous-artisans'],
    queryFn: () => api.get('/artisans/previous').then((r) => r.data),
    enabled,
    staleTime: 5 * 60 * 1000,   // 5 min — artisan availability can change
    gcTime: 10 * 60 * 1000,     // 10 min cache
    retry: 1,
  });
}
