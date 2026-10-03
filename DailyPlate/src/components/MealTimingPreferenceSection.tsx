import { useEffect } from "react";
import type { RecipeMealSlotId } from "@/types";
import type { MealTimingPreference } from "@/types/profile";
import { isMealTimingAllowed } from "@/utils/planningPrefs";

export const MEAL_TIMING_OPTIONS: { id: MealTimingPreference; label: string; hint: string }[] = [
  { id: "light_breakfast", label: "Light breakfast", hint: "Smaller AM meals, calories later" },
  { id: "balanced", label: "Balanced", hint: "Even distribution across the day" },
  { id: "bigger_dinner", label: "Bigger dinner", hint: "More calories in the evening" },
];

export function MealTimingPreferenceSection({
  value,
  onChange,
  eatenMeals,
}: {
  value: MealTimingPreference | null;
  onChange: (value: MealTimingPreference | null) => void;
  eatenMeals: RecipeMealSlotId[];
}) {
  const options = MEAL_TIMING_OPTIONS.filter((o) => isMealTimingAllowed(o.id, eatenMeals));

  useEffect(() => {
    if (!isMealTimingAllowed(value, eatenMeals)) onChange(null);
  }, [value, eatenMeals, onChange]);

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-slate-900">Meal timing</h3>
        <p className="mt-1 text-sm text-slate-600">
          Where you prefer calories across the meals you eat.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {options.map((o) => (
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
