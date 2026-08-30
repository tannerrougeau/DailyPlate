export function LowComplexityGenerateToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-primary focus:ring-primary/30"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-800">Low complexity</span>
        <span className="block text-xs leading-snug text-slate-500">
          Fewer cooking days. Leftovers and simpler whole-food meals preferred.
        </span>
      </span>
    </label>
  );
}
