import type { DailyTargets } from "@/types";

export function NutritionSummaryCard({ consumed }: { consumed: DailyTargets }) {
  const kcal = Math.round(consumed.calories);

  return (
    <section className="rounded-[18px] border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="mb-5 text-center">
        <p
          className="text-[2.75rem] font-semibold leading-none tracking-tight text-slate-900 tabular-nums"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {kcal.toLocaleString()}
          <span className="ml-1.5 align-baseline font-sans text-lg font-medium text-slate-500">
            kcal
          </span>
        </p>
      </div>
      <dl className="space-y-2.5 border-t border-slate-100 pt-4">
        <MacroRow label="Protein" value={consumed.protein} />
        <MacroRow label="Carbs" value={consumed.carbs} />
        <MacroRow label="Fat" value={consumed.fat} />
      </dl>
    </section>
  );
}

function MacroRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-base">
      <dt className="font-medium text-slate-600">{label}</dt>
      <dd className="tabular-nums font-semibold text-slate-900">
        {Math.round(value)}g
      </dd>
    </div>
  );
}
