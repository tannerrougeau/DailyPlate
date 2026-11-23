import { describe, expect, it } from "vitest";
import type { UserProfile } from "@/types/profile";
import { targetsWithCalories } from "@/utils/adaptiveTdee";
import { computeDailyTargets } from "@/utils/tdee";

const profile = {
  age: 38,
  sex: "male",
  heightCm: 178,
  weightKg: 86,
  activityLevel: "moderate",
  goal: "maintain",
  proteinPreference: "recommended",
  macroSplitPreference: "balanced",
} as unknown as UserProfile;

describe("targetsWithCalories", () => {
  it("re-splits carbs and fat by the chosen ratio when calories drop", () => {
    const base = computeDailyTargets(profile);
    const lower = targetsWithCalories(profile, base.calories - 450);
    expect(lower.protein).toBe(base.protein);
    const fatKcal = lower.fat * 9;
    const carbKcal = lower.carbs * 4;
    // Balanced = 48% of the non-protein calories as fat (allow rounding).
    expect(fatKcal / (fatKcal + carbKcal)).toBeCloseTo(0.48, 1);
    expect(lower.fat).toBeLessThan(base.fat);
  });

  it("keeps fat well under 46% of calories after a cut", () => {
    const base = computeDailyTargets(profile);
    const lower = targetsWithCalories(profile, Math.round(base.calories * 0.78));
    expect((lower.fat * 9) / lower.calories).toBeLessThan(0.4);
  });
});
