import type { UserProfile } from "@/types/profile";
import {
  PROTEIN_PER_KG_PRESETS,
  proteinGramsFromPreset,
  suggestedProteinRange,
  type ProteinPerKgPreset,
} from "@/utils/proteinMinimum";

type MinimumProteinSettingsProps = {
  profile: Pick<UserProfile, "weightKg" | "prioritizeMinProtein" | "minimumProteinGrams">;
  enabled: boolean;
  proteinGrams: string;
  onEnabledChange: (enabled: boolean) => void;
  onProteinGramsChange: (value: string) => void;
  onApplyPreset: (grams: number) => void;
};

export function MinimumProteinSettings({
  profile,
  enabled,
  proteinGrams,
  onEnabledChange,
  onProteinGramsChange,
  onApplyPreset,
}: MinimumProteinSettingsProps) {
  const range = suggestedProteinRange(profile.weightKg);
  const effective = enabled
    ? Number(proteinGrams) > 0
      ? Number(proteinGrams)
      : proteinGramsFromPreset(profile.weightKg, 1.8)
    : null;

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <h3 className="text-base font-semibold text-slate-900">Redistribute macros</h3>
      <p className="text-sm leading-relaxed text-slate-600">
        This allows more balanced and enjoyable meals while ensuring you hit a minimum protein
        target. We prioritize naturally high-protein recipes and make small portion adjustments
        (within ±25%) instead of heavily scaling a single meal.
      </p>
      <button
        type="button"
        onClick={() => onEnabledChange(!enabled)}
        className={`min-h-[52px] w-full rounded-2xl border-2 px-4 text-left text-sm font-semibold ${
          enabled
            ? "border-[#2563EB] bg-blue-50 text-blue-900"
            : "border-slate-200 bg-white text-slate-800"
        }`}
      >
        Prioritize minimum protein target
      </button>
      {enabled && (
        <>
          <p className="text-xs text-slate-500">
            Suggested range for your weight: {range.low}–{range.high} g per day
          </p>
          <div className="flex flex-wrap gap-2">
            {PROTEIN_PER_KG_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  onApplyPreset(proteinGramsFromPreset(profile.weightKg, p.id as ProteinPerKgPreset))
                }
                className="min-h-[44px] rounded-full border-2 border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:border-[#2563EB]"
              >
                {p.label}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">
              Minimum protein (grams per day)
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={40}
              max={400}
              value={proteinGrams}
              onChange={(e) => onProteinGramsChange(e.target.value)}
              placeholder={String(proteinGramsFromPreset(profile.weightKg, 1.8))}
              className="min-h-[48px] w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 outline-none focus:border-[#2563EB]"
            />
          </label>
          {effective != null && effective > 0 && (
            <p className="text-xs font-medium text-slate-600">
              Daily floor: {Math.round(effective)} g protein when plans are generated.
            </p>
          )}
        </>
      )}
    </section>
  );
}
