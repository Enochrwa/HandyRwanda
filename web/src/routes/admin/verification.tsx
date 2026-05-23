import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, XCircle, ExternalLink, User } from "lucide-react";
import { Header } from "@/components/Header";

export const Route = createFileRoute("/admin/verification")({
  component: VerificationDashboard,
});

function VerificationDashboard() {
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPending = async () => {
    // In real app, use tanstack query
    const res = await fetch("/api/admin/artisans/pending");
    const data = await res.json();
    setPending(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleAction = async (id: string, action: "approve" | "reject") => {
    await fetch(`/api/admin/artisans/${id}/${action}`, { method: "POST" });
    fetchPending();
  };

  return (
    <div className="min-h-screen bg-muted/30 pb-12">
      <Header />
      <main className="mx-auto max-w-6xl px-4 pt-8">
        <h1 className="text-2xl font-bold">Artisan Verification Queue</h1>
        <p className="text-muted-foreground">Review and approve artisan identities.</p>

        <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-left">
            <thead className="border-b bg-muted/50 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-6 py-4">Artisan</th>
                <th className="px-6 py-4">Phone</th>
                <th className="px-6 py-4">Submitted</th>
                <th className="px-6 py-4 text-center">Docs</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    Loading queue...
                  </td>
                </tr>
              ) : pending.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    No pending verifications. All caught up!
                  </td>
                </tr>
              ) : (
                pending.map((item) => (
                  <tr key={item.user.id} className="hover:bg-muted/20">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 overflow-hidden rounded-full bg-muted">
                          {item.user.avatar_url ? (
                            <img src={item.user.avatar_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <User className="m-2 h-6 w-6 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold">{item.user.full_name}</p>
                          <p className="text-xs text-muted-foreground">{item.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">{item.user.phone_number}</td>
                    <td className="px-6 py-4 text-sm">
                      {new Date(item.profile.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-4">
                        <button className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                          <ExternalLink className="h-3.5 w-3.5" /> ID Front
                        </button>
                        <button className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                          <ExternalLink className="h-3.5 w-3.5" /> Selfie
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleAction(item.user.id, "reject")}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-danger/20 px-3 text-sm font-bold text-danger hover:bg-danger/5"
                        >
                          <XCircle className="h-4 w-4" /> Reject
                        </button>
                        <button
                          onClick={() => handleAction(item.user.id, "approve")}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-success px-3 text-sm font-bold text-white hover:brightness-95"
                        >
                          <ShieldCheck className="h-4 w-4" /> Approve
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
