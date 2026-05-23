import { Link } from "@tanstack/react-router";
import { Search, Bell, User } from "lucide-react";

export function Header() {
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
            className="relative hidden h-10 w-10 place-items-center rounded-full text-foreground hover:bg-muted sm:grid"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent" />
          </button>
          <button
            aria-label="Account"
            className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary font-bold"
          >
            <User className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
