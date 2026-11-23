import type {
  BeverageId,
  DailyTargets,
  GroceryItem,
  IngredientCategory,
  MealSlotId,
  PlannedMeal,
  Recipe,
  RecipeMealSlotId,
} from "@/types";

export type { BeverageId };
import { mealFoodNutrition } from "@/utils/mealPortions";

export interface Beverage {
  id: BeverageId;
  label: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  servingLabel?: string;
  grocery?: {
    name: string;
    quantity: number;
    unit: string;
    category: IngredientCategory;
  };
}

export const DEFAULT_BEVERAGE_ID: BeverageId = "water";

export const BEVERAGES: Beverage[] = [
  { id: "water", label: "Water", calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  {
    id: "diet",
    label: "Diet beverage",
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    servingLabel: "12 fl oz",
    grocery: {
      name: "Diet beverage (zero-calorie soda, sparkling water, or similar)",
      quantity: 12,
      unit: "fl oz",
      category: "Pantry",
    },
  },
  {
    id: "milk",
    label: "Milk",
    calories: 122,
    protein: 8,
    carbs: 12,
    fat: 5,
    fiber: 0,
    servingLabel: "1 cup",
    grocery: { name: "Milk (2%)", quantity: 1, unit: "cup", category: "Dairy" },
  },
  {
    id: "fat_free_milk",
    label: "Fat-free milk",
    calories: 83,
    protein: 8,
    carbs: 12,
    fat: 0,
    fiber: 0,
    servingLabel: "1 cup",
    grocery: { name: "Fat-free milk", quantity: 1, unit: "cup", category: "Dairy" },
  },
  {
    id: "sweetened",
    label: "Sweetened drink",
    calories: 140,
    protein: 0,
    carbs: 39,
    fat: 0,
    fiber: 0,
    servingLabel: "12 fl oz",
    grocery: {
      name: "Sweetened drink (soda, juice, or similar)",
      quantity: 12,
      unit: "fl oz",
      category: "Pantry",
    },
  },
  { id: "none", label: "None", calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
];

export function isBeverageRecipe(recipe: Pick<Recipe, "id" | "tags">): boolean {
  return recipe.tags.includes("beverage") || recipe.id.startsWith("bev-");
}

export function resolveBeverage(id: BeverageId | null | undefined): Beverage {
  return BEVERAGES.find((b) => b.id === id) ?? BEVERAGES[0]!;
}

export function beverageOptionLabel(drink: Beverage): string {
  return drink.servingLabel ? `${drink.label}, ${drink.servingLabel}` : drink.label;
}

export function beverageLine(id: BeverageId | null | undefined): string {
  return `Drink: ${beverageOptionLabel(resolveBeverage(id))}.`;
}

export function canonicalBeverageSlot(slot: MealSlotId): RecipeMealSlotId {
  if (slot === "snack_2" || slot === "snack_3" || slot === "snack") return "snack";
  return slot;
}

export function defaultBeverageForSlot(
  lastBySlot: Partial<Record<RecipeMealSlotId, BeverageId>> | null | undefined,
  slot: MealSlotId,
): BeverageId {
  return lastBySlot?.[canonicalBeverageSlot(slot)] ?? DEFAULT_BEVERAGE_ID;
}

/** Food (goal-sized portion) plus the drink. Drinks are counted in the meal targets, so food is not shrunk. */
export function mealMacrosWithBeverage(meal: PlannedMeal): DailyTargets {
  const drink = resolveBeverage(meal.beverageId);
  const food = mealFoodNutrition(meal);
  return {
    calories: food.calories + drink.calories,
    protein: food.protein + drink.protein,
    carbs: food.carbs + drink.carbs,
    fat: food.fat + drink.fat,
    fiber: food.fiber + drink.fiber,
  };
}

export function applySlotBeverageDefaults(
  meals: PlannedMeal[],
  lastBySlot?: Partial<Record<RecipeMealSlotId, BeverageId>> | null,
  existing?: PlannedMeal[] | null,
): PlannedMeal[] {
  return meals.map((meal) => {
    if (meal.beverageId) return meal;
    const prior = existing?.find((m) => m.slot === meal.slot);
    return {
      ...meal,
      beverageId: prior?.beverageId ?? defaultBeverageForSlot(lastBySlot, meal.slot),
    };
  });
}

export function groceryItemForBeverage(
  drink: Beverage,
  householdMultiplier: number,
): GroceryItem | null {
  if (!drink.grocery) return null;
  const quantity = drink.grocery.quantity * householdMultiplier;
  if (!(quantity > 0)) return null;
  const key = `${drink.grocery.category}::${drink.grocery.name.toLowerCase()}::${drink.grocery.unit}`;
  return {
    key,
    name: drink.grocery.name,
    quantity,
    unit: drink.grocery.unit,
    category: drink.grocery.category,
  };
}
