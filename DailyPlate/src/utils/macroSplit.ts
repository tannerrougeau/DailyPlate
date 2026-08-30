import type { MacroSplitPreference } from "@/types/profile";

export const MACRO_SPLIT_OPTIONS: {
  id: MacroSplitPreference;
  label: string;
  description: string;
}[] = [
  {
    id: "balanced",
    label: "Balanced (default)",
    description: "Even split of remaining calories after protein.",
  },
  {
    id: "higher_carb",
    label: "60/40 Carbs to Fat",
    description: "Higher carbohydrate — great for training days or carb preference.",
  },
  {
    id: "lower_carb",
    label: "40/60 Fat to Carbs",
    description: "Higher fat — steadier energy with fewer carbs.",
  },
];

/** Split remaining kcal (after protein) between carbs and fat. Protein is always prioritized elsewhere. */
export function splitRemainingMacros(
  remainingKcal: number,
  preference: MacroSplitPreference | null | undefined,
): { carbKcal: number; fatKcal: number } {
  const pref = preference ?? "balanced";
  if (remainingKcal <= 0) return { carbKcal: 0, fatKcal: 0 };

  if (pref === "higher_carb") {
    return { carbKcal: remainingKcal * 0.6, fatKcal: remainingKcal * 0.4 };
  }
  if (pref === "lower_carb") {
    return { carbKcal: remainingKcal * 0.4, fatKcal: remainingKcal * 0.6 };
  }
  // Balanced: ~50/50 of remainder (similar to legacy ~28% fat of total on typical targets)
  return { carbKcal: remainingKcal * 0.52, fatKcal: remainingKcal * 0.48 };
}
