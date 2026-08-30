import type { DailyTargets } from "@/types";

const green = "#10B981";
const red = "#EF4444";

function MacroGoalBar({
  label,
  consumed,
  target,
}: {
  label: string;
  consumed: number;
  target: number;
}) {
  const over = consumed > target;
  const pct = target > 0 ? Math.min(100, (consumed / target) * 100) : 0;
  const fillColor = over ? red : green;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span
          className="text-sm font-semibold tabular-nums"
          style={{ color: over ? red : green }}
        >
          {Math.round(consumed)}g / {Math.round(target)}g
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200/90">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${over ? 100 : pct}%`,
            backgroundColor: fillColor,
          }}
        />
      </div>
    </div>
  );
}

export function RemainingSection({
  targets,
  consumed,
}: {
  targets: DailyTargets;
  consumed: DailyTargets;
}) {
  const calRemaining = targets.calories - consumed.calories;
  const calOver = calRemaining < 0;

  return (
    <section className="rounded-[18px] border border-slate-200/80 bg-white p-5 shadow-sm">
      <h2 className="sr-only">Remaining toward goals</h2>
      <div className="mb-5 border-b border-slate-100 pb-5">
        <p className="text-sm font-medium text-slate-600">Remaining calories</p>
        <p
          className="mt-1 text-2xl font-bold tabular-nums"
          style={{ color: calOver ? red : green }}
        >
          {Math.round(calRemaining)} kcal
        </p>
      </div>
      <div className="space-y-5">
        <MacroGoalBar label="Protein" consumed={consumed.protein} target={targets.protein} />
        <MacroGoalBar label="Carbs" consumed={consumed.carbs} target={targets.carbs} />
        <MacroGoalBar label="Fat" consumed={consumed.fat} target={targets.fat} />
      </div>
    </section>
  );
}
