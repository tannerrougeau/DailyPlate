import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { RecipeImage } from "@/components/RecipeImage";
import { fromDateKey } from "@/utils/date";
import { allRecipes } from "@/recipes/recipePool";
import { useAppStore } from "@/store/useAppStore";
import type { MealSlotId, PlannedMeal } from "@/types";
import { mealDisplayName } from "@/utils/recipeDisplay";
import { useOverlayBack } from "@/hooks/useOverlayBack";

const slotLabel: Record<MealSlotId, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export function ReplaceMealSheet({
  meal,
  dateKey,
  excludeRecipeIds,
  onClose,
  onSelect,
}: {
  meal: PlannedMeal;
  dateKey: string;
  excludeRecipeIds: Set<string>;
  onClose: () => void;
  onSelect: (recipeId: string) => void;
}) {
  useOverlayBack(true, onClose);
  const [query, setQuery] = useState("");
  const userRecipes = useAppStore((s) => s.userRecipes);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    const library = allRecipes(userRecipes);
    let pool = library.filter(
      (r) => r.mealSlots.includes(meal.slot) && r.id !== meal.recipe.id,
    );
    if (pool.length === 0) {
      pool = library.filter((r) => r.id !== meal.recipe.id);
    }
    if (!q) return pool;
    return pool.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.cuisine.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [meal.recipe.id, meal.slot, query, userRecipes]);

  return (
    <div className="fixed inset-0 z-[92] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-labelledby="replace-meal-title"
        className="relative z-[93] flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-3xl"
      >
        <div className="shrink-0 border-b border-slate-100 p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Replace {slotLabel[meal.slot].toLowerCase()}
              </p>
              <h2 id="replace-meal-title" className="mt-0.5 text-lg font-bold text-slate-900">
                {mealDisplayName(meal)}
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Syncs to Plan and Grocery for{" "}
                {fromDateKey(dateKey).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search recipes…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              autoFocus
            />
          </div>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto p-2">
          {candidates.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-slate-500">No matching recipes.</li>
          ) : (
            candidates.map((recipe) => {
              const alreadyPlanned = excludeRecipeIds.has(recipe.id);
              return (
                <li key={recipe.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(recipe.id);
                      onClose();
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-slate-50"
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                      <RecipeImage recipe={recipe} aspect="square" className="h-full w-full" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-bold text-slate-900">{recipe.name}</p>
                      <p className="mt-0.5 text-xs capitalize text-slate-400">
                        {recipe.cuisine} · {Math.round(recipe.calories)} kcal
                      </p>
                      {alreadyPlanned && (
                        <p className="mt-1 text-[10px] font-medium text-amber-700">
                          Already on this day
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </section>
    </div>
  );
}
