import type { MainGoal, ProteinPreference, UserProfile } from "@/types/profile";

export const DEFAULT_PROTEIN_PREFERENCE: ProteinPreference = "recommended";

const PROTEIN_PER_KG_MIN = 1.0;
const PROTEIN_PER_KG_MAX = 2.2;
const PREFERENCE_STEP = 0.3;
const BMI_REFERENCE = 25;
const EXCESS_WEIGHT_FACTOR = 0.4;

type ProteinInput = {
  goal: MainGoal | null | undefined;
  preference?: ProteinPreference | string | null;
  weightKg: number;
  heightCm: number;
};

/** Map saved Moderate / Moderate-High / High values onto Less / Recommended / More. */
export function migrateProteinPreference(
  pref: ProteinPreference | string | null | undefined,
): ProteinPreference {
  if (pref === "moderate" || pref === "less") return "less";
  if (pref === "high" || pref === "more") return "more";
  return "recommended";
}

function baseProteinPerKg(goal: MainGoal | null | undefined): number {
  switch (goal) {
    case "lose":
    case "gain":
      return 1.8;
    case "health":
      return 1.4;
    case "maintain":
    default:
      return 1.6;
  }
}

/** Goal-linked g/kg, ±0.3 for Less / More, clamped to 1.0–2.2. */
export function proteinPerKg(
  goal: MainGoal | null | undefined,
  preference: ProteinPreference | string | null | undefined,
): number {
  const pref = migrateProteinPreference(preference);
  const delta = pref === "less" ? -PREFERENCE_STEP : pref === "more" ? PREFERENCE_STEP : 0;
  return Math.max(PROTEIN_PER_KG_MIN, Math.min(PROTEIN_PER_KG_MAX, baseProteinPerKg(goal) + delta));
}

/** Cap heavier bodies toward BMI-25 weight so protein does not scale linearly forever. */
export function proteinWeightKg(weightKg: number, heightCm: number): number {
  const safeWeight = Number.isFinite(weightKg) && weightKg > 0 ? weightKg : 0;
  const heightM = (Number.isFinite(heightCm) && heightCm > 0 ? heightCm : 0) / 100;
  if (heightM <= 0) return safeWeight;
  const referenceKg = BMI_REFERENCE * heightM * heightM;
  if (safeWeight > referenceKg) {
    return referenceKg + EXCESS_WEIGHT_FACTOR * (safeWeight - referenceKg);
  }
  return safeWeight;
}

export function roundToNearest5(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value / 5) * 5;
}

/** Daily protein g from goal + preference + (capped) weight. Custom override is applied separately. */
export function goalLinkedProteinGrams(input: ProteinInput): number {
  const perKg = proteinPerKg(input.goal, input.preference);
  return roundToNearest5(perKg * proteinWeightKg(input.weightKg, input.heightCm));
}

/** Old Moderate / Moderate-High / High × raw weight — used so migrated saves are not treated as custom. */
function legacyAutoProteinGrams(
  weightKg: number,
  preference: ProteinPreference | string | null | undefined,
): number {
  const pref = migrateProteinPreference(preference);
  const perKg = pref === "less" ? 1.6 : pref === "more" ? 2.0 : 1.8;
  return Math.round(weightKg * perKg);
}

export function isCustomProteinOverride(
  stored: number | null | undefined,
  input: ProteinInput,
): boolean {
  if (stored == null || !Number.isFinite(stored) || stored <= 0) return false;
  if (stored === goalLinkedProteinGrams(input)) return false;
  if (stored === legacyAutoProteinGrams(input.weightKg, input.preference)) return false;
  return true;
}

/** Custom grams win; otherwise the goal-linked target. */
export function resolvedProteinGrams(
  profile: Pick<UserProfile, "goal" | "proteinPreference" | "weightKg" | "heightCm" | "minimumProteinGrams">,
): number {
  const input: ProteinInput = {
    goal: profile.goal,
    preference: profile.proteinPreference,
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
  };
  if (isCustomProteinOverride(profile.minimumProteinGrams, input)) {
    return Math.round(profile.minimumProteinGrams!);
  }
  return goalLinkedProteinGrams(input);
}

export function suggestedProteinRange(input: ProteinInput): { low: number; high: number } {
  return {
    low: goalLinkedProteinGrams({ ...input, preference: "less" }),
    high: goalLinkedProteinGrams({ ...input, preference: "more" }),
  };
}

export function proteinGramsPerMealEquivalent(
  dailyG: number,
  mainMealCount: number,
  snacksPerDay: number,
): number {
  const slots = Math.max(0, mainMealCount) + 0.5 * Math.max(0, snacksPerDay);
  if (slots <= 0) return roundToNearest5(dailyG);
  return roundToNearest5(dailyG / slots);
}

export function effectiveMinimumProteinGrams(profile: UserProfile): number | null {
  if (profile.prioritizeMinProtein === false && !profile.proteinPreference && !profile.minimumProteinGrams) {
    return null;
  }
  return resolvedProteinGrams(profile);
}
