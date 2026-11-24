export type RecipeMealSlotId = "breakfast" | "lunch" | "dinner" | "snack";
export type MealSlotId = RecipeMealSlotId | "snack_2" | "snack_3";

export type KitchenEquipmentId =
  | "oven"
  | "stovetop"
  | "microwave"
  | "air_fryer"
  | "slow_cooker"
  | "instant_pot"
  | "grill"
  | "blender"
  | "toaster_oven";

/** How a recipe is cooked. */
export type CookMethod = "oven" | "stovetop" | "microwave" | "no_cook";

/** Equipment and effort, used by cooking limits. */
export interface RecipeEffort {
  /** Ways to make it; each way lists everything it needs (any one way is enough). */
  methods: CookMethod[][];
  chopping: "little" | "moderate";
  /** Hands-on minutes (oven and simmer time are hands-off). */
  activeMinutes: number;
}

/** Lower-calorie swap for white rice in rice-based recipes. */
export type CarbVariationId = "white-rice" | "riced-cauliflower" | "riced-broccoli";

/** Pan fat used to cook: olive oil is the default; butter is a swap, not a new recipe. */
export type FatVariationId = "olive-oil" | "butter";

export type IngredientCategory =
  | "Produce"
  | "Protein"
  | "Dairy"
  | "Pantry"
  | "Grains"
  | "Spices";

/** How an ingredient scales in goal-based portions. Default comes from ingredients.json. */
export type IngredientRole = "protein" | "carb" | "fat" | "vegetable" | "flavor";

export interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
  category: IngredientCategory;
  /** Per-recipe override of the ingredients.json role. */
  role?: IngredientRole;
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
  fiber?: number;
  /** When true, this variation replaces recipe.ingredients/instructions instead of adding to them. */
  replaceBase?: boolean;
  /** Change base ingredient amounts for this build, by ingredient name (e.g. half the vanilla whey). */
  baseQuantities?: Record<string, number>;
  /** Slot tags for this build. Omitted = inherit the recipe's mealSlots. */
  mealSlots?: RecipeMealSlotId[];
  /** When set, overrides recipe-level meal-prep eligibility for this build. */
  mealPrep?: boolean;
  /** Per-serving weight (grams) for this variation when known. */
  servingWeightGrams?: number;
}

export interface Recipe {
  id: string;
  number: number;
  name: string;
  cuisine: string;
  tags: string[];
  mealSlots: RecipeMealSlotId[];
  /** Tools this recipe needs. Omitted = any basic kitchen is fine. */
  equipment?: KitchenEquipmentId[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Optional authored fiber (g). When omitted, estimated from ingredients. */
  fiber?: number;
  prepMinutes: number;
  cookMinutes: number;
  /** How many servings the ingredient list makes (default 1). Stored macros are per serving. */
  servings?: number;
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
  /** Extra search terms (e.g. a former name) so filters still find the recipe. */
  searchAliases?: string[];
  /**
   * mixed = cooked together (show combined batch weight).
   * assembled = parts cooked separately (serving lines, no mixed weight).
   */
  cookStyle?: "mixed" | "assembled";
  /** Saved by the current user; included in generation and the Recipes list. */
  isUserRecipe?: boolean;
  /** Equipment and effort (built-ins get theirs from recipeEffort.ts). */
  effort?: RecipeEffort;
}

/**
 * A built-in recipe as authored: nutrition is computed from ingredients.json at load, so only
 * packaged items (label values) carry calories and macros.
 */
export type RecipeSource = Omit<Recipe, "calories" | "protein" | "carbs" | "fat"> &
  Partial<Pick<Recipe, "calories" | "protein" | "carbs" | "fat">>;

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

export type BeverageId =
  | "water"
  | "diet"
  | "milk"
  | "fat_free_milk"
  | "sweetened"
  | "protein_drink"
  | "none";

export interface PlannedMeal {
  slot: MealSlotId;
  recipe: Recipe;
  scale: number;
  mealPrep?: MealPrepInfo;
  /** Saved flavor/build for recipes with variationDetails. */
  selectedVariationId?: string;
  /** Carb base swap when the recipe includes white rice. */
  selectedCarbVariationId?: CarbVariationId;
  /** Olive oil (default) or butter for cooking fat. */
  selectedFatVariationId?: FatVariationId;
  /** Drink on this meal card. Default water. */
  beverageId?: BeverageId;
  /** Goal-based role multipliers for the user's own serving (vs. the recipe's base serving). */
  portion?: GoalPortion;
  /** User chose Keep on the "doesn't fit" notice for this meal. */
  kept?: boolean;
  /** Actual cooked batch weight the user entered (g). Shared by every day of the same batch. */
  weighedBatchGrams?: number;
  /** Whole-food sides added to reach the meal target (user's serving only). */
  sides?: RecipeIngredient[];
  /** Set by plan generation until goal portions (and any automatic side) are applied. */
  generated?: boolean;
}

export interface RoleMultipliers {
  protein: number;
  carb: number;
  fat: number;
  vegetable: number;
}

export interface GoalPortion {
  multipliers: RoleMultipliers;
  /** Meal targets this portion was sized for. */
  target: DailyTargets;
  /** Calories after rounding minus target (negative = under). */
  kcalGap: number;
  /** Within 10% of target calories with protein at target. */
  fits: boolean;
}

export interface DailyTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Daily fiber target (g). Optional in older saves. */
  fiber?: number;
}

export type MealTrackingStatus = "all" | "half" | "extra" | "skipped" | "custom";

/**
 * Stable food log. Another app can append entries in this shape.
 * The store groups them as mealTracking[date][slot]; date and slot are
 * also stored on the entry so a flat export stays readable.
 *
 * source: "recipe" (planned or chosen recipe), "manual" (typed kcal/protein),
 *         "scan" (logged from a photo, barcode or label scan; numbers still come from
 *         the recipe, USDA/Open Food Facts or the label, never from the AI).
 * recipeId + variationId: set when source is "recipe".
 * portionMultiplier: 0 skipped, 0.5 half, 1 eaten, 1.5 extra. Manual and scan use 1.
 * calories/protein/carbs/fat/fiber: logged amounts, already multiplied.
 */
export type FoodLogSource = "recipe" | "manual" | "scan";

export interface MealTrackingEntry {
  /** UI label. Prefer source + portionMultiplier for new readers. */
  status: MealTrackingStatus;
  note?: string;
  loggedAt: string;
  date?: string;
  slot?: MealSlotId;
  source?: FoodLogSource;
  recipeId?: string;
  variationId?: string;
  portionMultiplier?: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
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
