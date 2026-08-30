export function MinimalPrepPreferenceSection({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <h3 className="text-base font-semibold text-slate-900">Quick & minimal prep</h3>
      <p className="text-sm text-slate-600">
        Prioritize no-cook and low-prep recipes (under ~20–30 min) when building your plan.
      </p>
      <button
        type="button"
        onClick={() => onChange(!enabled)}
        className={`min-h-[48px] w-full rounded-2xl border-2 px-4 text-left text-sm font-semibold transition-colors ${
          enabled
            ? "border-primary bg-primary/5 text-primary"
            : "border-slate-200 bg-white text-slate-800"
        }`}
      >
        {enabled ? "Minimal prep priority on" : "Enable minimal prep priority"}
      </button>
    </section>
  );
}
