/**
 * Goal-based portion report, using the app's own target calculation (computeDailyTargets +
 * splitMealTargets) for three sample profiles. For each profile and meal slot, lists the recipes
 * that cannot reach the slot target inside the role limits, how far off they are, and whether an
 * "Add side" suggestion would make the meal fit.
 *
 * Assumed for all profiles: moderate activity, Recommended protein, Balanced carb/fat split,
 * balanced meal timing, single-person household.
 *
 * Usage: npm run portions:report
 */
import { recipeLibrary } from "../src/recipes/recipeLibrary.ts";
import type { DailyTargets, MealSlotId, Recipe } from "../src/types/index.ts";
import type { UserProfile } from "../src/types/profile.ts";
import { isBeverageRecipe } from "../src/utils/beverages.ts";
import { formatPortionLine } from "../src/utils/goalPortions.ts";
import {
  isPackagedRecipe,
  mealFoodNutrition,
  mealPortionLines,
  servingSummary,
  sizeMealToTarget,
} from "../src/utils/mealPortions.ts";
import { suggestSides } from "../src/utils/mealSides.ts";
import { splitMealTargets } from "../src/utils/mealTargets.ts";
import { isSnackPlanSlot, recipeFitsSlot, slotsForProfile, withPlanningDefaults } from "../src/utils/planningPrefs.ts";
import { createPlannedMeal, defaultVariationId } from "../src/utils/recipeDisplay.ts";
import { computeDailyTargets } from "../src/utils/tdee.ts";

type Sample = { label: string; profile: UserProfile };

function sample(label: string, p: Record<string, unknown>): Sample {
  const profile = withPlanningDefaults({
    activityLevel: "moderate",
    proteinPreference: "recommended",
    macroSplitPreference: "balanced",
    mealTiming: "balanced",
    householdAdults: 1,
    householdChildren: 0,
    eatenMeals: ["breakfast", "lunch", "dinner"],
    dislikedFoodChips: [],
    favoriteFoodChips: [],
    ...p,
  } as unknown as UserProfile);
  return { label, profile };
}

const SAMPLES: Sample[] = [
  sample("60 kg woman, lose weight, 3 meals + 1 snack (35 y, 165 cm)", {
    age: 35, sex: "female", heightCm: 165, weightKg: 60, goal: "lose", snacksPerDay: 1,
  }),
  sample("80 kg man, maintain, 3 meals + 2 snacks (35 y, 178 cm)", {
    age: 35, sex: "male", heightCm: 178, weightKg: 80, goal: "maintain", snacksPerDay: 2,
  }),
  sample("100 kg man, gain weight, 3 meals + 2 snacks (30 y, 185 cm)", {
    age: 30, sex: "male", heightCm: 185, weightKg: 100, goal: "gain", snacksPerDay: 2,
  }),
];

const fmt = (t: DailyTargets) =>
  `${t.calories} kcal · ${t.protein} g protein · ${t.carbs} g carbs · ${t.fat} g fat`;

const eligible = recipeLibrary.filter((r) => !isBeverageRecipe(r) && !isPackagedRecipe(r));

function sizeFor(recipe: Recipe, slot: MealSlotId, target: DailyTargets) {
  const meal = createPlannedMeal(slot, recipe, { selectedVariationId: defaultVariationId(recipe) });
  return sizeMealToTarget(meal, target);
}

for (const { label, profile } of SAMPLES) {
  const daily = computeDailyTargets(profile);
  const slots = slotsForProfile(profile);
  const targets = splitMealTargets({
    daily,
    slots: slots.map((slot) => ({ slot, kind: "cooked" as const })),
    timing: profile.mealTiming,
  });
  console.log("=".repeat(78));
  console.log(label);
  console.log(`Daily: ${fmt(daily)}`);
  const seen = new Set<string>();
  for (const slot of slots) {
    const target = targets[slot]!;
    const kind = isSnackPlanSlot(slot) ? "snack" : slot;
    if (seen.has(kind)) continue; // snack_2 has the same target as snack
    seen.add(kind);
    const pool = eligible.filter((r) => recipeFitsSlot(r, slot));
    const misses: string[] = [];
    let fixedBySide = 0;
    for (const recipe of pool) {
      const meal = sizeFor(recipe, slot, target);
      if (meal.portion!.fits) continue;
      const n = mealFoodNutrition(meal);
      const kcal = `${meal.portion!.kcalGap >= 0 ? "+" : ""}${meal.portion!.kcalGap} kcal`;
      const protein = isSnackPlanSlot(slot)
        ? ""
        : `, protein ${Math.round(n.protein)}/${target.protein} g (${Math.round(n.protein - target.protein) >= 0 ? "+" : ""}${Math.round(n.protein - target.protein)})`;
      const side = suggestSides(n, target, slot);
      const sideNote = side?.fits ? ` → fits with side: ${side.label}` : side ? ` → side helps: ${side.label}` : "";
      if (side?.fits) fixedBySide += 1;
      misses.push(`    ${recipe.name}: ${kcal}${protein}${sideNote}`);
    }
    console.log("");
    console.log(`  ${kind[0]!.toUpperCase()}${kind.slice(1)} target: ${fmt(target)}`);
    console.log(`  ${misses.length} of ${pool.length} recipes miss${misses.length ? ` (${fixedBySide} fit once a side is added):` : "."}`);
    for (const line of misses) console.log(line);
  }
  // Teriyaki at this profile's dinner target
  const teriyaki = recipeLibrary.find((r) => r.name === "Teriyaki Turkey Rice Bowls")!;
  const dinner = sizeFor(teriyaki, "dinner", targets.dinner!);
  console.log("");
  console.log(`  Teriyaki Turkey Rice Bowls at this dinner target (${targets.dinner!.calories} kcal):`);
  for (const line of mealPortionLines(dinner, 1)) console.log(`    ${formatPortionLine(line)}`);
  const n = mealFoodNutrition(dinner);
  console.log(`    ${servingSummary(dinner)?.text}`);
  console.log(
    `    ${Math.round(n.calories)} kcal · ${Math.round(n.protein)} g protein · ${Math.round(n.carbs)} g carbs · ${Math.round(n.fat)} g fat — ${dinner.portion!.fits ? "fits" : "does not fit"}`,
  );
}
