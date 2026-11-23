import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { AdjustServingsSheet } from "@/components/AdjustServingsSheet";
import { FoodPickConfirm } from "@/components/FoodPickConfirm";
import { FoodSearchPanel } from "@/components/FoodSearchPanel";
import type { FoodItem } from "@/utils/foodTypes";
import { foodToSnackItem } from "@/utils/foodSearch";
import { useOverlayBack } from "@/hooks/useOverlayBack";
import { allRecipes } from "@/recipes/recipePool";
import { useAppStore } from "@/store/useAppStore";
import type { MealTrackingEntry } from "@/types";
import { isBeverageRecipe } from "@/utils/beverages";
import {
  commonSnackItems,
  recentSnacks,
  snackItemFromRecipe,
  snackItemFromSaved,
  snackLogEntry,
  type SnackItem,
} from "@/utils/snackItems";

/** Log a snack as it's eaten: Recent, Saved, Common items, Snack recipes, or a custom entry. */
export function AddSnackSheet({
  dateKey,
  remaining,
  onClose,
  onLogged,
}: {
  dateKey: string;
  /** Calories and protein left today, for the fit line after picking a found food. */
  remaining?: { calories: number; protein: number };
  onClose: () => void;
  onLogged: (entry: MealTrackingEntry) => void;
}) {
  useOverlayBack(true, onClose);
  const snackLogs = useAppStore((s) => s.snackLogs);
  const savedSnacks = useAppStore((s) => s.savedSnacks);
  const userRecipes = useAppStore((s) => s.userRecipes);
  const saveSnack = useAppStore((s) => s.saveSnack);
  const saveMyFood = useAppStore((s) => s.saveMyFood);
  const [picked, setPicked] = useState<FoodItem | null>(null);
  const [adjusting, setAdjusting] = useState<SnackItem | null>(null);
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [saveForReuse, setSaveForReuse] = useState(true);

  const recent = useMemo(() => recentSnacks(snackLogs), [snackLogs]);
  const saved = useMemo(() => savedSnacks.map(snackItemFromSaved), [savedSnacks]);
  const common = useMemo(() => commonSnackItems(), []);
  const recipes = useMemo(
    () =>
      allRecipes(userRecipes)
        .filter((r) => r.mealSlots.includes("snack") && !isBeverageRecipe(r))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
        .map(snackItemFromRecipe),
    [userRecipes],
  );

  function log(item: SnackItem, servings = 1) {
    onLogged(snackLogEntry(dateKey, item, servings));
    onClose();
  }

  const customOk = name.trim() !== "" && Number(kcal) > 0 && Number(protein) >= 0 && protein.trim() !== "";

  function logCustom() {
    if (!customOk) return;
    const snack = {
      name: name.trim(),
      calories: Math.round(Number(kcal)),
      protein: Math.round(Number(protein)),
      carbs: carbs.trim() ? Math.round(Number(carbs)) : undefined,
      fat: fat.trim() ? Math.round(Number(fat)) : undefined,
    };
    const item = saveForReuse ? snackItemFromSaved(saveSnack(snack)) : snackItemFromSaved({ ...snack, id: "custom" });
    log(item, 1);
  }

  const sections: [string, SnackItem[]][] = [
    ["Recent", recent],
    ["Saved", saved],
    ["Common items", common],
    ["Snack recipes", recipes],
  ];

  return (
    <div className="fixed inset-0 z-[92] flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <section
        role="dialog"
        aria-labelledby="add-snack-title"
        className="relative z-[93] flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-3xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Today</p>
            <h2 id="add-snack-title" className="mt-0.5 text-lg font-bold text-slate-900">
              Add snack
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">Tap to log 1 serving.</p>
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

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <div className="mt-3">
            {picked ? (
              <FoodPickConfirm
                food={picked}
                target={remaining ?? null}
                forLabel="for what's left today"
                onBack={() => setPicked(null)}
                onLog={(servings) => {
                  saveMyFood(picked);
                  log(foodToSnackItem(picked), servings);
                }}
              />
            ) : (
              <FoodSearchPanel onPick={setPicked} />
            )}
          </div>
          {sections
            .filter(([, items]) => items.length > 0)
            .map(([title, items]) => (
              <div key={title} className="mt-3">
                <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
                <ul className="mt-1 divide-y divide-slate-100">
                  {items.map((item) => (
                    <li key={item.key} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => log(item)}
                        className="flex min-h-[52px] min-w-0 flex-1 flex-col justify-center px-1 py-1.5 text-left hover:bg-slate-50"
                      >
                        <span className="truncate text-sm font-semibold text-slate-900">{item.name}</span>
                        <span className="text-xs tabular-nums text-slate-500">
                          {item.servingLabel} · {Math.round(item.nutrition.calories)} kcal ·{" "}
                          {Math.round(item.nutrition.protein)}g protein
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdjusting(item)}
                        className="shrink-0 px-2 text-xs font-semibold text-[#2563EB]"
                      >
                        Adjust
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

          <div className="mt-4 rounded-2xl border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Custom</p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="mt-2 min-h-[44px] w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#2563EB]"
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <NumberField label="Calories" value={kcal} onChange={setKcal} />
              <NumberField label="Protein (g)" value={protein} onChange={setProtein} />
              <NumberField label="Carbs (g, optional)" value={carbs} onChange={setCarbs} />
              <NumberField label="Fat (g, optional)" value={fat} onChange={setFat} />
            </div>
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={saveForReuse} onChange={(e) => setSaveForReuse(e.target.checked)} />
              Save for reuse
            </label>
            <button
              type="button"
              disabled={!customOk}
              onClick={logCustom}
              className="mt-2 min-h-[44px] w-full rounded-xl bg-[#2563EB] text-sm font-semibold text-white disabled:opacity-40"
            >
              Log snack
            </button>
          </div>
        </div>
      </section>

      {adjusting && (
        <AdjustServingsSheet
          title={adjusting.name}
          servingGrams={adjusting.servingGrams}
          onChoose={(servings) => log(adjusting, servings)}
          onClose={() => setAdjusting(null)}
        />
      )}
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-slate-500">{label}</span>
      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 min-h-[44px] w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#2563EB]"
      />
    </label>
  );
}
