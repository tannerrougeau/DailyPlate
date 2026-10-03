import type { PlanningPrefsValue } from "@/components/PlanningPrefsSection";
import { PrefStepper } from "@/components/PrefStepper";
import {
  DEFAULT_COOKING_EVENTS,
  DEFAULT_LEFTOVER_STREAK,
  DEFAULT_MAX_PREP_MINUTES,
  DEFAULT_SHOPPING_TRIPS,
  KITCHEN_EQUIPMENT_OPTIONS,
  deriveCookingFlags,
} from "@/utils/planningPrefs";

function toggleId<T extends string>(list: T[], id: T): T[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function CookingShoppingSection({
  value,
  onChange,
  hideTitle = false,
}: {
  value: PlanningPrefsValue;
  onChange: (next: PlanningPrefsValue) => void;
  hideTitle?: boolean;
}) {
  function patch(partial: Partial<PlanningPrefsValue>) {
    onChange({ ...value, ...partial });
  }

  const flags = deriveCookingFlags({
    cookingEventsPerWeek: value.cookingEventsPerWeek,
    maxLeftoverStreakDays: value.maxLeftoverStreakDays,
    maxPrepMinutes: value.maxPrepMinutes,
    weeklyMealPrepSlot: value.weeklyMealPrepSlot,
  });

  const prepValue = value.maxPrepMinutes ?? 90;

  return (
    <div className="space-y-5">
      {!hideTitle && (
        <section className="space-y-1">
          <h3 className="text-lg font-semibold text-slate-900">Cooking &amp; shopping</h3>
          <p className="text-sm text-slate-500">
            These answers set how repetitive your week is.
          </p>
        </section>
      )}

      <PrefStepper
        label="Shopping trips per week"
        value={value.shoppingTripsPerWeek}
        min={1}
        max={7}
        recommended={DEFAULT_SHOPPING_TRIPS}
        onChange={(n) => patch({ shoppingTripsPerWeek: n })}
        hint="One trip keeps the grocery list tight."
      />

      <PrefStepper
        label="Cooking events per week"
        value={value.cookingEventsPerWeek}
        min={2}
        max={7}
        recommended={DEFAULT_COOKING_EVENTS}
        onChange={(n) => patch({ cookingEventsPerWeek: n })}
        hint="3–5 cooks (4) feeds leftovers."
      />

      {flags.weeklyMealPrepEnabled && (
        <section className="space-y-2">
          <p className="text-sm font-semibold text-slate-900">Batch which meal?</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: "lunch" as const, label: "Lunch" },
                { id: "dinner" as const, label: "Dinner" },
              ] as const
            ).map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => patch({ weeklyMealPrepSlot: o.id })}
                className={`min-h-[44px] rounded-full border-2 px-4 text-sm font-semibold ${
                  flags.weeklyMealPrepSlot === o.id
                    ? "border-[#2563EB] bg-blue-50 text-blue-900"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </section>
      )}

      <PrefStepper
        label="Same leftovers in a row"
        value={value.maxLeftoverStreakDays}
        min={1}
        max={5}
        recommended={DEFAULT_LEFTOVER_STREAK}
        onChange={(n) => patch({ maxLeftoverStreakDays: n })}
        formatValue={(n) => `${n}d`}
      />

      <div className="space-y-2">
        <PrefStepper
          label="Max prep time per cook"
          value={prepValue}
          min={15}
          max={90}
          step={15}
          recommended={DEFAULT_MAX_PREP_MINUTES}
          onChange={(n) => patch({ maxPrepMinutes: n })}
          formatValue={(n) => (value.maxPrepMinutes == null ? "—" : `${n}m`)}
        />
        <button
          type="button"
          onClick={() => patch({ maxPrepMinutes: value.maxPrepMinutes == null ? DEFAULT_MAX_PREP_MINUTES : null })}
          className={`min-h-[40px] rounded-full border-2 px-4 text-xs font-semibold ${
            value.maxPrepMinutes == null
              ? "border-[#2563EB] bg-blue-50 text-blue-900"
              : "border-slate-200 bg-white text-slate-700"
          }`}
        >
          No limit
        </button>
      </div>

      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-900">Ingredient variety</h4>
        <div className="flex flex-col gap-2">
          {(
            [
              {
                id: "minimal" as const,
                label: "Minimal",
                description: "Shorter grocery list, overlapping ingredients",
                recommended: true,
              },
              {
                id: "varied" as const,
                label: "Varied",
                description: "More different ingredients across the week",
                recommended: false,
              },
            ] as const
          ).map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => patch({ ingredientVariety: o.id })}
              className={`rounded-2xl border-2 px-4 py-3 text-left ${
                value.ingredientVariety === o.id
                  ? "border-[#2563EB] bg-blue-50 text-blue-900"
                  : "border-slate-200 bg-white text-slate-800"
              }`}
            >
              <span className="block text-sm font-semibold">
                {o.label}
                {o.recommended ? " · Recommended" : ""}
              </span>
              <span className="mt-0.5 block text-xs font-normal text-slate-600">{o.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-900">Kitchen equipment</h4>
        <div className="flex flex-wrap gap-2">
          {KITCHEN_EQUIPMENT_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() =>
                patch({ kitchenEquipment: toggleId(value.kitchenEquipment, o.id) })
              }
              className={`min-h-[44px] rounded-full border-2 px-3.5 text-sm font-semibold ${
                value.kitchenEquipment.includes(o.id)
                  ? "border-[#2563EB] bg-blue-50 text-blue-900"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
