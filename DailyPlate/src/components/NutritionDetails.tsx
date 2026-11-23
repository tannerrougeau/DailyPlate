export function NutritionDetails({
  calories,
  protein,
  carbs,
  fat,
  fiber,
  parts,
}: {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  parts?: {
    label: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  }[];
}) {
  const split = parts && parts.length >= 2 ? parts : null;
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <h3 className="text-sm font-semibold text-slate-800">Macronutrients</h3>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-slate-600">
        <MacroStat label="Protein" value={protein} unit="g" />
        <MacroStat label="Carbs" value={carbs} unit="g" />
        <MacroStat label="Fat" value={fat} unit="g" />
        <MacroStat label="Fiber" value={fiber} unit="g" />
      </dl>
      {split && (
        <ul className="mt-2 space-y-0.5 text-xs leading-relaxed text-slate-500">
          <li>{sumLine(split, "calories", "")}</li>
          <li>{sumLine(split, "protein", " protein")}</li>
          <li>{sumLine(split, "carbs", " carbs")}</li>
          <li>{sumLine(split, "fat", " fat")}</li>
          <li>{sumLine(split, "fiber", " fiber")}</li>
        </ul>
      )}
      {!split && (
        <p className="mt-2 text-sm font-semibold tabular-nums text-slate-900">{calories} kcal</p>
      )}
    </div>
  );
}

function MacroStat({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div>
      {label}{" "}
      <span className="font-semibold tabular-nums text-slate-800">
        {value}
        {unit}
      </span>
    </div>
  );
}

function sumLine(
  parts: {
    label: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  }[],
  key: "calories" | "protein" | "carbs" | "fat" | "fiber",
  suffix: string,
): string {
  const unit = key === "calories" ? " kcal" : "g";
  const bits = parts.map((part) => `${part.label} ${part[key]}${unit}`);
  const total = parts.reduce((sum, part) => sum + part[key], 0);
  return `${bits.join(" + ")} = ${total}${unit}${suffix}`;
}
