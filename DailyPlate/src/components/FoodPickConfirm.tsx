import { useEffect, useState } from "react";
import { AdjustServingsSheet } from "@/components/AdjustServingsSheet";
import type { DailyTargets } from "@/types";
import type { FoodItem, FoodPortion } from "@/utils/foodTypes";
import { applyPortion, fetchPortions, fitLine, proteinTopUp } from "@/utils/foodSearch";

const GRAMS = "grams";

/**
 * After picking a food: choose a household portion for generic USDA foods (grams stay an option),
 * see how it fits the target (no judging), then log 1 serving or adjust.
 */
export function FoodPickConfirm({
  food,
  target,
  forLabel,
  onLog,
  onBack,
}: {
  food: FoodItem;
  target: Pick<DailyTargets, "calories" | "protein"> | null;
  forLabel: string;
  /** Called with the servings and the food as sized (portion or grams applied). */
  onLog: (servings: number, sized: FoodItem) => void;
  onBack: () => void;
}) {
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [portions, setPortions] = useState<FoodPortion[] | null>(food.generic ? null : []);
  const [choice, setChoice] = useState<string>("0");
  const [grams, setGrams] = useState("100");

  useEffect(() => {
    if (!food.generic) return;
    let live = true;
    void fetchPortions(food).then((list) => {
      if (!live) return;
      setPortions(list);
      setChoice(list.length > 0 ? "0" : GRAMS);
    });
    return () => {
      live = false;
    };
  }, [food]);

  const sized: FoodItem = (() => {
    if (!food.generic) return food;
    if (choice === GRAMS) {
      const g = Number(grams);
      return g > 0 ? applyPortion(food, { label: `${Math.round(g)} g`, grams: g }) : food;
    }
    const p = portions?.[Number(choice)];
    return p ? applyPortion(food, p) : food;
  })();

  const topUp = target ? proteinTopUp(Math.round(target.protein - sized.protein)) : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <p className="text-sm font-semibold text-slate-900">
        {food.name}
        {food.brand ? <span className="font-normal text-slate-500"> · {food.brand}</span> : null}
      </p>

      {food.generic ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          {portions === null ? (
            <span className="text-xs text-slate-500">Loading portions…</span>
          ) : (
            <>
              <label className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Portion</span>
                <select
                  value={choice}
                  onChange={(e) => setChoice(e.target.value)}
                  className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-2 text-sm"
                >
                  {portions.map((p, i) => (
                    <option key={p.label} value={String(i)}>
                      {p.label} ({Math.round(p.grams)} g)
                    </option>
                  ))}
                  <option value={GRAMS}>Grams…</option>
                </select>
              </label>
              {choice === GRAMS && (
                <label className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={grams}
                    onChange={(e) => setGrams(e.target.value)}
                    className="min-h-[40px] w-20 rounded-lg border border-slate-200 px-2 text-sm"
                    aria-label="Grams"
                  />
                  <span className="text-xs text-slate-500">g</span>
                </label>
              )}
            </>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-500">{food.servingLabel}</p>
      )}

      {target && <p className="mt-2 text-sm leading-relaxed text-slate-700">{fitLine(sized, target, forLabel)}</p>}
      {topUp && <p className="mt-1 text-sm leading-relaxed text-slate-700">{topUp}</p>}
      {food.sourceName && food.sourceName !== food.name && (
        <p className="mt-1 text-[11px] text-slate-400">
          {food.source === "usda" ? "USDA" : "Listed as"}: {food.sourceName}
        </p>
      )}
      {food.credit && <p className="mt-1 text-[11px] text-slate-400">Data: {food.credit}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onLog(1, sized)}
          disabled={food.generic && portions === null}
          className="min-h-[44px] flex-1 rounded-xl bg-[#2563EB] text-sm font-semibold text-white disabled:opacity-40"
        >
          Log 1 serving
        </button>
        <button
          type="button"
          onClick={() => setAdjustOpen(true)}
          className="min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700"
        >
          Adjust
        </button>
        <button type="button" onClick={onBack} className="min-h-[44px] px-2 text-sm font-semibold text-slate-500">
          Back
        </button>
      </div>
      {adjustOpen && (
        <AdjustServingsSheet
          title={food.name}
          servingGrams={sized.servingGrams ?? null}
          onChoose={(servings) => onLog(servings, sized)}
          onClose={() => setAdjustOpen(false)}
        />
      )}
    </div>
  );
}
