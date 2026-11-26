import type { DaySize } from "@/types";

const OPTIONS: { size: DaySize | null; label: string; aria: string }[] = [
  { size: 0.5, label: "½", aria: "Half size today" },
  { size: 0.75, label: "¾", aria: "Three-quarter size today" },
  { size: null, label: "Normal", aria: "Normal size today" },
];

export function daySizeText(size: DaySize | null | undefined): string {
  return size === 0.5 ? "½" : size === 0.75 ? "¾" : "Normal";
}

/** "Size today: ½ · ¾ · Normal". This day only; the recipe and other days don't change. */
export function DaySizeRow({
  value,
  onChoose,
}: {
  value: DaySize | null | undefined;
  onChoose: (size: DaySize | null) => void;
}) {
  const current = value ?? null;
  return (
    <div className="rounded-2xl px-3 py-2">
      <p className="text-sm font-semibold text-slate-900">Size today</p>
      <p className="text-xs text-slate-500">This day only. The rest moves to your other meals today.</p>
      <div className="mt-2 flex gap-2" role="group" aria-label="Size today">
        {OPTIONS.map((o) => {
          const on = current === o.size;
          return (
            <button
              key={o.label}
              type="button"
              aria-pressed={on}
              aria-label={o.aria}
              onClick={() => onChoose(o.size)}
              className={`min-h-[40px] flex-1 rounded-xl border-2 text-sm font-semibold ${
                on ? "border-[#2563EB] bg-blue-50 text-blue-900" : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
