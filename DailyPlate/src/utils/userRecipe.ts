import type { IngredientCategory, MealSlotId, Recipe, RecipeIngredient, RecipeVariationDetail } from "@/types";
import type { DailyTargets } from "@/types";
import { RECIPE_SCALE_MAX, RECIPE_SCALE_MIN } from "@/utils/macroRedistribution";
import { slotsForMealsPerDay } from "@/utils/generateDayPlan";
import type { MealsPerDay } from "@/types/profile";

export const CUSTOM_RECIPE_SCALE_NOTICE =
  "This recipe may be scaled slightly to hit your goals. We prefer keeping the recipe’s quality and integrity over extreme distortion.";

export type UserRecipeDraftVariation = {
  label: string;
  ingredients: RecipeIngredient[];
  instructions: string[];
};

export type UserRecipeDraft = {
  name: string;
  mealSlot: MealSlotId;
  ingredients: RecipeIngredient[];
  instructions: string[];
  tags: string[];
  variations: UserRecipeDraftVariation[];
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
};

const SLOT_DEFAULT_MACROS: Record<MealSlotId, { calories: number; protein: number; carbs: number; fat: number }> = {
  breakfast: { calories: 420, protein: 32, carbs: 42, fat: 14 },
  lunch: { calories: 520, protein: 38, carbs: 48, fat: 16 },
  dinner: { calories: 560, protein: 42, carbs: 50, fat: 18 },
  snack: { calories: 220, protein: 18, carbs: 20, fat: 8 },
};

function hasMacroInput(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n) && n > 0;
}

function slotCalorieTarget(targets: DailyTargets, mealsPerDay: MealsPerDay | undefined, slot: MealSlotId): number {
  const slots = slotsForMealsPerDay(mealsPerDay ?? "three");
  const share = slots.includes(slot) ? slots.length : Math.max(slots.length, 1);
  return Math.max(180, Math.round(targets.calories / share));
}

function clampMildScale(scale: number): number {
  return Math.round(Math.min(RECIPE_SCALE_MAX, Math.max(RECIPE_SCALE_MIN, scale)) * 100) / 100;
}

function scaleIngredients(ings: RecipeIngredient[], scale: number): RecipeIngredient[] {
  if (scale === 1) return ings;
  return ings.map((ing) => ({
    ...ing,
    quantity: Math.round(ing.quantity * scale * 100) / 100,
  }));
}

export function slugifyLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "variation";
}

export function buildUserRecipe(
  draft: UserRecipeDraft,
  opts: {
    targets: DailyTargets;
    mealsPerDay?: MealsPerDay;
    nextNumber: number;
  },
): { recipe: Recipe; macrosAdjusted: boolean } {
  const name = draft.name.trim();
  const defaults = SLOT_DEFAULT_MACROS[draft.mealSlot];
  const userEnteredMacros =
    hasMacroInput(draft.calories) ||
    hasMacroInput(draft.protein) ||
    hasMacroInput(draft.carbs) ||
    hasMacroInput(draft.fat);

  let calories = hasMacroInput(draft.calories) ? Math.round(draft.calories) : defaults.calories;
  let protein = hasMacroInput(draft.protein) ? Math.round(draft.protein) : defaults.protein;
  let carbs = hasMacroInput(draft.carbs) ? Math.round(draft.carbs) : defaults.carbs;
  let fat = hasMacroInput(draft.fat) ? Math.round(draft.fat) : defaults.fat;

  const slotTarget = slotCalorieTarget(opts.targets, opts.mealsPerDay, draft.mealSlot);
  let scale = 1;
  let macrosAdjusted = !userEnteredMacros;
  if (calories > 0) {
    const raw = slotTarget / calories;
    if (raw < RECIPE_SCALE_MIN || raw > RECIPE_SCALE_MAX) {
      scale = clampMildScale(raw);
    } else if (Math.abs(raw - 1) > 0.04) {
      scale = clampMildScale(raw);
    }
  }
  if (scale !== 1) {
    calories = Math.round(calories * scale);
    protein = Math.round(protein * scale);
    carbs = Math.round(carbs * scale);
    fat = Math.round(fat * scale);
    macrosAdjusted = true;
  }

  const ingredients = scaleIngredients(draft.ingredients, scale);
  const variationDetails: RecipeVariationDetail[] | undefined = draft.variations.length
    ? draft.variations
        .filter((v) => v.label.trim())
        .map((v) => ({
          id: slugifyLabel(v.label),
          label: v.label.trim(),
          ingredients: scaleIngredients(v.ingredients, scale),
          instructions: v.instructions.filter((s) => s.trim()),
        }))
    : undefined;

  const recipe: Recipe = {
    id: `user-${crypto.randomUUID()}`,
    number: opts.nextNumber,
    name,
    cuisine: "Personal",
    tags: ["personal", ...draft.tags.map((t) => t.trim().toLowerCase().replace(/\s+/g, "_")).filter(Boolean)],
    mealSlots: [draft.mealSlot],
    calories,
    protein,
    carbs,
    fat,
    prepMinutes: 15,
    cookMinutes: 20,
    ingredients,
    instructions: draft.instructions.filter((s) => s.trim()),
    variationDetails,
    isUserRecipe: true,
  };

  return { recipe, macrosAdjusted };
}

export const INGREDIENT_CATEGORIES: IngredientCategory[] = [
  "Produce",
  "Protein",
  "Dairy",
  "Grains",
  "Pantry",
  "Spices",
];

export function emptyIngredient(): RecipeIngredient {
  return { name: "", quantity: 1, unit: "serving", category: "Pantry" };
}
