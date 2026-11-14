import type { ReactNode } from "react";
import {
  Info,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type BadgeVariant = "safe" | "suspicious" | "scam" | "neutral";

interface BadgeProps {
  variant?: BadgeVariant;
  children?: ReactNode;
  className?: string;
}

const variants = {
  safe: {
    Icon: ShieldCheck,
    label: "Safe",
    className: "border-status-safe/25 bg-status-safe/10 text-status-safe",
  },
  suspicious: {
    Icon: TriangleAlert,
    label: "Suspicious",
    className:
      "border-status-suspicious/25 bg-status-suspicious/10 text-status-suspicious",
  },
  scam: {
    Icon: ShieldAlert,
    label: "Scam",
    className: "border-status-scam/25 bg-status-scam/10 text-status-scam",
  },
  neutral: {
    Icon: Info,
    label: "Info",
    className: "border-border bg-surface/70 text-muted",
  },
} satisfies Record<
  BadgeVariant,
  { Icon: typeof Info; label: string; className: string }
>;

export function Badge({
  variant = "neutral",
  children,
  className,
}: BadgeProps) {
  const { Icon, label, className: variantClassName } = variants[variant];

  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        variantClassName,
        className,
      )}
    >
      <Icon aria-hidden="true" size={14} strokeWidth={2.2} />
      <span>{children ?? label}</span>
    </span>
  );
}
