import type { MainGoal, ProteinPreference } from "@/types/profile";
import { suggestedProteinRange } from "@/utils/proteinMinimum";

type MinimumProteinSettingsProps = {
  /** Grams implied by the goal-linked preference. */
  derivedGrams: number;
  weightKg: number;
  heightCm: number;
  goal: MainGoal | null;
  preference?: ProteinPreference | null;
  proteinGrams: string;
  onProteinGramsChange: (value: string) => void;
};

/**
 * Optional override on top of the protein preference. Blank means "use the
 * preference", so the placeholder always shows the preference-derived grams.
 */
export function MinimumProteinSettings({
  derivedGrams,
  weightKg,
  heightCm,
  goal,
  preference,
  proteinGrams,
  onProteinGramsChange,
}: MinimumProteinSettingsProps) {
  const range = suggestedProteinRange({
    goal,
    preference,
    weightKg,
    heightCm,
  });
  const parsed = Number(proteinGrams);
  const effective = Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : derivedGrams;

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <h3 className="text-base font-semibold text-slate-900">Custom protein target (g)</h3>
      <p className="text-sm leading-relaxed text-slate-600">
        Your protein preference already sets {derivedGrams} g per day. Set a number here only if you
        want a different floor. We prioritize naturally high-protein recipes and make small portion
        adjustments (within ±25%) instead of heavily scaling a single meal.
      </p>
      <p className="text-xs text-slate-500">
        Suggested range for your weight: {range.low}–{range.high} g per day
      </p>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-500">
          Leave blank to use your preference
        </span>
        <input
          type="number"
          inputMode="numeric"
          min={40}
          max={400}
          value={proteinGrams}
          onChange={(e) => onProteinGramsChange(e.target.value)}
          placeholder={String(derivedGrams)}
          className="min-h-[48px] w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 outline-none focus:border-[#2563EB]"
        />
      </label>
      <p className="text-xs font-medium text-slate-600">
        Daily floor: {effective} g protein when plans are generated.
      </p>
      {proteinGrams.trim() !== "" && (
        <button
          type="button"
          onClick={() => onProteinGramsChange("")}
          className="min-h-[44px] rounded-full border-2 border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:border-[#2563EB]"
        >
          Use recommended ({derivedGrams} g)
        </button>
      )}
    </section>
  );
}
