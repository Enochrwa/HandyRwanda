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
  async getAvailableJobs() {
    const res = await api.get("/jobs/available");
    return res.data;
  },
  async submitBid(
    jobId: string,
    price: number,
    note: string,
    estimatedHours?: number,
    proposedStartTime?: string,
  ) {
    const res = await api.post(`/bids/jobs/${jobId}`, {
      proposed_price: price,
      message: note || undefined,
      estimated_duration_hours: estimatedHours ?? undefined,
      proposed_start_time: proposedStartTime ?? undefined,
    });
    return res.data;
  },
  async withdrawBid(bidId: string) {
    const res = await api.delete(`/bids/${bidId}`);
    return res.data;
  },
  async getMyBids() {
    const res = await api.get("/bids/mine");
    return res.data;
  },
  async getMySkills() {
    const res = await api.get("/artisans/skills/mine");
    return res.data;
  },
};
