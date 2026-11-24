import { useState } from "react";
import type { ScanLabel } from "@/server/scan/types";
import type { DailyTargets } from "@/types";
import type { FoodItem } from "@/utils/foodTypes";
import { fitLine } from "@/utils/foodSearch";
import { formatServings, servingsFromGrams } from "@/utils/mealTracking";
import { labelFood, labelForm, type LabelForm } from "@/utils/scan/scanFlow";

const OPTIONS = [0.5, 1, 1.5, 2];

const FIELDS: [keyof LabelForm, string][] = [
  ["calories", "Calories"],
  ["protein", "Protein (g)"],
  ["carbs", "Carbs (g)"],
  ["fat", "Fat (g)"],
  ["fiber", "Fiber (g)"],
  ["sodiumMg", "Sodium (mg)"],
];

/**
 * The label as read (per serving), editable before logging. Logged by servings; grams too when
 * the label prints the serving weight. Saved to My foods.
 */
export function ScanLabelReview({
  label,
  target,
  forLabel,
  onLog,
}: {
  label: ScanLabel;
  target: Pick<DailyTargets, "calories" | "protein"> | null;
  forLabel: string;
  onLog: (food: FoodItem, servings: number, values: LabelForm) => void;
}) {
  const [form, setForm] = useState<LabelForm>(() => labelForm(label));
  const [servings, setServings] = useState(1);
  const [grams, setGrams] = useState("");
  const food = labelFood(form);
  const servingGrams = food?.servingGrams ?? null;
  const fromGrams = servingGrams ? servingsFromGrams(Number(grams), servingGrams) : null;
  const amount = grams.trim() && fromGrams != null ? fromGrams : servings;
  const set = (k: keyof LabelForm) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const field = "mt-0.5 min-h-[40px] w-full rounded-lg border border-slate-200 px-2 text-sm outline-none focus:border-[#2563EB]";

  return (
    <div className="rounded-2xl border border-slate-200 p-3">
      <p className="text-sm font-semibold text-slate-900">Nutrition Facts as read. Check and edit if needed.</p>
      <label className="mt-2 block">
        <span className="text-[11px] font-medium text-slate-500">Name</span>
        <input value={form.name} onChange={set("name")} placeholder="e.g. Granola bar" className={field} />
      </label>
      <div className="mt-2 grid grid-cols-[1fr_7rem] gap-2">
        <label className="block">
          <span className="text-[11px] font-medium text-slate-500">Serving size</span>
          <input value={form.serving} onChange={set("serving")} className={field} />
        </label>
        <label className="block">
          <span className="text-[11px] font-medium text-slate-500">Serving (g)</span>
          <input type="number" min={0} inputMode="decimal" value={form.servingGrams} onChange={set("servingGrams")} className={field} />
        </label>
      </div>
      {label.servingsPerContainer != null && (
        <p className="mt-1 text-[11px] text-slate-500">{label.servingsPerContainer} servings per container</p>
      )}
      <div className="mt-2 grid grid-cols-3 gap-2">
        {FIELDS.map(([k, text]) => (
          <label key={k} className="block">
            <span className="text-[11px] font-medium text-slate-500">{text}</span>
            <input type="number" min={0} inputMode="decimal" value={form[k]} onChange={set(k)} className={field} />
          </label>
        ))}
      </div>

      <p className="mt-3 text-xs font-semibold text-slate-500">How much did you have?</p>
      <div className="mt-1 grid grid-cols-4 gap-2">
        {OPTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setServings(s);
              setGrams("");
            }}
            className={`min-h-[44px] rounded-xl border text-sm font-semibold ${
              servings === s && !grams.trim() ? "border-[#2563EB] bg-blue-50 text-blue-900" : "border-slate-200 text-slate-800"
            }`}
          >
            {s === 0.5 ? "½" : s === 1.5 ? "1½" : s}
          </button>
        ))}
      </div>
      {servingGrams != null && (
        <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
          <span className="shrink-0 text-xs text-slate-500">or grams</span>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            value={grams}
            onChange={(e) => setGrams(e.target.value)}
            placeholder={`1 serving = ${Math.round(servingGrams)} g`}
            className="min-h-[40px] w-full rounded-lg border border-slate-200 px-2 text-sm"
          />
        </label>
      )}

      {food && target && (
        <p className="mt-2 text-sm leading-relaxed text-slate-700">
          {fitLine(
            { calories: food.calories * amount, protein: food.protein * amount },
            target,
            forLabel,
          )}
        </p>
      )}
      <button
        type="button"
        disabled={!food}
        onClick={() => food && onLog(food, amount, form)}
        className="mt-3 min-h-[44px] w-full rounded-xl bg-[#2563EB] text-sm font-semibold text-white disabled:opacity-40"
      >
        {food ? `Log ${formatServings(amount)}` : "Name, calories and protein are needed"}
      </button>
    </div>
  );
}
