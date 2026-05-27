import api from './api';

export const proService = {
  getDashboard: () => api.get('/artisans/dashboard').then(r => r.data),
  toggleAvailability: (available: boolean) =>
    api.patch('/artisans/availability', { available_now: available }).then(r => r.data),
  submitBid: (jobId: string, price: number, note: string) =>
    api.post(`/bids/jobs/${jobId}`, { proposed_price: price, message: note }).then(r => r.data),
};
