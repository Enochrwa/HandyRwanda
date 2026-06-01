// File: mobile/src/services/proService.ts
import api from './api';

export const proService = {
  getDashboard: () => api.get('/artisans/dashboard').then((r) => r.data),

  toggleAvailability: (available: boolean) =>
    api.patch('/artisans/availability', { available_now: available }).then((r) => r.data),

  getAvailableJobs: () => api.get('/jobs/available').then((r) => r.data),

  submitBid: (
    jobId: string,
    price: number,
    note: string,
    estimatedHours?: number,
    proposedStartTime?: string,
  ) =>
    api
      .post(`/bids/jobs/${jobId}`, {
        proposed_price: price,
        message: note || undefined,
        estimated_duration_hours: estimatedHours ?? undefined,
        proposed_start_time: proposedStartTime ?? undefined,
      })
      .then((r) => r.data),

  withdrawBid: (bidId: string) => api.delete(`/bids/${bidId}`).then((r) => r.data),

  getMyBids: () => api.get('/bids/mine').then((r) => r.data),

  getMySkills: () => api.get('/artisans/skills/mine').then((r) => r.data),

  getMyPortfolio: () => api.get('/artisans/portfolio/me').then((r) => r.data),

  updateProfile: (data: Record<string, unknown>) =>
    api.patch('/artisans/profile', data).then((r) => r.data),
};
