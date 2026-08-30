import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

type SmartAdjustmentBadgeProps = {
  children: ReactNode;
  variant?: "info" | "success" | "subtle";
  className?: string;
};

const variantStyles = {
  info: "border-primary/20 bg-primary/5 text-primary",
  success: "border-success/25 bg-success/5 text-emerald-800",
  subtle: "border-slate-200 bg-slate-50 text-slate-600",
} as const;

export function SmartAdjustmentBadge({
  children,
  variant = "info",
  className = "",
}: SmartAdjustmentBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none ${variantStyles[variant]} ${className}`}
    >
      <Sparkles className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
      {children}
    </span>
  );
}
