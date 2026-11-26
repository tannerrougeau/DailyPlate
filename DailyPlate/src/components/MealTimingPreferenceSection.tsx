import type { RecipeMealSlotId } from "@/types";
import type { MealSize, MealSizes, MealSourceSlot } from "@/types/profile";

const SIZE_OPTIONS: { id: MealSize; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "normal", label: "Normal" },
  { id: "large", label: "Large" },
];

const MEALS: MealSourceSlot[] = ["breakfast", "lunch", "dinner"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Normal is the default, so it isn't stored. */
export function setMealSize(sizes: MealSizes, slot: MealSourceSlot, size: MealSize): MealSizes {
  const next = { ...sizes };
  if (size === "normal") delete next[slot];
  else next[slot] = size;
  return next;
}

/**
 * Light / Normal / Large for each meal you eat. Light is about 0.6x the usual share and Large about
 * 1.4x; the difference moves to your other meals (and snacks, when a meal is skipped).
 */
export function MealSizesSection({
  value,
  onChange,
  eatenMeals,
  hideTitle = false,
}: {
  value: MealSizes;
  onChange: (value: MealSizes) => void;
  eatenMeals: RecipeMealSlotId[];
  hideTitle?: boolean;
}) {
  const meals = MEALS.filter((m) => eatenMeals.includes(m));
  return (
    <section className="space-y-3">
      {!hideTitle && (
        <div>
          <h3 className="text-base font-semibold text-slate-900">Meal sizes</h3>
          <p className="mt-1 text-sm text-slate-600">
            Light meals are smaller; the rest of the day moves to your other meals.
          </p>
        </div>
      )}
      <div className="space-y-2.5">
        {meals.map((slot) => {
          const current = value[slot] ?? "normal";
          return (
            <div key={slot} className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-slate-800">{cap(slot)}</span>
              <div className="flex gap-1.5" role="group" aria-label={`${cap(slot)} size`}>
                {SIZE_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={current === o.id}
                    onClick={() => onChange(setMealSize(value, slot, o.id))}
                    className={`min-h-[40px] rounded-xl border-2 px-3 text-sm font-semibold ${
                      current === o.id
                        ? "border-[#2563EB] bg-blue-50 text-blue-900"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
