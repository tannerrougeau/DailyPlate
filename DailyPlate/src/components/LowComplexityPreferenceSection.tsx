export function LowComplexityPreferenceSection({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <h3 className="text-base font-semibold text-slate-900">Low complexity</h3>
      <p className="text-sm text-slate-600">
        Fewer cooking days. Leftovers and simpler whole-food meals preferred.
      </p>
      {/* Future: a dedicated low-complexity vs detailed generate mode. This flag is the interim setting. */}
      <button
        type="button"
        onClick={() => onChange(!enabled)}
        className={`min-h-[48px] w-full rounded-2xl border-2 px-4 text-left text-sm font-semibold transition-colors ${
          enabled
            ? "border-primary bg-primary/5 text-primary"
            : "border-slate-200 bg-white text-slate-800"
        }`}
      >
        {enabled ? "Low complexity on" : "Enable low complexity"}
      </button>
    </section>
  );
}
