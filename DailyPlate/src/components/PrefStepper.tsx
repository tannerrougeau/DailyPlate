export function PrefStepper({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  recommended,
  formatValue,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
  recommended?: number;
  formatValue?: (n: number) => string;
  hint?: string;
}) {
  const display = formatValue ? formatValue(value) : String(value);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          {recommended != null && value === recommended && (
            <p className="text-xs font-medium text-[#2563EB]">Recommended</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`Decrease ${label.toLowerCase()}`}
            disabled={value <= min}
            onClick={() => onChange(Math.max(min, value - step))}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-lg font-semibold text-slate-700 disabled:opacity-30"
          >
            −
          </button>
          <span className="min-w-[2.5rem] text-center text-lg font-bold tabular-nums text-slate-900">
            {display}
          </span>
          <button
            type="button"
            aria-label={`Increase ${label.toLowerCase()}`}
            disabled={value >= max}
            onClick={() => onChange(Math.min(max, value + step))}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-lg font-semibold text-slate-700 disabled:opacity-30"
          >
            +
          </button>
        </div>
      </div>
      {hint && <p className="px-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
