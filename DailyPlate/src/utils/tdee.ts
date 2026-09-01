import type { ActivityLevel, BiologicalSex, MainGoal, UserProfile } from "@/types/profile";
import { splitRemainingMacros } from "@/utils/macroSplit";

const ACTIVITY_MULT: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
};

function bmrMifflinStJeor(kg: number, cm: number, age: number, sex: BiologicalSex): number {
  const base = 10 * kg + 6.25 * cm - 5 * age;
  if (sex === "male") return base + 5;
  if (sex === "female") return base - 161;
  return base - 78;
}

export function goalCalorieDelta(goal: MainGoal): number {
  switch (goal) {
    case "lose":
      return -450;
    case "maintain":
      return 0;
    case "gain":
      return 320;
    case "health":
      return -200;
    default:
      return 0;
  }
}

function proteinPerKg(goal: MainGoal): number {
  switch (goal) {
    case "gain":
      return Math.min(2.2, Math.max(1.6, 1.9));
    case "lose":
      return Math.min(2.2, Math.max(1.6, 2.0));
    case "health":
      return 1.8;
    default:
      return Math.min(2.0, Math.max(1.4, 1.6));
  }
}

export interface ComputedTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

/** Maintenance TDEE from Mifflin–St Jeor × activity (no goal adjustment). */
export function computeFormulaTdee(profile: UserProfile): number {
  const activity: ActivityLevel = profile.activityLevel ?? "moderate";
  const bmr = bmrMifflinStJeor(profile.weightKg, profile.heightCm, profile.age, profile.sex);
  return Math.round(bmr * ACTIVITY_MULT[activity]);
}

/**
 * Uses Mifflin–St Jeor × activity (defaults to moderate if activity unknown).
 */
export function computeDailyTargets(profile: UserProfile): ComputedTargets {
  const maintenanceTdee =
    profile.knownTdeeKcal != null && profile.knownTdeeKcal > 0
      ? profile.knownTdeeKcal
      : computeFormulaTdee(profile);
  const calories = Math.round(Math.max(1200, maintenanceTdee + goalCalorieDelta(profile.goal)));

  const proteinG = Math.round(profile.weightKg * proteinPerKg(profile.goal));
  const proteinKcal = proteinG * 4;
  const remainingKcal = Math.max(0, calories - proteinKcal);
  const { carbKcal, fatKcal } = splitRemainingMacros(
    remainingKcal,
    profile.macroSplitPreference,
  );
  const fatG = Math.round(fatKcal / 9);
  const carbsG = Math.round(carbKcal / 4);
  const fiberG = Math.round((calories / 1000) * 14);

  return {
    calories,
    protein: proteinG,
    carbs: carbsG,
    fat: fatG,
    fiber: fiberG,
  };
}
