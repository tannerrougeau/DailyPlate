import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { RecipeImage } from "@/components/RecipeImage";
import { fromDateKey } from "@/utils/date";
import { allRecipes } from "@/recipes/recipePool";
import { useAppStore } from "@/store/useAppStore";
import type { PlannedMeal } from "@/types";
import { mealDisplayName } from "@/utils/recipeDisplay";
import { recipeMatchesSearch } from "@/utils/recipeProteinSource";
import { isBeverageRecipe, recipeFitsSlot } from "@/utils/generateDayPlan";
import { useOverlayBack } from "@/hooks/useOverlayBack";
import { closestFitRecipes, type RecipeFit } from "@/utils/macroRedistribution";
import { SLOT_LABELS } from "@/utils/planningPrefs";

const slotLabel = SLOT_LABELS;

export function ReplaceMealSheet({
  meal,
  dateKey,
  excludeRecipeIds,
  closestFit = false,
  onClose,
  onSelect,
}: {
  meal: PlannedMeal;
  dateKey: string;
  excludeRecipeIds: Set<string>;
  /** Opened from "Swap meal": list the closest fits for this slot's target first. */
  closestFit?: boolean;
  onClose: () => void;
  onSelect: (recipeId: string) => void;
}) {
  useOverlayBack(true, onClose);
  const [query, setQuery] = useState("");
  const userRecipes = useAppStore((s) => s.userRecipes);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    const library = allRecipes(userRecipes).filter((r) => !isBeverageRecipe(r));
    let pool = library.filter(
      (r) => recipeFitsSlot(r, meal.slot) && r.id !== meal.recipe.id,
    );
    pool = [...pool].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
    if (pool.length === 0) {
      pool = library.filter((r) => r.id !== meal.recipe.id);
    }
    if (!q) return pool;
    return pool.filter((r) => recipeMatchesSearch(r, q));
  }, [meal.recipe.id, meal.slot, query, userRecipes]);

  const fits = useMemo(() => {
    const target = meal.portion?.target;
    if (!closestFit || !target) return new Map<string, RecipeFit>();
    const library = allRecipes(userRecipes);
    const exclude = new Set([...excludeRecipeIds, meal.recipe.id]);
    return new Map(
      closestFitRecipes(library, meal.slot, target, exclude).map((c) => [c.recipe.id, c.fit] as const),
    );
  }, [closestFit, meal.portion?.target, meal.recipe.id, meal.slot, excludeRecipeIds, userRecipes]);

  const ordered = useMemo(() => {
    if (fits.size === 0 || query.trim()) return candidates;
    const top = [...fits.keys()]
      .map((id) => candidates.find((r) => r.id === id))
      .filter((r): r is NonNullable<typeof r> => r != null);
    return [...top, ...candidates.filter((r) => !fits.has(r.id))];
  }, [candidates, fits, query]);

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
          {ordered.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-slate-500">No matching recipes.</li>
          ) : (
            ordered.map((recipe) => {
              const alreadyPlanned = excludeRecipeIds.has(recipe.id);
              const fit = query.trim() ? undefined : fits.get(recipe.id);
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
                      {fit && (
                        <p className="mt-1 text-[11px] font-medium text-emerald-800">
                          {fitLabel(fit)}
                        </p>
                      )}
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

function fitLabel(fit: RecipeFit): string {
  if (fit.fits) return "Fits your target";
  const gap = Math.round(Math.abs(fit.kcalGap) / 10) * 10;
  return fit.kcalGap < 0 ? `Closest fit · about ${gap} kcal under` : `Closest fit · about ${gap} kcal over`;
}
