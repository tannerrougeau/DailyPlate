export function NutritionDetails({
  calories,
  protein,
  carbs,
  fat,
  fiber,
}: {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}) {
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <h3 className="text-sm font-semibold text-slate-800">Macronutrients</h3>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-slate-600">
        <div>
          Protein <span className="font-semibold tabular-nums text-slate-800">{protein}g</span>
        </div>
        <div>
          Carbs <span className="font-semibold tabular-nums text-slate-800">{carbs}g</span>
        </div>
        <div>
          Fat <span className="font-semibold tabular-nums text-slate-800">{fat}g</span>
        </div>
        <div>
          Fiber <span className="font-semibold tabular-nums text-slate-800">{fiber}g</span>
        </div>
      </dl>
      <p className="mt-2 text-sm font-semibold tabular-nums text-slate-900">{calories} kcal</p>
    </div>
  );
}
