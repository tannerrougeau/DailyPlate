import { Shuffle } from "lucide-react";

export function GenerateDayButton({
  onClick,
  label = "Regenerate Today",
  compact = false,
}: {
  onClick: () => void;
  label?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        compact
          ? "inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 active:opacity-90"
          : "flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-semibold text-white shadow-md transition-colors hover:opacity-95 active:opacity-90"
      }
      style={{
        backgroundColor: "#2563EB",
        boxShadow: compact
          ? "0 4px 12px rgba(37, 99, 235, 0.22)"
          : "0 8px 24px rgba(37, 99, 235, 0.28)",
      }}
    >
      <Shuffle
        className={compact ? "h-4 w-4 shrink-0 text-white" : "h-5 w-5 shrink-0 text-white"}
        aria-hidden
        strokeWidth={2.25}
      />
      {label}
    </button>
  );
}
