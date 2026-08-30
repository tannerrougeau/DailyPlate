export function MacroProgressBar({
  label,
  consumed,
  target,
  unit = "g",
  showRemaining = false,
}: {
  label: string;
  consumed: number;
  target: number;
  unit?: string;
  showRemaining?: boolean;
}) {
  const over = consumed > target;
  const pct = target > 0 ? Math.min(100, (consumed / target) * 100) : 0;
  const remaining = target - consumed;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        <span
          className={`text-sm font-semibold tabular-nums ${
            over ? "text-danger" : "text-success"
          }`}
        >
          {showRemaining
            ? `${Math.round(Math.abs(remaining))}${unit} ${over ? "over" : "left"}`
            : `${Math.round(consumed)}${unit} / ${Math.round(target)}${unit}`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${
            over ? "bg-danger" : "bg-success"
          }`}
          style={{ width: `${over ? 100 : pct}%` }}
        />
      </div>
    </div>
  );
}
