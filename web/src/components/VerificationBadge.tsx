// File: web/src/components/VerificationBadge.tsx
import { ShieldCheck, Clock, XCircle, Award } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "unverified" | "pending" | "id_verified" | "pro_verified" | "rejected";

export function VerificationBadge({ status, className }: { status: Status; className?: string }) {
  const configs = {
    unverified: {
      icon: null,
      label: null,
      color: "",
    },
    pending: {
      icon: <Clock className="h-3 w-3" />,
      label: "Pending",
      color: "bg-muted text-muted-foreground border-border",
    },
    id_verified: {
      icon: <ShieldCheck className="h-3 w-3" />,
      label: "ID Verified",
      color:
        "bg-[color:var(--verified)]/10 text-[color:var(--verified)] border-[color:var(--verified)]/20",
    },
    pro_verified: {
      icon: <Award className="h-3 w-3" />,
      label: "Pro",
      color: "bg-accent/10 text-accent border-accent/20",
    },
    rejected: {
      icon: <XCircle className="h-3 w-3" />,
      label: "Rejected",
      color: "bg-danger/10 text-danger border-danger/20",
    },
  };

  const config = configs[status];
  if (!config.label) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        config.color,
        className,
      )}
    >
      {config.icon}
      {config.label}
    </span>
  );
}
