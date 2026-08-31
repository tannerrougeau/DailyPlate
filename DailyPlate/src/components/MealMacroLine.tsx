export function MealMacroLine({
  protein,
  carbs,
  fat,
  fiber,
  kcal,
  compact = false,
}: {
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  kcal?: number;
  compact?: boolean;
}) {
  const cell = compact
    ? "text-[11px] leading-snug text-slate-600"
    : "text-xs leading-snug text-slate-600";
  return (
    <div className="min-w-0">
      {kcal != null && (
        <p className={`font-semibold tabular-nums text-slate-800 ${compact ? "text-[11px]" : "text-xs"}`}>
          {kcal} kcal
        </p>
      )}
      <div className={`grid grid-cols-2 gap-x-2 gap-y-0.5 tabular-nums ${kcal != null ? "mt-1" : ""}`}>
        <span className={cell}>
          Protein <span className="font-semibold text-slate-800">{protein}g</span>
        </span>
        <span className={cell}>
          Carbs <span className="font-semibold text-slate-800">{carbs}g</span>
        </span>
        <span className={cell}>
          Fat <span className="font-semibold text-slate-800">{fat}g</span>
        </span>
        <span className={cell}>
          Fiber <span className="font-semibold text-slate-800">{fiber}g</span>
        </span>
      </div>
    </div>
  );
}
