import type { DailyTargets, PlannedMeal } from "@/types";
import { MacroProgressBar } from "@/components/MacroProgressBar";
import { AdherenceTrend } from "@/components/AdherenceTrend";
import type { DayMealTracking } from "@/types";

export function NutritionDashboard({
  targets,
  eaten,
  planned,
  hasTracking,
  loggedCount,
  mealCount,
  anchorDateKey,
  storeTodayDateKey,
  isViewingToday,
  dailyPlans,
  plannedMeals,
  mealTracking,
  showAdherence = true,
}: {
  targets: DailyTargets;
  eaten: DailyTargets;
  planned: DailyTargets;
  hasTracking: boolean;
  loggedCount: number;
  mealCount: number;
  anchorDateKey: string;
  storeTodayDateKey: string;
  isViewingToday: boolean;
  dailyPlans: Record<string, PlannedMeal[]>;
  plannedMeals: PlannedMeal[];
  mealTracking: Record<string, DayMealTracking>;
  showAdherence?: boolean;
}) {
  const display = hasTracking ? eaten : planned;
  const calPct =
    targets.calories > 0 ? Math.min(100, (display.calories / targets.calories) * 100) : 0;
  const calOver = display.calories > targets.calories;
  const calRemaining = targets.calories - display.calories;

  const headline = hasTracking
    ? "Eaten"
    : isViewingToday
      ? "Today's plan"
      : "Planned";

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="px-6 pb-2 pt-6">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-slate-400">
          {headline}
        </p>
        <div className="mt-3 text-center">
          <p
            className="text-[2.75rem] font-semibold leading-none tracking-tight text-slate-900 tabular-nums transition-all duration-500"
            style={{ fontFamily: "var(--font-serif)" }}
            key={`kcal-${Math.round(display.calories)}`}
          >
            {Math.round(display.calories).toLocaleString()}
            <span className="ml-1.5 align-baseline font-sans text-lg font-medium text-slate-400">
              / {Math.round(targets.calories).toLocaleString()} kcal
            </span>
          </p>
          {hasTracking ? (
            <p className="mt-1.5 text-xs text-slate-500">
              {loggedCount}/{mealCount} meals logged
              <span className="mx-1.5 text-slate-300">·</span>
              {Math.round(planned.calories).toLocaleString()} kcal planned
            </p>
          ) : mealCount > 0 ? (
            <p className="mt-1.5 text-xs text-slate-400">
              Tap meals below to log what you ate
            </p>
          ) : null}
        </div>
        <div className="mx-auto mt-5 max-w-sm">
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${
                calOver ? "bg-danger" : hasTracking ? "bg-success" : "bg-primary"
              }`}
              style={{ width: `${calOver ? 100 : calPct}%` }}
            />
          </div>
          <p
            className={`mt-2 text-center text-sm font-semibold tabular-nums transition-colors duration-300 ${
              calOver ? "text-danger" : "text-success"
            }`}
          >
            {calOver
              ? `${Math.round(Math.abs(calRemaining))} kcal over`
              : `${Math.round(calRemaining)} kcal remaining`}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-4 border-t border-slate-100 px-6 py-5">
        <MacroProgressBar label="Protein" consumed={display.protein} target={targets.protein} />
        <MacroProgressBar label="Carbs" consumed={display.carbs} target={targets.carbs} />
        <MacroProgressBar label="Fat" consumed={display.fat} target={targets.fat} />
      </div>

      {showAdherence && (
        <div className="border-t border-slate-100 px-6 py-5">
          <AdherenceTrend
            targets={targets}
            dailyPlans={dailyPlans}
            plannedMeals={plannedMeals}
            mealTracking={mealTracking}
            anchorDateKey={anchorDateKey}
            storeTodayDateKey={storeTodayDateKey}
          />
        </div>
      )}
    </section>
  );
}
