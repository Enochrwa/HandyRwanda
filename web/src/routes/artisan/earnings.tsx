// File: web/src/routes/artisan/earnings.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import api from "@/services/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Star, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/artisan/earnings")({
  component: EarningsPage,
});

interface Transaction {
  id: string;
  amount: number;
  status: string;
  held_at: string | null;
}

interface Withdrawal {
  id: string;
  amount: number;
  momo_number: string;
  status: string;
  admin_note?: string | null;
  created_at: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  held: "bg-yellow-100 text-yellow-800",
  released: "bg-green-100 text-green-800",
  refunded: "bg-red-100 text-red-800",
  disputed: "bg-orange-100 text-orange-800",
};

function EarningsPage() {
  const qc = useQueryClient();
  const [momoNumber, setMomoNumber] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const { data: summary, refetch: refetchSummary } = useQuery({
    queryKey: ["artisan-earnings"],
    queryFn: () => api.get("/escrow/earnings").then((r) => r.data as Record<string, number>),
  });

  const { data: transactions } = useQuery<Transaction[]>({
    queryKey: ["artisan-transactions"],
    queryFn: () => api.get("/escrow/transactions").then((r) => r.data as Transaction[]),
  });

  const { data: withdrawals, refetch: refetchWithdrawals } = useQuery<Withdrawal[]>({
    queryKey: ["artisan-withdrawals"],
    queryFn: () => api.get("/escrow/withdrawals").then((r) => r.data as Withdrawal[]),
  });

  const withdraw = useMutation({
    mutationFn: () =>
      api.post("/escrow/withdraw", {
        amount: parseInt(withdrawAmount),
        momo_number: momoNumber,
      }),
    onSuccess: () => {
      toast.success("Withdrawal request submitted!");
      setWithdrawAmount("");
      setMomoNumber("");
      void refetchSummary();
      void refetchWithdrawals();
      qc.invalidateQueries({ queryKey: ["artisan-earnings"] });
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err.response?.data?.detail ?? "Withdrawal failed");
    },
  });

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Earnings</h1>
        <Link
          to="/artisan/reviews"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors shadow-sm"
        >
          <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
          My Reviews
          <MessageCircle className="h-3.5 w-3.5 text-primary" />
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: "Available",
            amount: summary?.available_for_withdrawal ?? 0,
            color: "text-green-600",
          },
          {
            label: "Pending Release",
            amount: summary?.pending_release ?? 0,
            color: "text-yellow-600",
          },
          {
            label: "Pending Withdrawal",
            amount: summary?.pending_withdrawal ?? 0,
            color: "text-blue-600",
          },
          { label: "Total Earned", amount: summary?.total_earned ?? 0, color: "text-foreground" },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className={`mt-1 text-xl font-bold ${item.color}`}>
                {item.amount.toLocaleString()} RWF
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Withdrawal request */}
      {(summary?.available_for_withdrawal ?? 0) >= 1000 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Request Withdrawal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>MoMo Number</Label>
                <Input
                  placeholder="07XXXXXXXX"
                  value={momoNumber}
                  onChange={(e) => setMomoNumber(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Amount (RWF)</Label>
                <Input
                  type="number"
                  placeholder={`Max: ${summary?.available_for_withdrawal?.toLocaleString()} RWF`}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                />
              </div>
            </div>
            <Button
              onClick={() => withdraw.mutate()}
              disabled={withdraw.isPending || !momoNumber || !withdrawAmount}
            >
              {withdraw.isPending ? "Submitting..." : "Request Payout"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Transaction history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {(transactions ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <div className="space-y-2">
              {(transactions ?? []).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between border-b border-border/50 py-2 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">{t.amount.toLocaleString()} RWF</p>
                    <p className="text-xs text-muted-foreground">
                      {t.held_at
                        ? formatDistanceToNow(new Date(t.held_at), { addSuffix: true })
                        : ""}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[t.status] ?? ""}`}
                  >
                    {t.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Withdrawal history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Withdrawal History</CardTitle>
        </CardHeader>
        <CardContent>
          {(withdrawals ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No withdrawals yet.</p>
          ) : (
            <div className="space-y-2">
              {(withdrawals ?? []).map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between border-b border-border/50 py-2 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {w.amount.toLocaleString()} RWF → {w.momo_number}
                    </p>
                    {w.admin_note && (
                      <p className="text-xs text-muted-foreground">{w.admin_note}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {w.created_at
                        ? formatDistanceToNow(new Date(w.created_at), { addSuffix: true })
                        : ""}
                    </p>
                  </div>
                  <Badge
                    variant={
                      w.status === "paid"
                        ? "default"
                        : w.status === "rejected"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {w.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
