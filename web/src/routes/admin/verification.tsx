// File: web/src/routes/admin/verification.tsx
import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ShieldCheck,
  XCircle,
  ExternalLink,
  User,
  BarChart3,
  Users,
  AlertTriangle,
  Package,
  Settings,
  LogOut,
  Bell,
  Search,
  CheckCircle,
  Ban,
  Eye,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { Header } from "@/components/Header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import { formatRWF } from "@/services/artisanService";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export const Route = createFileRoute("/admin/verification")({
  component: AdminDashboard,
});

type Tab = "verification" | "analytics" | "users" | "disputes" | "categories";

function AdminDashboard() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("verification");
  const [userSearch, setUserSearch] = useState("");

  // Redirect if not admin
  if (user && user.role !== "admin") {
    navigate({ to: "/" });
    return null;
  }

  return (
    <div className="min-h-dvh bg-muted/30">
      {/* Admin top bar */}
      <div className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl font-black text-primary">HandyRwanda</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
              Admin
            </span>
          </Link>
          <div className="flex-1" />
          <span className="text-sm text-muted-foreground hidden sm:block">{user?.fullName}</span>
          <button
            onClick={() => {
              logout();
              navigate({ to: "/" });
            }}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive transition-colors"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Tab nav */}
        <div className="flex overflow-x-auto gap-1 rounded-2xl bg-card border border-border p-1.5 mb-6 w-fit">
          {(
            [
              ["verification", ShieldCheck, "Verification"],
              ["analytics", BarChart3, "Analytics"],
              ["users", Users, "Users"],
              ["disputes", AlertTriangle, "Disputes"],
              ["categories", Package, "Categories"],
            ] as [Tab, typeof ShieldCheck, string][]
          ).map(([id, Icon, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition whitespace-nowrap ${tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        {tab === "verification" && <VerificationTab qc={qc} />}
        {tab === "analytics" && <AnalyticsTab />}
        {tab === "users" && <UsersTab search={userSearch} setSearch={setUserSearch} qc={qc} />}
        {tab === "disputes" && <DisputesTab qc={qc} />}
        {tab === "categories" && <CategoriesTab qc={qc} />}
      </div>
    </div>
  );
}

// ── Verification Tab ──────────────────────────────────────────────────────────

function VerificationTab({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const { data: pending = [], isLoading } = useQuery({
    queryKey: ["admin-pending"],
    queryFn: () => api.get("/admin/artisans/pending").then((r) => r.data),
    refetchInterval: 30000,
  });

  const approve = useMutation({
    mutationFn: (id: string) => api.post(`/admin/artisans/${id}/approve`),
    onSuccess: () => {
      toast.success("Artisan approved!");
      qc.invalidateQueries({ queryKey: ["admin-pending"] });
    },
  });
  const reject = useMutation({
    mutationFn: (id: string) =>
      api.post(`/admin/artisans/${id}/reject`, { reason: "Documents unclear" }),
    onSuccess: () => {
      toast.error("Artisan rejected.");
      qc.invalidateQueries({ queryKey: ["admin-pending"] });
    },
  });

  return (
    <div>
      <h2 className="text-xl font-bold mb-1">Verification Queue</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Review artisan ID documents before approving.
      </p>
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : pending.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-success" />
          <p className="mt-3 font-semibold">All caught up! No pending verifications.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/50 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-4">Artisan</th>
                <th className="px-5 py-4 hidden sm:table-cell">Contact</th>
                <th className="px-5 py-4 hidden md:table-cell">Submitted</th>
                <th className="px-5 py-4 text-center">Documents</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pending.map(
                (item: {
                  user: {
                    id: string;
                    full_name: string;
                    email: string;
                    phone_number: string;
                    avatar_url?: string;
                    created_at?: string;
                  };
                  profile: { id_document_url?: string; selfie_url?: string; submitted_at?: string };
                }) => (
                  <tr key={item.user.id} className="hover:bg-muted/20">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 overflow-hidden rounded-full bg-muted flex items-center justify-center font-bold text-muted-foreground">
                          {item.user.avatar_url ? (
                            <img
                              src={item.user.avatar_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            item.user.full_name[0]
                          )}
                        </div>
                        <div>
                          <p className="font-semibold">{item.user.full_name}</p>
                          <p className="text-xs text-muted-foreground hidden sm:block">
                            {item.user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell text-muted-foreground">
                      {item.user.phone_number}
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell text-muted-foreground">
                      {item.profile.submitted_at
                        ? new Date(item.profile.submitted_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {item.profile.id_document_url && (
                          <a
                            href={item.profile.id_document_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition"
                          >
                            <ExternalLink className="h-3 w-3" /> ID Doc
                          </a>
                        )}
                        {item.profile.selfie_url && (
                          <a
                            href={item.profile.selfie_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-xs font-semibold hover:bg-muted/80 transition"
                          >
                            <Eye className="h-3 w-3" /> Selfie
                          </a>
                        )}
                        {!item.profile.id_document_url && !item.profile.selfie_url && (
                          <span className="text-xs text-muted-foreground">No docs uploaded</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => approve.mutate(item.user.id)}
                          disabled={approve.isPending}
                          className="inline-flex items-center gap-1 rounded-xl bg-success px-3 py-1.5 text-xs font-bold text-white hover:brightness-95 transition disabled:opacity-50"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => reject.mutate(item.user.id)}
                          disabled={reject.isPending}
                          className="inline-flex items-center gap-1 rounded-xl bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/20 transition disabled:opacity-50"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Analytics Tab ─────────────────────────────────────────────────────────────

function AnalyticsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: () => api.get("/admin/stats").then((r) => r.data),
  });

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  if (!data) return null;

  const stats = [
    {
      label: "Total Users",
      value: data.users.total,
      sub: `${data.users.artisans} artisans, ${data.users.clients} clients`,
      color: "bg-blue-100 text-blue-700",
    },
    {
      label: "Total Bookings",
      value: data.bookings.total,
      sub: `${data.bookings.completed} completed`,
      color: "bg-green-100 text-green-700",
    },
    {
      label: "Dispute Rate",
      value: `${data.bookings.total > 0 ? ((data.bookings.disputed / data.bookings.total) * 100).toFixed(1) : 0}%`,
      sub: `${data.bookings.disputed} total disputes`,
      color: "bg-amber-100 text-amber-700",
    },
    {
      label: "Total Revenue",
      value: formatRWF(data.total_revenue_rwf),
      sub: "RWF from completed jobs",
      color: "bg-purple-100 text-purple-700",
    },
    {
      label: "Pending Verifications",
      value: data.pending_verifications,
      sub: "Awaiting admin review",
      color: "bg-orange-100 text-orange-700",
    },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Platform Analytics</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4">
            <div className={`inline-block rounded-xl px-2 py-1 text-xs font-bold mb-2 ${s.color}`}>
              {s.label}
            </div>
            <div className="text-2xl font-extrabold">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.sub}</div>
          </div>
        ))}
      </div>

      {data.monthly_trend?.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h3 className="font-bold mb-4">Monthly Bookings (last 6 months)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.monthly_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="bookings"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {data.top_artisans?.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h3 className="font-bold mb-4">Top Artisans</h3>
          <div className="space-y-3">
            {data.top_artisans.map(
              (a: { name: string; rating: number; jobs: number }, i: number) => (
                <div key={a.name} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    #{i + 1}
                  </div>
                  <div className="flex-1 font-semibold">{a.name}</div>
                  <div className="text-sm text-muted-foreground">⭐ {a.rating.toFixed(1)}</div>
                  <div className="text-sm text-muted-foreground">{a.jobs} jobs</div>
                </div>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────────

function UsersTab({
  search,
  setSearch,
  qc,
}: {
  search: string;
  setSearch: (s: string) => void;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () =>
      api.get("/admin/users", { params: { q: search || undefined } }).then((r) => r.data),
  });

  const suspend = useMutation({
    mutationFn: (id: string) => api.post(`/admin/users/${id}/suspend`),
    onSuccess: () => {
      toast.success("User suspended.");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
  const activate = useMutation({
    mutationFn: (id: string) => api.post(`/admin/users/${id}/activate`),
    onSuccess: () => {
      toast.success("User activated.");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xl font-bold">User Management</h2>
        <div className="ml-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users…"
            className="pl-9 pr-4 py-2 rounded-xl border border-border bg-card text-sm outline-none focus:ring-2 focus:ring-primary/40 w-48"
          />
        </div>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm text-left">
            <thead className="border-b bg-muted/50 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-4">User</th>
                <th className="px-5 py-4 hidden sm:table-cell">Role</th>
                <th className="px-5 py-4 hidden md:table-cell">Status</th>
                <th className="px-5 py-4 hidden lg:table-cell">Joined</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map(
                (u: {
                  id: string;
                  full_name: string;
                  email: string;
                  phone_number: string;
                  role: string;
                  account_status: string;
                  created_at?: string;
                }) => (
                  <tr key={u.id} className="hover:bg-muted/20">
                    <td className="px-5 py-4">
                      <p className="font-semibold">{u.full_name}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${u.role === "artisan" ? "bg-blue-100 text-blue-700" : u.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"}`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${u.account_status === "active" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}
                      >
                        {u.account_status}
                      </span>
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell text-muted-foreground text-xs">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        {u.account_status !== "suspended" ? (
                          <button
                            onClick={() => suspend.mutate(u.id)}
                            className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700 hover:bg-amber-200 transition"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => activate.mutate(u.id)}
                            className="rounded-lg bg-success/10 px-2.5 py-1 text-xs font-bold text-success hover:bg-success/20 transition"
                          >
                            Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
          {users.length === 0 && (
            <p className="p-8 text-center text-muted-foreground text-sm">No users found.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Disputes Tab ──────────────────────────────────────────────────────────────

function DisputesTab({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const { data: disputes = [], isLoading } = useQuery({
    queryKey: ["admin-disputes"],
    queryFn: () =>
      api
        .get("/bookings")
        .then((r) => ({ data: r.data.filter((b) => b.status === "disputed") }))
        .then((r) => r.data),
  });

  const resolve = useMutation({
    mutationFn: ({ id, winner }: { id: string; winner: string }) =>
      api.post(`/admin/disputes/${id}/resolve`, { winner }),
    onSuccess: () => {
      toast.success("Dispute resolved.");
      qc.invalidateQueries({ queryKey: ["admin-disputes"] });
    },
  });

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Active Disputes</h2>
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : disputes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-success" />
          <p className="mt-3 font-semibold">No active disputes. 🎉</p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map(
            (d: {
              booking_id: string;
              client_name: string;
              agreed_price: number;
              created_at?: string;
            }) => (
              <div
                key={d.booking_id}
                className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">
                      Booking:{" "}
                      <span className="font-mono text-xs">{d.booking_id.slice(0, 8)}…</span>
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Client: {d.client_name} — {formatRWF(d.agreed_price)} RWF
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {d.created_at ? new Date(d.created_at).toLocaleDateString() : ""}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => resolve.mutate({ id: d.booking_id, winner: "artisan" })}
                      className="rounded-xl bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-200 transition"
                    >
                      Favour Artisan
                    </button>
                    <button
                      onClick={() => resolve.mutate({ id: d.booking_id, winner: "client" })}
                      className="rounded-xl bg-green-100 px-3 py-1.5 text-xs font-bold text-green-700 hover:bg-green-200 transition"
                    >
                      Favour Client
                    </button>
                  </div>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

// ── Categories Tab ────────────────────────────────────────────────────────────

function CategoriesTab({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const [form, setForm] = useState({ name_rw: "", name_en: "", name_fr: "", icon_emoji: "" });
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get("/artisans/categories").then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: () => api.post("/admin/categories", form),
    onSuccess: () => {
      toast.success("Category created!");
      setForm({ name_rw: "", name_en: "", name_fr: "", icon_emoji: "" });
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h2 className="text-xl font-bold mb-4">Service Categories</h2>
        {isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        ) : (
          <div className="space-y-2">
            {categories.map(
              (c: {
                id: string;
                icon_emoji?: string;
                name_en: string;
                name_rw: string;
                name_fr: string;
              }) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <span className="text-xl">{c.icon_emoji ?? "🔧"}</span>
                  <div>
                    <p className="font-semibold">{c.name_en}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.name_rw} · {c.name_fr}
                    </p>
                  </div>
                </div>
              ),
            )}
            {categories.length === 0 && (
              <p className="text-muted-foreground text-sm">No categories yet.</p>
            )}
          </div>
        )}
      </div>
      <div>
        <h2 className="text-xl font-bold mb-4">Add Category</h2>
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          {(["icon_emoji", "name_en", "name_rw", "name_fr"] as const).map((field) => (
            <div key={field}>
              <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {field.replace("_", " ")}
              </label>
              <input
                value={form[field]}
                onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))}
                placeholder={
                  field === "icon_emoji"
                    ? "🔧"
                    : field === "name_en"
                      ? "Plumbing"
                      : field === "name_rw"
                        ? "Gutunga amazi"
                        : "Plomberie"
                }
                className="mt-1 w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          ))}
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending || !form.name_en}
            className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-40 transition hover:brightness-95"
          >
            {create.isPending ? "Creating…" : "Create Category"}
          </button>
        </div>
      </div>
    </div>
  );
}
