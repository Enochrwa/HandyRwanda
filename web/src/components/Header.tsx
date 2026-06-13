// File: web/src/components/Header.tsx
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Search,
  Bell,
  LogOut,
  LayoutDashboard,
  User as UserIcon,
  MessageSquare,
  ShieldCheck,
  Settings,
  BookOpen,
  Plus,
} from "lucide-react";
import { useState, useMemo, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/authStore";
import { AuthModal } from "./AuthModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import { formatDistanceToNow } from "date-fns";
import { useNotificationSocket } from "@/hooks/useNotificationSocket";

export function Header() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<"login" | "register">("login");
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Connect real-time WebSocket for notifications (replaces 30s polling)
  useNotificationSocket();

  const { data: conversations } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.get("/messages/conversations").then((r) => r.data),
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  // Initial fetch only — WebSocket keeps this fresh after initial load
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications").then((r) => r.data),
    enabled: isAuthenticated,
    staleTime: 60000, // Consider fresh for 60s; WS updates will still come through
  });

  const markAllRead = useMutation({
    mutationFn: () => api.patch("/notifications/read-all"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unreadMessages = useMemo(
    () =>
      conversations?.reduce(
        (acc: number, c: { unread_count?: number }) => acc + (c.unread_count ?? 0),
        0,
      ) ?? 0,
    [conversations],
  );

  const unreadNotifs = useMemo(
    () => notifications.filter((n: { is_read: boolean }) => !n.is_read).length,
    [notifications],
  );

  // Close notif panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const eventIcons: Record<string, string> = {
    payment_sent: "💰",
    job_started: "🔨",
    job_completed: "✅",
    review_prompt: "⭐",
    dispute_opened: "⚠️",
    booking_cancelled: "❌",
    new_bid: "📋",
    booking_confirmed: "📅",
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground font-black text-lg shadow-card">
            H
          </div>
          <div className="leading-tight">
            <div className="font-bold text-foreground">HandyRwanda</div>
            <div className="text-[11px] font-medium tracking-wide text-muted-foreground hidden sm:block">
              Akazi beza, ku gihe
            </div>
          </div>
        </Link>

        <nav className="hidden gap-1 md:flex">
          {/* Home and Browse are public */}
          {[
            { to: "/", label: "Home", exact: true },
            { to: "/search", label: "Browse" },
          ].map(({ to, label, exact }) => (
            <Link
              key={to}
              to={to}
              activeOptions={exact ? { exact: true } : undefined}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              activeProps={{
                className: "rounded-lg px-3 py-2 text-sm font-semibold text-foreground bg-muted",
              }}
            >
              {label}
            </Link>
          ))}

          {/* Messages — clients and artisans only */}
          {isAuthenticated && (user?.role === "client" || user?.role === "artisan") && (
            <Link
              to="/messages"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              activeProps={{
                className: "rounded-lg px-3 py-2 text-sm font-semibold text-foreground bg-muted",
              }}
            >
              Messages
              {unreadMessages > 0 && (
                <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
                  {unreadMessages}
                </span>
              )}
            </Link>
          )}

          {/* For Artisans promo — unauthenticated or clients only */}
          {(!isAuthenticated || user?.role === "client") && (
            <Link
              to="/pro"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              activeProps={{
                className: "rounded-lg px-3 py-2 text-sm font-semibold text-foreground bg-muted",
              }}
            >
              For Artisans
            </Link>
          )}

          {/* Artisan job feed — artisans only */}
          {isAuthenticated && user?.role === "artisan" && (
            <Link
              to="/artisans/jobs"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              activeProps={{
                className: "rounded-lg px-3 py-2 text-sm font-semibold text-foreground bg-muted",
              }}
            >
              Job Feed
            </Link>
          )}

          {/* My Jobs — client only */}
          {isAuthenticated && user?.role === "client" && (
            <Link
              to="/jobs/mine"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              activeProps={{
                className: "rounded-lg px-3 py-2 text-sm font-semibold text-foreground bg-muted",
              }}
            >
              My Jobs
            </Link>
          )}

          {/* Admin dashboard — admin only */}
          {isAuthenticated && user?.role === "admin" && (
            <Link
              to="/admin/verification"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              activeProps={{
                className: "rounded-lg px-3 py-2 text-sm font-semibold text-foreground bg-muted",
              }}
            >
              🛡️ Admin
            </Link>
          )}

          {/* Referrals — all authenticated users except admin */}
          {isAuthenticated && user?.role !== "admin" && (
            <Link
              to="/referrals"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              activeProps={{
                className: "rounded-lg px-3 py-2 text-sm font-semibold text-foreground bg-muted",
              }}
            >
              🎁 Referrals
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/search"
            aria-label="Search"
            className="grid h-10 w-10 place-items-center rounded-full text-foreground hover:bg-muted md:hidden transition-colors"
          >
            <Search className="h-5 w-5" />
          </Link>

          {/* Notifications bell */}
          {isAuthenticated && (
            <div className="relative" ref={notifRef}>
              <button
                aria-label="Notifications"
                onClick={() => {
                  setNotifOpen((v) => !v);
                  if (!notifOpen && unreadNotifs > 0) markAllRead.mutate();
                }}
                className="relative grid h-10 w-10 place-items-center rounded-full text-foreground hover:bg-muted transition-colors"
              >
                <Bell className="h-5 w-5" />
                {unreadNotifs > 0 && (
                  <span className="absolute right-1.5 top-1.5 h-4 w-4 rounded-full bg-accent text-[9px] font-bold text-accent-foreground flex items-center justify-center">
                    {unreadNotifs > 9 ? "9+" : unreadNotifs}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-12 z-50 w-80 rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <span className="font-bold">Notifications</span>
                    <button
                      onClick={() => markAllRead.mutate()}
                      className="text-xs text-primary hover:underline"
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-sm text-muted-foreground">
                        <Bell className="mx-auto h-8 w-8 mb-2" />
                        No notifications yet
                      </div>
                    ) : (
                      notifications
                        .slice(0, 15)
                        .map(
                          (n: {
                            id: string;
                            event_type: string;
                            title: string;
                            body: string;
                            is_read: boolean;
                            created_at: string;
                            payload?: { booking_id?: string };
                          }) => (
                            <button
                              key={n.id}
                              onClick={() => {
                                setNotifOpen(false);
                                if (n.payload?.booking_id)
                                  navigate({
                                    to: "/messages",
                                    search: { booking: n.payload.booking_id },
                                  });
                              }}
                              className={`w-full text-left px-4 py-3 border-b border-border/50 hover:bg-muted/50 transition-colors ${!n.is_read ? "bg-primary/5" : ""}`}
                            >
                              <div className="flex items-start gap-2.5">
                                <span className="text-lg shrink-0 mt-0.5">
                                  {eventIcons[n.event_type] ?? "🔔"}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold truncate">{n.title}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                    {n.body}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground mt-1">
                                    {n.created_at
                                      ? formatDistanceToNow(new Date(n.created_at), {
                                          addSuffix: true,
                                        })
                                      : ""}
                                  </p>
                                </div>
                                {!n.is_read && (
                                  <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />
                                )}
                              </div>
                            </button>
                          ),
                        )
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Account"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 transition-transform active:scale-95 overflow-hidden"
                >
                  <Avatar className="h-full w-full">
                    <AvatarImage src={user?.avatarUrl} alt={user?.fullName} />
                    <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                      {user?.fullName?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">{user?.fullName}</span>
                    <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
                    <span
                      className={`mt-1 w-fit rounded-full px-2 py-0.5 text-[10px] font-bold ${user?.role === "artisan" ? "bg-blue-100 text-blue-700" : user?.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"}`}
                    >
                      {user?.role}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user?.role === "artisan" && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to="/pro" className="flex items-center gap-2 cursor-pointer w-full">
                        <LayoutDashboard className="h-4 w-4" /> Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        to="/profile/portfolio"
                        className="flex items-center gap-2 cursor-pointer w-full"
                      >
                        <UserIcon className="h-4 w-4" /> My Portfolio
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        to="/onboarding/artisan"
                        className="flex items-center gap-2 cursor-pointer w-full"
                      >
                        <Settings className="h-4 w-4" /> Profile Settings
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                {user?.role === "client" && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link
                        to="/jobs/mine"
                        className="flex items-center gap-2 cursor-pointer w-full"
                      >
                        <BookOpen className="h-4 w-4" /> My Jobs
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        to="/jobs/post"
                        className="flex items-center gap-2 cursor-pointer w-full"
                      >
                        <Plus className="h-4 w-4" /> Post a Job
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/search" className="flex items-center gap-2 cursor-pointer w-full">
                        <Search className="h-4 w-4" /> Browse Artisans
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                {user?.role === "admin" && (
                  <DropdownMenuItem asChild>
                    <Link
                      to="/admin/verification"
                      className="flex items-center gap-2 cursor-pointer w-full"
                    >
                      <ShieldCheck className="h-4 w-4" /> Admin Dashboard
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link to="/messages" className="flex items-center gap-2 cursor-pointer w-full">
                    <MessageSquare className="h-4 w-4" /> Messages
                    {unreadMessages > 0 && (
                      <span className="ml-auto rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
                        {unreadMessages}
                      </span>
                    )}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer"
                  onClick={() => {
                    logout();
                    toast.success("Logged out successfully");
                    navigate({ to: "/" });
                  }}
                >
                  <LogOut className="h-4 w-4" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAuthModalTab("login");
                  setIsAuthModalOpen(true);
                }}
              >
                Log in
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setAuthModalTab("register");
                  setIsAuthModalOpen(true);
                }}
              >
                Sign up
              </Button>
            </div>
          )}
        </div>
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        defaultTab={authModalTab}
      />
    </header>
  );
}
