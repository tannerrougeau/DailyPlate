import type { DailyTargets } from "@/types";

function fiberTarget(targets: DailyTargets): number {
  if (targets.fiber != null && Number.isFinite(targets.fiber)) return targets.fiber;
  return Math.round((targets.calories / 1000) * 14);
}

export function NutritionDashboard({
  targets,
  eaten,
  loggedCount,
  mealCount,
}: {
  targets: DailyTargets;
  eaten: DailyTargets;
  loggedCount: number;
  mealCount: number;
}) {
  const kcal = Math.round(eaten.calories);
  const goal = Math.round(targets.calories);
  const protein = Math.round(eaten.protein);
  const carbs = Math.round(eaten.carbs);
  const fat = Math.round(eaten.fat);
  const fiber = Math.round(eaten.fiber ?? 0);

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm">
      <p className="text-center text-xs font-semibold uppercase tracking-widest text-slate-400">
        Eaten vs target
      </p>
      <p
        className="mt-2 text-center text-2xl font-semibold tabular-nums text-slate-900"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {kcal.toLocaleString()}
        <span className="ml-1 font-sans text-base font-medium text-slate-400">
          / {goal.toLocaleString()} kcal
        </span>
      </p>
      <p className="mt-2 text-center text-xs leading-relaxed text-slate-600">
        Protein {protein}/{Math.round(targets.protein)}g · Carbs {carbs}/{Math.round(targets.carbs)}g
        · Fat {fat}/{Math.round(targets.fat)}g · Fiber {fiber}/{Math.round(fiberTarget(targets))}g
      </p>
      {mealCount > 0 && (
        <p className="mt-1.5 text-center text-[11px] text-slate-400">
          {loggedCount === 0
            ? "Totals stay at 0 until you mark a meal eaten or skipped"
            : `${loggedCount}/${mealCount} meals logged`}
        </p>
      )}
    </section>
  );
}
