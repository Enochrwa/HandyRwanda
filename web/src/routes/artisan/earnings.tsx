// File: web/src/routes/artisan/earnings.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import api from "@/services/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/artisan/earnings")({
  component: EarningsPage,
});

function EarningsPage() {
  const [momoNumber, setMomoNumber] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const { data: summary, refetch: refetchSummary } = useQuery({
    queryKey: ["artisan-earnings"],
    queryFn: () => api.get("/escrow/earnings").then((r) => r.data),
  });

  const { data: transactions } = useQuery({
    queryKey: ["artisan-transactions"],
    queryFn: () => api.get("/escrow/transactions").then((r) => r.data),
  });

  const { data: withdrawals, refetch: refetchWithdrawals } = useQuery({
    queryKey: ["artisan-withdrawals"],
    queryFn: () => api.get("/escrow/withdrawals").then((r) => r.data),
  });

  const withdraw = useMutation({
    mutationFn: () => api.post("/escrow/withdraw", { amount: parseInt(withdrawAmount), momo_number: momoNumber }),
    onSuccess: () => { toast.success("Withdrawal request submitted!"); setWithdrawAmount(""); setMomoNumber(""); refetchSummary(); refetchWithdrawals(); },
    onError: (err: any) => toast.error(err.response?.data?.detail || "Withdrawal failed"),
  });

  const statusColors: Record<string, string> = { held: "bg-yellow-100 text-yellow-800", released: "bg-green-100 text-green-800", refunded: "bg-red-100 text-red-800", disputed: "bg-orange-100 text-orange-800" };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">My Earnings</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Available", amount: summary?.available_for_withdrawal ?? 0, color: "text-green-600" },
          { label: "Pending Release", amount: summary?.pending_release ?? 0, color: "text-yellow-600" },
          { label: "Pending Withdrawal", amount: summary?.pending_withdrawal ?? 0, color: "text-blue-600" },
          { label: "Total Earned", amount: summary?.total_earned ?? 0, color: "text-foreground" },
        ].map((item) => (
          <Card key={item.label}><CardContent className="pt-4"><p className="text-xs text-muted-foreground">{item.label}</p><p className={`text-xl font-bold mt-1 ${item.color}`}>{(item.amount).toLocaleString()} RWF</p></CardContent></Card>
        ))}
      </div>
      {(summary?.available_for_withdrawal ?? 0) >= 1000 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Request Withdrawal</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1"><Label>MoMo Number</Label><Input placeholder="07XXXXXXXX" value={momoNumber} onChange={(e) => setMomoNumber(e.target.value)} /></div>
              <div className="space-y-1"><Label>Amount (RWF)</Label><Input type="number" placeholder={`Max: ${summary?.available_for_withdrawal?.toLocaleString()} RWF`} value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} /></div>
            </div>
            <Button onClick={() => withdraw.mutate()} disabled={withdraw.isPending || !momoNumber || !withdrawAmount}>{withdraw.isPending ? "Submitting..." : "Request Payout"}</Button>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle className="text-base">Transaction History</CardTitle></CardHeader>
        <CardContent>
          {(transactions ?? []).length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">No transactions yet.</p> : (
            <div className="space-y-2">{(transactions ?? []).map((t: any) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div><p className="text-sm font-medium">{t.amount.toLocaleString()} RWF</p><p className="text-xs text-muted-foreground">{t.held_at ? formatDistanceToNow(new Date(t.held_at), { addSuffix: true }) : ""}</p></div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[t.status] ?? ""}`}>{t.status}</span>
              </div>
            ))}</div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
