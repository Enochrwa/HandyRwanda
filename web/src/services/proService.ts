// File: web/src/services/proService.ts
import api from "./api";

export const proService = {
  async getDashboard() {
    const res = await api.get("/artisans/dashboard");
    return res.data;
  },
  async toggleAvailability(available: boolean) {
    const res = await api.patch("/artisans/availability", { available_now: available });
    return res.data;
  },
  async submitBid(
    jobId: string,
    price: number,
    note: string,
    coverLetter?: string,
    estimatedHours?: number,
  ) {
    const res = await api.post(`/bids/jobs/${jobId}`, {
      proposed_price: price,
      message: note || undefined,
      cover_letter: coverLetter || undefined,
      estimated_duration_hours: estimatedHours || undefined,
    });
    return res.data;
  },
  async withdrawBid(bidId: string) {
    const res = await api.delete(`/bids/${bidId}`);
    return res.data;
  },
  async updateBid(bidId: string, price: number, note?: string) {
    const res = await api.patch(`/bids/${bidId}`, {
      proposed_price: price,
      message: note || undefined,
    });
    return res.data;
  },
};
