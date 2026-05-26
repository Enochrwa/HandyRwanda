import { Link } from "@tanstack/react-router";
import { Search, Bell, LogOut, LayoutDashboard, User as UserIcon, MessageSquare } from "lucide-react";
import { useState, useMemo } from "react";
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
import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";

export function Header() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<"login" | "register">("login");

  const openLogin = () => {
    setAuthModalTab("login");
    setIsAuthModalOpen(true);
  };

  const openRegister = () => {
    setAuthModalTab("register");
    setIsAuthModalOpen(true);
  };

  const handleBellClick = () => {
    toast.info("Notifications coming soon");
  };

  const { data: conversations } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.get("/messages/conversations").then((res) => res.data),
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  const unreadCount = useMemo(() =>
    conversations?.reduce((acc: number, curr: any) => acc + (curr.unread_count || 0), 0) || 0,
    [conversations]
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground font-bold text-lg shadow-card">
            H
          </div>
          <div className="leading-tight">
            <div className="font-bold text-foreground">HandyRwanda</div>
            <div className="text-[11px] font-medium tracking-wide text-muted-foreground">
              Akazi beza, ku gihe
            </div>
          </div>
        </Link>
        <nav className="hidden gap-1 md:flex">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
            activeProps={{
              className: "rounded-lg px-3 py-2 text-sm font-semibold text-foreground bg-muted",
            }}
          >
            Home
          </Link>
          <Link
            to="/search"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
            activeProps={{
              className: "rounded-lg px-3 py-2 text-sm font-semibold text-foreground bg-muted",
            }}
          >
            Browse
          </Link>
          <Link
            to="/messages"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground relative"
            activeProps={{
              className: "rounded-lg px-3 py-2 text-sm font-semibold text-foreground bg-muted",
            }}
          >
            Messages
            {unreadCount > 0 && (
              <span className="ml-1.5 rounded-full bg-accent text-[10px] font-bold px-1.5 py-0.5 text-accent-foreground">
                {unreadCount}
              </span>
            )}
          </Link>
          <Link
            to="/pro"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
            activeProps={{
              className: "rounded-lg px-3 py-2 text-sm font-semibold text-foreground bg-muted",
            }}
          >
            For Artisans
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/search"
            aria-label="Search"
            className="grid h-10 w-10 place-items-center rounded-full text-foreground hover:bg-muted md:hidden"
          >
            <Search className="h-5 w-5" />
          </Link>
          <button
            aria-label="Notifications"
            onClick={handleBellClick}
            className="relative hidden h-10 w-10 place-items-center rounded-full text-foreground hover:bg-muted sm:grid"
          >
            <Bell className="h-5 w-5" />
            {isAuthenticated && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent" />
            )}
          </button>

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
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    to={user?.role === "artisan" ? "/profile/portfolio" : "/"}
                    className="flex items-center gap-2 cursor-pointer w-full"
                  >
                    <UserIcon className="h-4 w-4" />
                    My Profile
                  </Link>
                </DropdownMenuItem>
                {user?.role === "artisan" && (
                  <DropdownMenuItem asChild>
                    <Link to="/pro" className="flex items-center gap-2 cursor-pointer w-full">
                      <LayoutDashboard className="h-4 w-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link to="/messages" className="flex items-center gap-2 cursor-pointer w-full">
                    <MessageSquare className="h-4 w-4" />
                    Messages
                    {unreadCount > 0 && (
                      <span className="ml-auto rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
                        {unreadCount}
                      </span>
                    )}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="#" className="flex items-center gap-2 cursor-pointer w-full">
                    <LayoutDashboard className="h-4 w-4 opacity-0" />
                    Settings
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer"
                  onClick={() => {
                    logout();
                    toast.success("Logged out successfully");
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={openLogin}>
                Log in
              </Button>
              <Button size="sm" onClick={openRegister}>
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
