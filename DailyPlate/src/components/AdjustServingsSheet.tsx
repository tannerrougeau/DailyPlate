import { useState } from "react";
import { X } from "lucide-react";
import { useOverlayBack } from "@/hooks/useOverlayBack";
import { formatServings, servingsFromGrams } from "@/utils/mealTracking";
import { useAppStore } from "@/store/useAppStore";
import { useDisplayPrefs } from "@/hooks/useDisplayPrefs";

const OPTIONS = [0.5, 1, 1.5, 2];

/**
 * How much was eaten: ½, 1, 1½ or 2 servings, or grams when one serving's weight is known
 * (grams ÷ serving weight = servings). Meals with separately cooked parts pass no weight.
 */
export function AdjustServingsSheet({
  title,
  servingGrams,
  current,
  onChoose,
  onClose,
}: {
  title: string;
  servingGrams: number | null;
  current?: number;
  onChoose: (servings: number) => void;
  onClose: () => void;
}) {
  useOverlayBack(true, onClose);
  const display = useDisplayPrefs();
  const recordUsage = useAppStore((s) => s.recordUsage);
  const gramsWeight = display.adjustGrams ? servingGrams : null;
  const [grams, setGrams] = useState("");
  const fromGrams = servingsFromGrams(Number(grams), gramsWeight);

  function choose(servings: number) {
    recordUsage("adjust");
    onChoose(servings);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[94] flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <section
        role="dialog"
        aria-labelledby="adjust-servings-title"
        className="relative z-[95] w-full max-w-lg rounded-t-3xl border border-slate-200 bg-white p-4 shadow-2xl sm:max-w-md sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">How much did you eat?</p>
            <h2 id="adjust-servings-title" className="mt-0.5 truncate text-base font-bold text-slate-900">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2">
          {OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => choose(s)}
              className={`min-h-[52px] rounded-xl border text-sm font-semibold ${
                current === s ? "border-[#2563EB] bg-blue-50 text-blue-900" : "border-slate-200 text-slate-800"
              }`}
            >
              {s === 0.5 ? "½" : s === 1.5 ? "1½" : s}
            </button>
          ))}
        </div>
        <p className="mt-1 text-center text-xs text-slate-400">servings</p>

        {gramsWeight != null && gramsWeight > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <span className="shrink-0">Grams eaten</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
                placeholder={`1 serving ≈ ${Math.round(gramsWeight)} g`}
                className="min-h-[44px] w-full rounded-xl border border-slate-200 px-3 text-base outline-none focus:border-[#2563EB]"
              />
            </label>
            <button
              type="button"
              disabled={fromGrams == null}
              onClick={() => fromGrams != null && choose(fromGrams)}
              className="mt-2 min-h-[44px] w-full rounded-xl bg-[#2563EB] text-sm font-semibold text-white disabled:opacity-40"
            >
              {fromGrams != null ? `Log ${formatServings(fromGrams)}` : "Log grams"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
