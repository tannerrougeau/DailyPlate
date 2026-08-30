import { Shuffle } from "lucide-react";

export function GenerateDayButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl py-4 text-lg font-semibold text-white shadow-md transition-colors hover:opacity-95 active:opacity-90"
      style={{ backgroundColor: "#2563EB", boxShadow: "0 8px 24px rgba(37, 99, 235, 0.28)" }}
    >
      <Shuffle className="h-6 w-6 shrink-0 text-white" aria-hidden strokeWidth={2.25} />
      Generate Day Plan
    </button>
  );
}
