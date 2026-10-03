import type { RecipeMealSlotId } from "@/types";
import { PrefStepper } from "@/components/PrefStepper";
import { DEFAULT_SNACKS_PER_DAY, MAIN_MEAL_SLOTS, SLOT_LABELS } from "@/utils/planningPrefs";

export function MealPatternSection({
  eatenMeals,
  snacksPerDay,
  onEatenMealsChange,
  onSnacksPerDayChange,
  compact = false,
}: {
  eatenMeals: RecipeMealSlotId[];
  snacksPerDay: number;
  onEatenMealsChange: (next: RecipeMealSlotId[]) => void;
  onSnacksPerDayChange: (next: number) => void;
  compact?: boolean;
}) {
  function toggleMeal(id: RecipeMealSlotId) {
    if (eatenMeals.includes(id)) {
      const next = eatenMeals.filter((s) => s !== id);
      if (next.length === 0) return;
      onEatenMealsChange(next);
      return;
    }
    onEatenMealsChange(
      MAIN_MEAL_SLOTS.filter((s) => s === id || eatenMeals.includes(s)),
    );
  }

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h2 className={compact ? "text-lg font-semibold text-slate-900" : "text-2xl font-bold text-slate-900"}>Which meals do you eat?</h2>
        <p className="text-slate-600">Pick breakfast, lunch, and/or dinner.</p>
        <div className="flex flex-col gap-2">
          {MAIN_MEAL_SLOTS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => toggleMeal(id)}
              className={`min-h-[52px] rounded-2xl border-2 px-4 text-left text-base font-semibold ${
                eatenMeals.includes(id)
                  ? "border-[#2563EB] bg-blue-50 text-blue-900"
                  : "border-slate-200 bg-white text-slate-800"
              }`}
            >
              {SLOT_LABELS[id]}
            </button>
          ))}
        </div>
      </section>
      <PrefStepper
        label="Snacks per day"
        value={snacksPerDay}
        min={0}
        max={3}
        recommended={DEFAULT_SNACKS_PER_DAY}
        onChange={onSnacksPerDayChange}
      />
    </div>
  );
}
