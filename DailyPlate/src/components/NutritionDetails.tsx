import { useState } from "react";
import { ChevronDown } from "lucide-react";

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
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-[36px] w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left"
      >
        <span className="text-sm font-semibold text-slate-800">Nutrition details</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180 text-[#2563EB]" : ""}`}
          aria-hidden
        />
      </button>
      {open && (
        <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2.5">
          <p className="text-sm font-semibold tabular-nums text-slate-900">{calories} calories</p>
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
        </div>
      )}
    </div>
  );
}
