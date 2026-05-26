import api from "./api";

export const proService = {
  async getDashboard() {
    const res = await api.get("/artisans/dashboard");
    return res.data; // { earnings_this_month, jobs_count, avg_rating, schedule: [...], nearby_jobs: [...] }
  },
  async toggleAvailability(available: boolean) {
    const res = await api.patch("/artisans/availability", {
      available_now: available,
    });
    return res.data;
  },
  async submitBid(jobId: string, price: number, note: string) {
    const res = await api.post(`/jobs/${jobId}/bids`, {
      proposed_price: price,
      message: note,
    });
    return res.data;
  },
};
