// File: web/src/routes/settings/notifications.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import api from "@/services/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/settings/notifications")({
  component: NotificationPreferencesPage,
});

interface Prefs {
  new_bid: boolean;
  booking_update: boolean;
  payment: boolean;
  message: boolean;
  promo: boolean;
}

const PREF_LABELS: { key: keyof Prefs; label: string; description: string }[] = [
  { key: "new_bid", label: "New bids", description: "When an artisan places a bid on your job" },
  { key: "booking_update", label: "Booking updates", description: "Confirmations, completions, and status changes" },
  { key: "payment", label: "Payments & earnings", description: "Payment approvals, escrow releases, withdrawals" },
  { key: "message", label: "Messages", description: "When you receive a new in-app message" },
  { key: "promo", label: "Promotions", description: "Tips, offers, and platform news" },
];

function NotificationPreferencesPage() {
  const qc = useQueryClient();
  const [prefs, setPrefs] = useState<Prefs>({
    new_bid: true, booking_update: true, payment: true, message: true, promo: false,
  });

  const { data: serverPrefs } = useQuery<Prefs>({
    queryKey: ["notification-prefs"],
    queryFn: () => api.get("/notifications/preferences").then((r) => r.data),
  });

  useEffect(() => { if (serverPrefs) setPrefs(serverPrefs); }, [serverPrefs]);

  const save = useMutation({
    mutationFn: (updated: Prefs) => api.patch("/notifications/preferences", updated),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notification-prefs"] }); toast.success("Preferences saved"); },
    onError: () => toast.error("Failed to save preferences"),
  });

  const toggle = (key: keyof Prefs) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    save.mutate(updated);
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">Notification Preferences</h1>
      <Card>
        <CardHeader><CardTitle className="text-base">Choose what to receive</CardTitle></CardHeader>
        <CardContent className="divide-y divide-border">
          {PREF_LABELS.map((item) => (
            <div key={item.key} className="flex items-center justify-between py-4">
              <div className="space-y-0.5">
                <Label htmlFor={item.key} className="text-base font-medium">{item.label}</Label>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <Switch id={item.key} checked={prefs[item.key]} onCheckedChange={() => toggle(item.key)} />
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
