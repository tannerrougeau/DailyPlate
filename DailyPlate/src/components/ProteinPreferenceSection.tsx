import type { MainGoal, ProteinPreference } from "@/types/profile";
import type { RecipeMealSlotId } from "@/types";
import { PROTEIN_PREFERENCE_OPTIONS } from "@/utils/planningPrefs";
import {
  goalLinkedProteinGrams,
  proteinGramsPerMealEquivalent,
} from "@/utils/proteinMinimum";

export function ProteinPreferenceSection({
  value,
  onChange,
  goal,
  weightKg,
  heightCm,
  eatenMeals,
  snacksPerDay,
}: {
  value: ProteinPreference;
  onChange: (next: ProteinPreference) => void;
  goal: MainGoal | null;
  weightKg: number;
  heightCm: number;
  eatenMeals: RecipeMealSlotId[];
  snacksPerDay: number;
}) {
  const canCompute = weightKg > 0 && heightCm > 0 && goal != null;

  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold text-slate-900">Protein preference</h3>
      <div className="flex flex-col gap-2">
        {PROTEIN_PREFERENCE_OPTIONS.map((o) => {
          const daily = canCompute
            ? goalLinkedProteinGrams({
                goal,
                preference: o.id,
                weightKg,
                heightCm,
              })
            : null;
          const selected = value === o.id;
          const perMeal =
            selected && daily != null
              ? proteinGramsPerMealEquivalent(daily, eatenMeals.length, snacksPerDay)
              : null;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              className={`rounded-2xl border-2 px-4 py-3 text-left ${
                selected
                  ? "border-[#2563EB] bg-blue-50 text-blue-900"
                  : "border-slate-200 bg-white text-slate-800"
              }`}
            >
              <span className="block text-base font-semibold">
                {o.label}
                {daily != null ? ` — about ${daily} g/day` : ""}
              </span>
              {perMeal != null && (
                <span className="mt-0.5 block text-sm font-normal text-slate-600">
                  About {perMeal} g per meal
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-xs leading-relaxed text-slate-500">
        If you have kidney disease, check with your clinician before choosing a higher protein
        target.
      </p>
    </section>
  );
}
