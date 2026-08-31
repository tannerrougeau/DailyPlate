import { Shuffle } from "lucide-react";

export function GenerateDayButton({
  onClick,
  label = "Regenerate today",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-semibold text-white shadow-md transition-colors hover:opacity-95 active:opacity-90"
      style={{ backgroundColor: "#2563EB", boxShadow: "0 8px 24px rgba(37, 99, 235, 0.28)" }}
    >
      <Shuffle className="h-5 w-5 shrink-0 text-white" aria-hidden strokeWidth={2.25} />
      {label}
    </button>
  );
}
