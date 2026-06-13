// File: web/src/routes/admin/verification.tsx
import { useState } from "react";
import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useAuthStore } from "@/store/authStore";
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
  CreditCard,
  Video,
  Play,
  Clock,
  MessageSquare,
} from "lucide-react";
import { Header } from "@/components/Header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import type { Dispute } from "@/types/dispute";
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
  beforeLoad: () => {
    // Read auth state directly from the persisted Zustand store.
    // This runs before any React component renders, so there is no
    // "call navigate before hooks" violation.
    const { isAuthenticated, user } = useAuthStore.getState();
    if (!isAuthenticated || user?.role !== "admin") {
      throw redirect({ to: "/" });
    }
  },
  component: AdminDashboard,
});

type Tab =
  | "verification"
  | "analytics"
  | "users"
  | "disputes"
  | "categories"
  | "payments"
  | "skill_videos";

function AdminDashboard() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("verification");
  const [userSearch, setUserSearch] = useState("");

  // Role is already enforced by beforeLoad — no inline navigate() needed here.

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
          <nav className="hidden sm:flex items-center gap-1">
            <Link
              to="/admin/verification"
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition [&.active]:text-primary [&.active]:bg-primary/10"
            >
              Verification
            </Link>
            <Link
              to="/admin/scores"
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition [&.active]:text-primary [&.active]:bg-primary/10"
            >
              🛡️ Safety Scores
            </Link>
          </nav>
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
              ["payments", CreditCard, "Payments"],
              ["analytics", BarChart3, "Analytics"],
              ["users", Users, "Users"],
              ["disputes", AlertTriangle, "Disputes"],
              ["categories", Package, "Categories"],
              ["skill_videos", Video, "Skill Videos"],
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
        {tab === "payments" && <PaymentsTab qc={qc} />}
        {tab === "analytics" && <AnalyticsTab />}
        {tab === "users" && <UsersTab search={userSearch} setSearch={setUserSearch} qc={qc} />}
        {tab === "disputes" && <DisputesTab qc={qc} />}
        {tab === "categories" && <CategoriesTab qc={qc} />}
        {tab === "skill_videos" && <SkillVideosTab qc={qc} />}
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
  const { data: disputes = [], isLoading } = useQuery<Dispute[]>({
    queryKey: ["admin-disputes"],
    queryFn: () => api.get<Dispute[]>("/admin/disputes").then((r) => r.data),
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
          {disputes.map((d) => (
            <div key={d.booking_id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">
                    Booking: <span className="font-mono text-xs">{d.booking_id.slice(0, 8)}…</span>
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
          ))}
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
    queryFn: () => api.get("/categories").then((r) => r.data),
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

// ── Payments Tab ──────────────────────────────────────────────────────────────
interface PendingPayment {
  payment_id: string;
  booking_id: string;
  client_name: string;
  client_phone: string;
  amount: number;
  method: string;
  reference_code: string;
  client_transaction_id: string | null;
  proof_screenshot_url: string | null;
  proof_submitted_at: string | null;
  created_at: string;
}

function PaymentsTab({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const { data: payments = [], isLoading } = useQuery<PendingPayment[]>({
    queryKey: ["admin-pending-payments"],
    queryFn: () => api.get("/admin/payments/pending").then((r) => r.data),
    refetchInterval: 15000,
  });

  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
  const [screenshotOpen, setScreenshotOpen] = useState<string | null>(null);

  const verify = useMutation({
    mutationFn: ({
      paymentId,
      approved,
      note,
    }: {
      paymentId: string;
      approved: boolean;
      note?: string;
    }) =>
      api.post(`/admin/payments/${paymentId}/verify`, {
        approved,
        admin_note: note || undefined,
      }),
    onSuccess: (_, { approved }) => {
      toast.success(approved ? "Payment approved ✅" : "Payment rejected ❌");
      qc.invalidateQueries({ queryKey: ["admin-pending-payments"] });
    },
    onError: () => toast.error("Action failed. Try again."),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">Payment Verification</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manual MoMo / Airtel payment proofs awaiting review
          </p>
        </div>
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-sm font-semibold text-amber-800">{payments.length} pending</span>
        </div>
      </div>

      {payments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <CheckCircle className="h-12 w-12 mb-3 text-green-400" />
          <p className="font-semibold text-lg">All clear!</p>
          <p className="text-sm mt-1">No payments waiting for verification.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {payments.map((p) => (
            <div
              key={p.payment_id}
              className="bg-card border border-border rounded-3xl p-5 shadow-sm"
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg font-extrabold text-primary">
                      {formatRWF(p.amount)} RWF
                    </span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        p.method === "mtn_momo"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {p.method === "mtn_momo" ? "📱 MTN MoMo" : "💳 Airtel Money"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Client: <span className="font-semibold text-foreground">{p.client_name}</span>
                    {" · "}
                    <span>{p.client_phone}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-mono bg-muted/50 px-2 py-1 rounded-lg text-foreground">
                    {p.reference_code}
                  </p>
                  {p.proof_submitted_at && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Submitted{" "}
                      {new Date(p.proof_submitted_at).toLocaleTimeString("en-RW", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
              </div>

              {/* Transaction ID */}
              <div className="bg-muted/30 rounded-2xl p-3 mb-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">
                  Transaction ID (from MoMo SMS)
                </p>
                <p className="font-mono text-sm text-foreground">
                  {p.client_transaction_id ?? (
                    <span className="text-muted-foreground italic">Not provided</span>
                  )}
                </p>
              </div>

              {/* Screenshot */}
              {p.proof_screenshot_url && (
                <div className="mb-4">
                  <button
                    onClick={() => setScreenshotOpen(p.proof_screenshot_url!)}
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Eye className="h-4 w-4" />
                    View payment screenshot
                  </button>
                </div>
              )}

              {/* Rejection note */}
              <div className="mb-3">
                <input
                  value={rejectNote[p.payment_id] ?? ""}
                  onChange={(e) =>
                    setRejectNote((prev) => ({ ...prev, [p.payment_id]: e.target.value }))
                  }
                  placeholder="Rejection reason (required if rejecting)"
                  className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => verify.mutate({ paymentId: p.payment_id, approved: true })}
                  disabled={verify.isPending}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-2xl py-2.5 text-sm font-bold transition-colors disabled:opacity-50"
                >
                  <CheckCircle className="h-4 w-4" />
                  Approve
                </button>
                <button
                  onClick={() => {
                    const note = rejectNote[p.payment_id]?.trim();
                    if (!note) {
                      toast.error("Enter a rejection reason before rejecting.");
                      return;
                    }
                    verify.mutate({
                      paymentId: p.payment_id,
                      approved: false,
                      note,
                    });
                  }}
                  disabled={verify.isPending}
                  className="flex-1 flex items-center justify-center gap-2 bg-destructive hover:bg-destructive/90 text-white rounded-2xl py-2.5 text-sm font-bold transition-colors disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Screenshot lightbox */}
      {screenshotOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setScreenshotOpen(null)}
        >
          <img
            src={screenshotOpen}
            alt="Payment screenshot"
            className="max-w-full max-h-full rounded-2xl object-contain"
          />
          <button
            onClick={() => setScreenshotOpen(null)}
            className="absolute top-4 right-4 text-white text-2xl font-bold hover:opacity-80"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Sprint 10 — Admin: Skill Video Moderation Tab
// ══════════════════════════════════════════════════════════════════════════════

interface PendingVideo {
  id: string;
  artisan_id: string;
  artisan_name: string;
  artisan_avatar?: string;
  video_url: string;
  thumbnail_url?: string;
  title: string;
  description?: string;
  duration_seconds?: number;
  category_id?: string;
  category_name?: string;
  created_at: string;
}

function formatDurationAdmin(s?: number) {
  if (!s) return "—";
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function SkillVideosTab({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const [previewVideo, setPreviewVideo] = useState<PendingVideo | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);

  const { data: pendingVideos, isLoading } = useQuery<PendingVideo[]>({
    queryKey: ["admin-pending-videos"],
    queryFn: () => api.get("/admin/skill-videos/pending").then((r) => r.data),
    refetchInterval: 30_000,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/skill-videos/${id}/approve`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["admin-pending-videos"] });
      toast.success("Video approved — artisan notified ✅");
      if (previewVideo?.id === id) setPreviewVideo(null);
    },
    onError: () => toast.error("Approval failed"),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/admin/skill-videos/${id}/reject`, { reason }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["admin-pending-videos"] });
      toast.success("Video rejected — artisan notified with feedback");
      setRejectingId(null);
      setRejectReason("");
      if (previewVideo?.id === id) setPreviewVideo(null);
    },
    onError: () => toast.error("Rejection failed"),
  });

  const handleReject = async () => {
    if (!rejectingId || !rejectReason.trim()) return;
    setRejectLoading(true);
    await rejectMutation.mutateAsync({ id: rejectingId, reason: rejectReason.trim() });
    setRejectLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            Skill Video Moderation
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Review and approve artisan skill verification videos. Approved videos appear on public
            artisan profiles.
          </p>
        </div>
        {pendingVideos && pendingVideos.length > 0 && (
          <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 text-sm font-bold px-3 py-1.5 rounded-full border border-amber-200">
            <Clock className="h-3.5 w-3.5" />
            {pendingVideos.length} pending
          </span>
        )}
      </div>

      {/* Guidelines */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-700">
        <p className="font-bold text-blue-900 mb-2">📋 Moderation Guidelines</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Approve if video clearly demonstrates the claimed skill</li>
          <li>Reject if content is unclear, off-topic, or violates community guidelines</li>
          <li>Provide a helpful rejection reason — artisans can re-submit after fixing issues</li>
          <li>Aim to review within 24 hours of submission</li>
        </ul>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !pendingVideos || pendingVideos.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-border rounded-3xl">
          <CheckCircle className="h-12 w-12 mx-auto text-emerald-500 mb-3" />
          <p className="font-bold text-lg">All caught up!</p>
          <p className="text-muted-foreground text-sm mt-1">
            No skill videos pending review right now.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {pendingVideos.map((video) => (
            <div
              key={video.id}
              className="bg-card border border-border rounded-2xl overflow-hidden"
            >
              {/* Thumbnail + play */}
              <div
                className="relative aspect-video bg-zinc-900 cursor-pointer group"
                onClick={() => setPreviewVideo(video)}
              >
                {video.thumbnail_url ? (
                  <img
                    src={video.thumbnail_url}
                    alt={video.title}
                    className="w-full h-full object-cover opacity-90"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Video className="h-14 w-14 text-zinc-600" />
                  </div>
                )}
                {/* Play overlay */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-xl">
                    <Play className="h-7 w-7 text-primary fill-primary ml-1" />
                  </div>
                </div>
                {/* Always-visible play hint */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center group-hover:opacity-0 transition-opacity">
                    <Play className="h-5 w-5 text-white fill-white ml-0.5" />
                  </div>
                </div>
                {/* Duration badge */}
                {video.duration_seconds && (
                  <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[11px] font-mono px-1.5 py-0.5 rounded">
                    {formatDurationAdmin(video.duration_seconds)}
                  </div>
                )}
                {/* Category badge */}
                {video.category_name && (
                  <div className="absolute top-2 left-2 bg-primary/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {video.category_name}
                  </div>
                )}
                {/* Preview hint */}
                <div className="absolute bottom-2 left-2 text-[10px] text-white/60 group-hover:text-white/90 transition-colors">
                  Click to preview
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                {/* Artisan */}
                <div className="flex items-center gap-3 mb-3">
                  {video.artisan_avatar ? (
                    <img
                      src={video.artisan_avatar}
                      alt={video.artisan_name}
                      className="w-9 h-9 rounded-full object-cover border border-border"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center border border-border">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-sm">{video.artisan_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Submitted{" "}
                      {new Date(video.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>

                <p className="font-semibold text-sm mb-1 truncate">{video.title}</p>
                {video.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {video.description}
                  </p>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setPreviewVideo(video)}
                    className="flex-1 flex items-center justify-center gap-1.5 border border-border bg-muted/50 hover:bg-muted text-sm font-semibold py-2 rounded-xl transition-colors"
                  >
                    <Eye className="h-4 w-4" />
                    Preview
                  </button>
                  <button
                    onClick={() => approveMutation.mutate(video.id)}
                    disabled={approveMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-2 rounded-xl transition-colors disabled:opacity-60"
                  >
                    {approveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      setRejectingId(video.id);
                      setRejectReason("");
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-sm font-bold py-2 rounded-xl transition-colors"
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Video Preview Modal ─────────────────────────────────────────────── */}
      {previewVideo && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col"
          onClick={() => setPreviewVideo(null)}
        >
          <div className="flex items-center justify-between px-6 pt-5 pb-4">
            <div onClick={(e) => e.stopPropagation()}>
              <p className="text-white font-bold text-lg">{previewVideo.title}</p>
              <p className="text-zinc-400 text-sm mt-0.5">
                by {previewVideo.artisan_name}
                {previewVideo.category_name ? ` · ${previewVideo.category_name}` : ""}
              </p>
            </div>
            <button
              onClick={() => setPreviewVideo(null)}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>

          {/* Video player */}
          <div
            className="flex-1 flex items-center justify-center px-6 pb-4"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              key={previewVideo.id}
              src={previewVideo.video_url}
              controls
              autoPlay
              className="max-h-[65vh] max-w-full rounded-xl shadow-2xl"
            />
          </div>

          {/* Bottom action bar */}
          <div
            className="bg-zinc-900/80 backdrop-blur border-t border-zinc-700 px-6 py-4 flex items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            {previewVideo.description && (
              <p className="flex-1 text-sm text-zinc-300 truncate">{previewVideo.description}</p>
            )}
            <div className="flex gap-3 ml-auto">
              <button
                onClick={() => {
                  approveMutation.mutate(previewVideo.id);
                }}
                disabled={approveMutation.isPending}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-60"
              >
                {approveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Approve
              </button>
              <button
                onClick={() => {
                  setPreviewVideo(null);
                  setRejectingId(previewVideo.id);
                  setRejectReason("");
                }}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-xl transition-colors"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rejection Dialog ─────────────────────────────────────────────────── */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div
            className="bg-card border border-border rounded-3xl p-6 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-red-100 rounded-xl">
                <MessageSquare className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Reject Video</h3>
                <p className="text-sm text-muted-foreground">
                  Provide clear feedback so the artisan can re-submit.
                </p>
              </div>
            </div>

            <label className="text-sm font-bold block mb-2">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. The video is too dark to clearly see the work. Please re-record in better lighting."
              rows={4}
              maxLength={500}
              className="w-full rounded-xl border border-border bg-muted/50 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <p className="text-[11px] text-right text-muted-foreground mt-1">
              {rejectReason.length}/500
            </p>

            <div className="mt-1 text-xs text-muted-foreground bg-amber-50 border border-amber-100 rounded-xl p-3 mb-5">
              💡 This message will be sent directly to the artisan as a notification. Be specific
              and constructive.
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setRejectingId(null);
                  setRejectReason("");
                }}
                className="flex-1 border border-border py-2.5 rounded-xl font-semibold text-sm hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || rejectLoading}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {rejectLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                Send Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
