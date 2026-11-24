import { useState } from "react";
import { Check } from "lucide-react";
import { LogSomethingElseSheet } from "@/components/LogSomethingElseSheet";
import type { DailyTargets, MealTrackingEntry, PlannedMeal } from "@/types";
import type { MealSourceSlot } from "@/types/profile";
import { BOUGHT_MEAL_GUIDE, boughtMealTargetText } from "@/utils/boughtMeals";
import { fitLine, proteinTopUp } from "@/utils/foodSearch";

/**
 * A meal the user buys: a target instead of a recipe, a guided pick, and "Log what you got"
 * (food search). After logging: the fit line and at most one simple add. "Cook this instead"
 * switches back to the planned recipe for this day only.
 */
export function BoughtMealCard({
  meal,
  slot,
  dateKey,
  target,
  trackingEntry,
  onLog,
  onCookInstead,
}: {
  meal: PlannedMeal;
  slot: MealSourceSlot;
  dateKey: string;
  target: Pick<DailyTargets, "calories" | "protein">;
  trackingEntry?: MealTrackingEntry;
  onLog: (entry: MealTrackingEntry | null) => void;
  onCookInstead: () => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const logged = trackingEntry && trackingEntry.status !== "skipped" && trackingEntry.calories != null;
  const eaten = logged ? { calories: trackingEntry.calories ?? 0, protein: trackingEntry.protein ?? 0 } : null;
  const add = eaten ? proteinTopUp(Math.round(target.protein - eaten.protein)) : null;

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3 shadow-sm" aria-label={`Buying ${slot}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{slot}</p>
      {eaten ? (
        <>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <Check className="h-4 w-4 text-emerald-600" aria-hidden />
            {trackingEntry?.note || "Logged"} · {Math.round(eaten.calories)} kcal · {Math.round(eaten.protein)} g protein
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">{fitLine(eaten, target, slot)}</p>
          {add && <p className="mt-1 text-sm leading-relaxed text-slate-700">{add}</p>}
          <button type="button" onClick={() => onLog(null)} className="mt-2 text-xs font-semibold text-slate-500">
            Undo log
          </button>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm font-semibold text-slate-900">{boughtMealTargetText(slot, target)}</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{BOUGHT_MEAL_GUIDE}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="min-h-[40px] rounded-xl bg-[#2563EB] px-4 text-sm font-semibold text-white"
            >
              Log what you got
            </button>
            <button type="button" onClick={onCookInstead} className="min-h-[40px] px-2 text-sm font-semibold text-[#2563EB]">
              Cook this instead
            </button>
          </div>
        </>
      )}
      {searchOpen && (
        <LogSomethingElseSheet
          dateKey={dateKey}
          meal={meal}
          bought
          onClose={() => setSearchOpen(false)}
          onSave={onLog}
        />
      )}
    </article>
  );
}
