import type { MealTimingPreference } from "@/types/profile";

export const MEAL_TIMING_OPTIONS: { id: MealTimingPreference; label: string; hint: string }[] = [
  { id: "light_breakfast", label: "Light breakfast", hint: "Smaller AM meals, calories later" },
  { id: "balanced", label: "Balanced", hint: "Even distribution across the day" },
  { id: "bigger_dinner", label: "Bigger dinner", hint: "More calories in the evening" },
];

export function MealTimingPreferenceSection({
  value,
  onChange,
}: {
  value: MealTimingPreference | null;
  onChange: (value: MealTimingPreference | null) => void;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-slate-900">Meal timing</h3>
        <p className="mt-1 text-sm text-slate-600">
          Where you prefer calories across breakfast, lunch, and dinner.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {MEAL_TIMING_OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(value === o.id ? null : o.id)}
            className={`rounded-2xl border-2 px-4 py-3 text-left transition-colors ${
              value === o.id
                ? "border-primary bg-primary/5 text-primary"
                : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
            }`}
          >
            <span className="block text-sm font-semibold">{o.label}</span>
            <span className="mt-0.5 block text-xs text-slate-500">{o.hint}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
