export type MealSlotId = "breakfast" | "lunch" | "dinner" | "snack";

/** Lower-calorie swap for white rice in rice-based recipes. */
export type CarbVariationId = "white-rice" | "riced-cauliflower" | "riced-broccoli";

export type IngredientCategory =
  | "Produce"
  | "Protein"
  | "Dairy"
  | "Pantry"
  | "Grains"
  | "Spices";

export interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
  category: IngredientCategory;
}

export interface RecipeVariationDetail {
  id: string;
  label: string;
  ingredients: RecipeIngredient[];
  instructions: string[];
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  /** Per-serving weight (grams) for this variation when known. */
  servingWeightGrams?: number;
}

export interface Recipe {
  id: string;
  number: number;
  name: string;
  cuisine: string;
  tags: string[];
  mealSlots: MealSlotId[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  prepMinutes: number;
  cookMinutes: number;
  ingredients: RecipeIngredient[];
  instructions: string[];
  /** @deprecated Use variationDetails — labels only. */
  variations?: string[];
  /** Full ingredients and steps per flavor/build. */
  variationDetails?: RecipeVariationDetail[];
  /** Per-serving weight (grams) at recipe base scale. */
  servingWeightGrams?: number;
  /** Total batch weight (grams) for standard jar meal-prep batch. */
  batchWeightGrams?: number;
  /** Standard number of jar/servings in a meal-prep batch. */
  mealPrepBatchServings?: number;
  /** Storage, reheating, and freezing guidance for batch cooking. */
  mealPrepNotes?: string;
  /** Custom photo path under /public (e.g. /recipes/my-dish.png). */
  imageUrl?: string;
  /** Saved by the current user; included in generation and the Recipes list. */
  isUserRecipe?: boolean;
}

/** Links meals cooked in one batch across multiple days. */
export type MealPrepSource = "weekly_prep" | "low_complexity" | "manual";

export interface MealPrepInfo {
  batchId: string;
  portionsCooked: number;
  portionIndex: number;
  source?: MealPrepSource;
  /** First day the batch was cooked (for leftover labeling). */
  cookDateKey?: string;
}

export interface PlannedMeal {
  slot: MealSlotId;
  recipe: Recipe;
  scale: number;
  mealPrep?: MealPrepInfo;
  /** Saved flavor/build for recipes with variationDetails. */
  selectedVariationId?: string;
  /** Carb base swap when the recipe includes white rice. */
  selectedCarbVariationId?: CarbVariationId;
}

export interface DailyTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export type MealTrackingStatus = "all" | "half" | "skipped" | "custom";

export interface MealTrackingEntry {
  status: MealTrackingStatus;
  note?: string;
  loggedAt: string;
}

/** Per-day meal logs keyed by slot. */
export type DayMealTracking = Partial<Record<MealSlotId, MealTrackingEntry>>;

export interface GroceryItem {
  key: string;
  name: string;
  quantity: number;
  unit: string;
  category: IngredientCategory;
}
