import { useMemo } from "react";
import { addDays, fromDateKey, toDateKey } from "@/utils/date";
import { mealsForDateKey, sumTrackedMacros } from "@/utils/mealTracking";
import type { DailyTargets, DayMealTracking, PlannedMeal } from "@/types";

function adherenceScore(consumed: number, target: number): number {
  if (target <= 0) return 0;
  if (consumed <= 0) return 0;
  const ratio = consumed / target;
  if (ratio >= 0.9 && ratio <= 1.1) return 100;
  if (ratio >= 0.8 && ratio <= 1.2) return 70;
  if (ratio >= 0.65 && ratio <= 1.35) return 40;
  return 15;
}

type AdherencePoint = {
  dateKey: string;
  weekday: string;
  dayNum: number;
  score: number;
  hasPlan: boolean;
  tracked: boolean;
  eatenCalories: number;
  isAnchor: boolean;
};

export function AdherenceTrend({
  targets,
  dailyPlans,
  plannedMeals,
  mealTracking,
  anchorDateKey,
  storeTodayDateKey,
  days = 7,
}: {
  targets: DailyTargets;
  dailyPlans: Record<string, PlannedMeal[]>;
  plannedMeals: PlannedMeal[];
  mealTracking: Record<string, DayMealTracking>;
  /** Last day in the chart (usually the day being viewed). */
  anchorDateKey: string;
  /** Store today key — used to resolve plannedMeals fallback. */
  storeTodayDateKey: string;
  days?: number;
}) {
  const points = useMemo(() => {
    const anchor = fromDateKey(anchorDateKey);
    const result: AdherencePoint[] = [];

    // Oldest → newest (left → right), ending on anchorDateKey.
    for (let offset = -(days - 1); offset <= 0; offset++) {
      const d = addDays(anchor, offset);
      const key = toDateKey(d);
      const meals = mealsForDateKey(key, dailyPlans, plannedMeals, storeTodayDateKey);
      const dayTracking = mealTracking[key];
      const { eaten, planned, hasTracking } = sumTrackedMacros(meals, dayTracking);
      const consumedCalories = hasTracking ? eaten.calories : planned.calories;
      const score = meals.length > 0 ? adherenceScore(consumedCalories, targets.calories) : 0;

      result.push({
        dateKey: key,
        weekday: d.toLocaleDateString("en-US", { weekday: "narrow" }),
        dayNum: d.getDate(),
        score,
        hasPlan: meals.length > 0,
        tracked: hasTracking,
        eatenCalories: Math.round(consumedCalories),
        isAnchor: key === anchorDateKey,
      });
    }

    return result;
  }, [
    anchorDateKey,
    dailyPlans,
    days,
    mealTracking,
    plannedMeals,
    storeTodayDateKey,
    targets.calories,
  ]);

  const plannedDays = points.filter((p) => p.hasPlan);
  const avgScore =
    plannedDays.length > 0
      ? Math.round(plannedDays.reduce((s, p) => s + p.score, 0) / plannedDays.length)
      : null;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-600">7-day adherence</p>
          {avgScore !== null ? (
            <p className="mt-0.5 text-xs text-slate-400">
              {avgScore}% avg · logged intake when available
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-slate-400">Generate plans to track trends</p>
          )}
        </div>
        <p className="text-[10px] font-medium text-slate-400">← older · newer →</p>
      </div>
      <div className="flex items-end justify-between gap-1">
        {points.map((point) => (
          <div key={point.dateKey} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-16 w-full items-end justify-center">
              <div
                className={`w-full max-w-[28px] rounded-t-md transition-all duration-500 ${
                  !point.hasPlan
                    ? "bg-slate-100"
                    : point.score >= 70
                      ? "bg-success/80"
                      : point.score >= 40
                        ? "bg-amber-400/80"
                        : "bg-slate-300"
                } ${point.isAnchor ? "ring-2 ring-primary/40 ring-offset-1" : ""}`}
                style={{ height: point.hasPlan ? `${Math.max(12, point.score * 0.56)}%` : "8%" }}
                title={
                  point.hasPlan
                    ? `${point.eatenCalories} kcal · ${point.score}% on target${point.tracked ? " (logged)" : ""}`
                    : "No plan"
                }
              />
            </div>
            <span
              className={`text-[10px] font-medium ${point.isAnchor ? "text-primary" : "text-slate-400"}`}
            >
              {point.weekday}
            </span>
            <span className="text-[9px] tabular-nums text-slate-300">{point.dayNum}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
