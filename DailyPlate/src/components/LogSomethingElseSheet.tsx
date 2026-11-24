import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { RecipeImage } from "@/components/RecipeImage";
import { FoodPickConfirm } from "@/components/FoodPickConfirm";
import { FoodSearchPanel } from "@/components/FoodSearchPanel";
import { ScanButton } from "@/components/ScanButton";
import { ScanPanel } from "@/components/ScanPanel";
import type { FoodItem } from "@/utils/foodTypes";
import { foodLogFromFood } from "@/utils/foodSearch";
import { SLOT_LABELS } from "@/utils/planningPrefs";
import { allRecipes } from "@/recipes/recipePool";
import { useAppStore } from "@/store/useAppStore";
import type { MealTrackingEntry, PlannedMeal } from "@/types";
import { isBeverageRecipe } from "@/utils/beverages";
import { useOverlayBack } from "@/hooks/useOverlayBack";
import { foodLogFromRecipe, foodLogManual } from "@/utils/mealTracking";
import { recipeMatchesSearch } from "@/utils/recipeProteinSource";

export function LogSomethingElseSheet({
  dateKey,
  meal,
  onClose,
  onSave,
  bought,
}: {
  dateKey: string;
  meal: PlannedMeal;
  onClose: () => void;
  onSave: (entry: MealTrackingEntry) => void;
  /** A bought meal ("Log what you got"): no planned recipe to compare a scan with. */
  bought?: boolean;
}) {
  useOverlayBack(true, onClose);
  const [tab, setTab] = useState<"search" | "recipe" | "amounts">("search");
  const [picked, setPicked] = useState<FoodItem | null>(null);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const saveMyFood = useAppStore((s) => s.saveMyFood);
  const [query, setQuery] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const userRecipes = useAppStore((s) => s.userRecipes);

  const candidates = useMemo(() => {
    const library = allRecipes(userRecipes).filter((r) => !isBeverageRecipe(r));
    const q = query.trim();
    const pool = q ? library.filter((r) => recipeMatchesSearch(r, q)) : library;
    return [...pool]
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
      .slice(0, 40);
  }, [query, userRecipes]);

  function saveRecipe(recipeId: string) {
    const recipe = allRecipes(userRecipes).find((r) => r.id === recipeId);
    if (!recipe) return;
    onSave(foodLogFromRecipe(dateKey, meal.slot, recipe));
    onClose();
  }

  function saveAmounts() {
    const calories = Math.round(Number(kcal));
    const proteinG = Math.round(Number(protein));
    if (!(calories > 0) || !(proteinG >= 0) || Number.isNaN(proteinG)) return;
    onSave(foodLogManual(dateKey, meal.slot, calories, proteinG));
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[92] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-labelledby="something-else-title"
        className="relative z-[93] flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-3xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Ate something else
            </p>
            <h2 id="something-else-title" className="mt-0.5 text-lg font-bold text-slate-900">
              Log what you ate
            </h2>
            {!bought && <p className="mt-0.5 text-xs text-slate-400">Instead of {meal.recipe.name}</p>}
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

        {scanFile ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3">
            <ScanPanel
              file={scanFile}
              dateKey={dateKey}
              slot={meal.slot}
              mode="meal"
              plannedMeal={bought ? null : meal}
              target={meal.portion?.target ?? null}
              forLabel={`for ${SLOT_LABELS[meal.slot].toLowerCase()}`}
              onLog={(entry) => {
                onSave(entry);
                onClose();
              }}
              onDone={() => setScanFile(null)}
            />
          </div>
        ) : (
          <>
        <div className="px-4 pt-3">
          <ScanButton onPhoto={setScanFile} />
        </div>
        <div className="grid grid-cols-3 gap-1 px-4 pt-3">
          {(
            [
              ["search", "Search foods"],
              ["recipe", "A recipe"],
              ["amounts", "Amounts"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`min-h-[40px] rounded-xl text-sm font-semibold ${
                tab === id
                  ? "bg-[#2563EB] text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "search" ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3">
            {picked ? (
              <FoodPickConfirm
                food={picked}
                target={meal.portion?.target ?? null}
                forLabel={`for ${SLOT_LABELS[meal.slot].toLowerCase()}`}
                onBack={() => setPicked(null)}
                onLog={(servings, sized) => {
                  saveMyFood(sized);
                  onSave(foodLogFromFood(dateKey, meal.slot, sized, servings));
                  onClose();
                }}
              />
            ) : (
              <FoodSearchPanel onPick={setPicked} />
            )}
          </div>
        ) : tab === "recipe" ? (
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search recipes…"
                className="min-h-[44px] w-full bg-transparent text-sm outline-none"
              />
            </label>
            <ul className="mt-3 max-h-[50dvh] space-y-1 overflow-y-auto">
              {candidates.map((recipe) => (
                <li key={recipe.id}>
                  <button
                    type="button"
                    onClick={() => saveRecipe(recipe.id)}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-slate-50"
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                      <RecipeImage recipe={recipe} fill />
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        {recipe.name}
                      </span>
                      <span className="block text-xs tabular-nums text-slate-500">
                        {recipe.calories} kcal · P {recipe.protein}g
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-3 px-4 py-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Calories
              </span>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={kcal}
                onChange={(e) => setKcal(e.target.value)}
                placeholder="e.g. 420"
                className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-200 px-3 text-base font-semibold outline-none focus:border-[#2563EB]"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Protein (g)
              </span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                placeholder="e.g. 30"
                className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-200 px-3 text-base font-semibold outline-none focus:border-[#2563EB]"
              />
            </label>
            <button
              type="button"
              disabled={!(Number(kcal) > 0) || Number.isNaN(Number(protein))}
              onClick={saveAmounts}
              className="min-h-[48px] w-full rounded-xl bg-[#2563EB] text-sm font-semibold text-white disabled:opacity-40"
            >
              Save log
            </button>
          </div>
        )}
          </>
        )}
      </section>
    </div>
  );
}
