import type { DailyTargets, MealSlotId, RecipeIngredient } from "@/types";
import { nutritionOfLines, roundPortionLine, type PortionLine } from "@/utils/goalPortions";
import { ingredientRole, ZERO_NUTRIENTS, type NutrientVector } from "@/utils/ingredientNutrition";
import { formatPracticalQty } from "@/utils/practicalScaling";
import { isSnackPlanSlot } from "@/utils/planningPrefs";

/** A simple whole-food side: an ingredients.json alias, the amounts it may be offered in, and a short label. */
type SideOption = {
  name: string;
  unit: string;
  category: RecipeIngredient["category"];
  amounts: number[];
  label: (qty: number) => string;
};

const plural = (qty: number, one: string, many: string) => (qty > 1 ? many : one);

const TOAST: SideOption = {
  name: "Bread (for toast)",
  unit: "slice",
  category: "Grains",
  amounts: [1, 2],
  label: (q) => `${q} ${plural(q, "slice", "slices")} whole-grain toast`,
};
const BREAD: SideOption = {
  ...TOAST,
  label: (q) => `${q} ${plural(q, "slice", "slices")} whole-grain bread`,
};
const BANANA: SideOption = {
  name: "Banana",
  unit: "medium",
  category: "Produce",
  amounts: [1],
  label: () => "1 banana",
};
const APPLE: SideOption = {
  name: "Apple",
  unit: "medium",
  category: "Produce",
  amounts: [1],
  label: () => "1 apple",
};
const BERRIES: SideOption = {
  name: "Berries",
  unit: "cup",
  category: "Produce",
  amounts: [0.5, 1],
  label: (q) => `${formatPracticalQty(q)} cup berries`,
};
const OATS: SideOption = {
  name: "Rolled oats",
  unit: "g",
  category: "Grains",
  amounts: [30, 40, 60],
  label: (q) => `${q} g oats (dry)`,
};
const MILK: SideOption = {
  name: "Milk (2%)",
  unit: "cup",
  category: "Dairy",
  amounts: [0.5, 1],
  label: (q) => `${formatPracticalQty(q)} cup milk`,
};
const YOGURT: SideOption = {
  name: "Plain Greek yogurt",
  unit: "cup",
  category: "Dairy",
  amounts: [0.5, 0.75, 1],
  label: (q) => `${formatPracticalQty(q)} cup Greek yogurt`,
};
const RICE: SideOption = {
  name: "Cooked rice",
  unit: "cup",
  category: "Grains",
  amounts: [0.5, 0.75, 1],
  label: (q) => `${formatPracticalQty(q)} cup cooked rice`,
};
const POTATO: SideOption = {
  name: "Potato (cubed)",
  unit: "medium",
  category: "Produce",
  amounts: [0.5, 1],
  label: (q) => (q === 1 ? "1 potato" : `${formatPracticalQty(q)} potato`),
};

const BREAKFAST_SIDES = [TOAST, BANANA, APPLE, BERRIES, OATS, MILK, YOGURT];
const MAIN_SIDES = [RICE, POTATO, BREAD, BANANA, APPLE];

/** Sides offered for a slot: breakfast vs lunch/dinner. Snacks get none. */
export function sideOptionsForSlot(slot: MealSlotId): SideOption[] {
  if (isSnackPlanSlot(slot)) return [];
  return slot === "breakfast" ? BREAKFAST_SIDES : MAIN_SIDES;
}

const ALL_SIDES = [...BREAKFAST_SIDES, ...MAIN_SIDES];

/** Short label for a saved side ("1 banana"), falling back to its amount and name. */
export function sideLabel(side: RecipeIngredient): string {
  const opt = ALL_SIDES.find((o) => o.name === side.name && o.unit === side.unit);
  if (opt) return opt.label(side.quantity);
  return `${formatPracticalQty(side.quantity)} ${side.unit} ${side.name}`;
}

/** Rounded lines for sides (same rounding rules as recipe ingredients). */
export function sideLines(sides: RecipeIngredient[] | undefined, servings = 1): PortionLine[] {
  return (sides ?? []).map((s) => roundPortionLine(s, s.quantity * servings, ingredientRole(s)));
}

export function sidesNutrition(sides: RecipeIngredient[] | undefined): NutrientVector {
  if (!sides?.length) return { ...ZERO_NUTRIENTS };
  return nutritionOfLines(sideLines(sides)) ?? { ...ZERO_NUTRIENTS };
}

export type SideSuggestion = {
  sides: RecipeIngredient[];
  /** "1 slice whole-grain toast + 1 banana" */
  label: string;
  nutrition: NutrientVector;
  /** Meal + sides lands inside the fit range. */
  fits: boolean;
};

type Candidate = { sides: RecipeIngredient[]; labels: string[]; n: NutrientVector };

function candidatesFor(slot: MealSlotId): Candidate[] {
  const singles: Candidate[] = [];
  for (const opt of sideOptionsForSlot(slot)) {
    for (const qty of opt.amounts) {
      const side: RecipeIngredient = { name: opt.name, quantity: qty, unit: opt.unit, category: opt.category };
      singles.push({ sides: [side], labels: [opt.label(qty)], n: sidesNutrition([side]) });
    }
  }
  const pairs: Candidate[] = [];
  for (let a = 0; a < singles.length; a++) {
    for (let b = a + 1; b < singles.length; b++) {
      const sa = singles[a]!;
      const sb = singles[b]!;
      if (sa.sides[0]!.name === sb.sides[0]!.name) continue;
      pairs.push({
        sides: [...sa.sides, ...sb.sides],
        labels: [...sa.labels, ...sb.labels],
        n: {
          calories: sa.n.calories + sb.n.calories,
          protein: sa.n.protein + sb.n.protein,
          carbs: sa.n.carbs + sb.n.carbs,
          fat: sa.n.fat + sb.n.fat,
          fiber: sa.n.fiber + sb.n.fiber,
        },
      });
    }
  }
  return [...singles, ...pairs];
}

/**
 * One or two sides that best close a calorie gap (and the protein gap when protein is short).
 * Only for meals more than 10% under their calorie target. Returns null for snacks or when no side helps.
 */
export function suggestSides(
  current: Pick<NutrientVector, "calories" | "protein">,
  target: DailyTargets,
  slot: MealSlotId,
): SideSuggestion | null {
  if (isSnackPlanSlot(slot) || !(target.calories > 0)) return null;
  const gap = target.calories - current.calories;
  if (gap <= target.calories * 0.1) return null;
  const proteinShort = Math.max(0, target.protein - current.protein);
  let best: { c: Candidate; cost: number } | null = null;
  for (const c of candidatesFor(slot)) {
    const kcal = current.calories + c.n.calories;
    const kcalErr = Math.abs(target.calories - kcal);
    const stillShort = Math.max(0, target.protein - 2 - (current.protein + c.n.protein));
    const cost =
      kcalErr +
      (proteinShort > 2 ? stillShort * 12 : 0) +
      (c.sides.length > 1 ? 20 : 0);
    if (!best || cost < best.cost) best = { c, cost };
  }
  if (!best) return null;
  const after = current.calories + best.c.n.calories;
  if (Math.abs(target.calories - after) >= gap) return null;
  return {
    sides: best.c.sides,
    label: best.c.labels.join(" + "),
    nutrition: best.c.n,
    fits:
      Math.abs(target.calories - after) <= target.calories * 0.1 &&
      current.protein + best.c.n.protein >= target.protein - 2,
  };
}
