import type { KitchenEquipmentId, MealSlotId } from "@/types";
import type { IngredientVariety, SnackStyle } from "@/types/profile";
import {
  DEFAULT_COOKING_EVENTS,
  DEFAULT_INGREDIENT_VARIETY,
  DEFAULT_KITCHEN_EQUIPMENT,
  DEFAULT_LEFTOVER_STREAK,
  DEFAULT_MAX_PREP_MINUTES,
  DEFAULT_SHOPPING_TRIPS,
  DEFAULT_SNACK_STYLE,
  DEFAULT_WEEKLY_PREP_SLOT,
  PROTEIN_SOURCE_PREF_OPTIONS,
} from "@/utils/planningPrefs";

function toggleId<T extends string>(list: T[], id: T): T[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export type PlanningPrefsValue = {
  shoppingTripsPerWeek: number;
  cookingEventsPerWeek: number;
  maxLeftoverStreakDays: number;
  ingredientVariety: IngredientVariety;
  maxPrepMinutes: number | null;
  weeklyMealPrepSlot: MealSlotId | null;
  snackStyle: SnackStyle;
  preferredProteinSources: string[];
  avoidedProteinSources: string[];
  foodsToAvoid: string;
  kitchenEquipment: KitchenEquipmentId[];
};

export function defaultPlanningPrefsValue(): PlanningPrefsValue {
  return {
    shoppingTripsPerWeek: DEFAULT_SHOPPING_TRIPS,
    cookingEventsPerWeek: DEFAULT_COOKING_EVENTS,
    maxLeftoverStreakDays: DEFAULT_LEFTOVER_STREAK,
    ingredientVariety: DEFAULT_INGREDIENT_VARIETY,
    maxPrepMinutes: DEFAULT_MAX_PREP_MINUTES,
    weeklyMealPrepSlot: DEFAULT_WEEKLY_PREP_SLOT,
    snackStyle: DEFAULT_SNACK_STYLE,
    preferredProteinSources: [],
    avoidedProteinSources: [],
    foodsToAvoid: "",
    kitchenEquipment: [...DEFAULT_KITCHEN_EQUIPMENT],
  };
}

/** Food-side preferences. Cooking cadence lives in CookingShoppingSection. */
export function PlanningPrefsSection({
  value,
  onChange,
}: {
  value: PlanningPrefsValue;
  onChange: (next: PlanningPrefsValue) => void;
}) {
  function patch(partial: Partial<PlanningPrefsValue>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-900">Snack style</h3>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "whole_food" as const, label: "Whole-food" },
              { id: "packaged" as const, label: "Packaged" },
              { id: "both" as const, label: "Both" },
            ] as const
          ).map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => patch({ snackStyle: o.id })}
              className={`min-h-[44px] rounded-full border-2 px-4 text-sm font-semibold ${
                value.snackStyle === o.id
                  ? "border-[#2563EB] bg-blue-50 text-blue-900"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-900">Preferred protein sources</h3>
        <p className="text-sm text-slate-500">Leave empty to use everything.</p>
        <div className="flex flex-wrap gap-2">
          {PROTEIN_SOURCE_PREF_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() =>
                patch({ preferredProteinSources: toggleId(value.preferredProteinSources, o.id) })
              }
              className={`min-h-[44px] rounded-full border-2 px-3.5 text-sm font-semibold ${
                value.preferredProteinSources.includes(o.id)
                  ? "border-[#2563EB] bg-blue-50 text-blue-900"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-900">Protein sources to avoid</h3>
        <div className="flex flex-wrap gap-2">
          {PROTEIN_SOURCE_PREF_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() =>
                patch({ avoidedProteinSources: toggleId(value.avoidedProteinSources, o.id) })
              }
              className={`min-h-[44px] rounded-full border-2 px-3.5 text-sm font-semibold ${
                value.avoidedProteinSources.includes(o.id)
                  ? "border-rose-400 bg-rose-50 text-rose-900"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">
            Other foods to avoid
          </span>
          <input
            type="text"
            value={value.foodsToAvoid}
            onChange={(e) => patch({ foodsToAvoid: e.target.value })}
            placeholder="e.g. mushrooms, olives, pork"
            className="min-h-[48px] w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#2563EB]"
          />
        </label>
      </section>
    </div>
  );
}
