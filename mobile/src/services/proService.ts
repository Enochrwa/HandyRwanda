// File: mobile/src/services/proService.ts
import api from './api';

export const proService = {
  getDashboard: () => api.get('/artisans/dashboard').then((r) => r.data),
  toggleAvailability: (available: boolean) =>
    api.patch('/artisans/availability', { available_now: available }).then((r) => r.data),
  submitBid: (jobId: string, price: number, note: string, coverLetter?: string, estimatedHours?: number) =>
    api.post(`/bids/jobs/${jobId}`, {
      proposed_price: price,
      message: note || undefined,
      cover_letter: coverLetter || undefined,
      estimated_duration_hours: estimatedHours || undefined,
    }).then((r) => r.data),
  withdrawBid: (bidId: string) => api.delete(`/bids/${bidId}`).then((r) => r.data),
  updateBid: (bidId: string, price: number, note?: string) =>
    api.patch(`/bids/${bidId}`, { proposed_price: price, message: note || undefined }).then((r) => r.data),
  registerPushToken: (token: string) =>
    api.post('/artisans/push-token', { expo_push_token: token }).then((r) => r.data),
};
