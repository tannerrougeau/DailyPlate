import { useState } from "react";
import { AdjustServingsSheet } from "@/components/AdjustServingsSheet";
import type { DailyTargets } from "@/types";
import type { FoodItem } from "@/utils/foodTypes";
import { fitLine, proteinTopUp } from "@/utils/foodSearch";

/** After picking a food: how it fits the target (no judging), then log 1 serving or adjust. */
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
  onLog: (servings: number) => void;
  onBack: () => void;
}) {
  const [adjustOpen, setAdjustOpen] = useState(false);
  const topUp = target ? proteinTopUp(Math.round(target.protein - food.protein)) : null;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <p className="text-sm font-semibold text-slate-900">
        {food.name}
        {food.brand ? <span className="font-normal text-slate-500"> · {food.brand}</span> : null}
      </p>
      <p className="text-xs text-slate-500">{food.servingLabel}</p>
      {target && <p className="mt-2 text-sm leading-relaxed text-slate-700">{fitLine(food, target, forLabel)}</p>}
      {topUp && <p className="mt-1 text-sm leading-relaxed text-slate-700">{topUp}</p>}
      {food.credit && <p className="mt-1 text-[11px] text-slate-400">Data: {food.credit}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onLog(1)}
          className="min-h-[44px] flex-1 rounded-xl bg-[#2563EB] text-sm font-semibold text-white"
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
          servingGrams={food.servingGrams ?? null}
          onChoose={onLog}
          onClose={() => setAdjustOpen(false)}
        />
      )}
    </div>
  );
}
