import type {
  DailyTargets,
  GoalPortion,
  IngredientRole,
  PlannedMeal,
  Recipe,
  RecipeIngredient,
  RoleMultipliers,
} from "@/types";
import {
  addNutrients,
  cookedPerMeasured,
  gramsForIngredient,
  gramsPerUnit,
  ingredientRole,
  ingredientState,
  matchIngredient,
  normalizeUnit,
  nutritionForGrams,
  ZERO_NUTRIENTS,
  type IngredientState,
  type NutrientVector,
} from "@/utils/ingredientNutrition";
import { formatPracticalQty, roundIngredientQuantity } from "@/utils/practicalScaling";

/** Recognizable-recipe limits per role (multiplier of the base serving amount). */
export const ROLE_LIMITS: Record<keyof RoleMultipliers, { min: number; max: number }> = {
  protein: { min: 0.5, max: 1.75 },
  carb: { min: 0.5, max: 1.75 },
  fat: { min: 0.5, max: 1.75 },
  vegetable: { min: 0.85, max: 1.15 },
};

/** Fit: calories within 10% or 50 kcal of target (whichever is larger), protein at target (2 g allowance). */
export const FIT_KCAL_TOLERANCE = 0.1;
export const FIT_KCAL_MIN_TOLERANCE = 50;
export const FIT_PROTEIN_ALLOWANCE_G = 2;

export const UNIFORM_MULTIPLIERS: RoleMultipliers = { protein: 1, carb: 1, fat: 1, vegetable: 1 };

/** Units counted as whole (or half) items rather than weighed. */
const COUNT_UNITS = new Set([
  "large", "each", "medium", "small", "slice", "clove", "can", "pack", "stick", "wheel",
  "bar", "bag", "bottle", "spear", "spears", "pcs", "scoop", "leaves",
]);
const HALF_STEP_COUNT = /banana|apple|avocado|potato|sweet potato|cucumber|zucchini|pepper|lemon|tomato/i;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function multiplierForRole(m: RoleMultipliers, role: IngredientRole): number {
  return role === "flavor" ? 1 : m[role];
}

type BaseLine = {
  ing: RecipeIngredient;
  role: IngredientRole;
  /** Grams in the measured state for one base serving; null when unmatched. */
  grams: number | null;
  nutrition: NutrientVector | null;
};

function baseLines(ingredients: RecipeIngredient[]): BaseLine[] {
  return ingredients.map((ing) => {
    const grams = gramsForIngredient(ing);
    return {
      ing,
      role: ingredientRole(ing),
      grams,
      nutrition: grams == null ? null : nutritionForGrams(ing.name, grams),
    };
  });
}

function kcal(n: NutrientVector): number {
  return n.calories;
}

function roleSums(lines: BaseLine[]): Record<IngredientRole, NutrientVector> {
  const sums: Record<IngredientRole, NutrientVector> = {
    protein: { ...ZERO_NUTRIENTS },
    carb: { ...ZERO_NUTRIENTS },
    fat: { ...ZERO_NUTRIENTS },
    vegetable: { ...ZERO_NUTRIENTS },
    flavor: { ...ZERO_NUTRIENTS },
  };
  for (const l of lines) {
    if (l.nutrition) sums[l.role] = addNutrients(sums[l.role], l.nutrition);
  }
  return sums;
}

function nutritionAt(sums: Record<IngredientRole, NutrientVector>, m: RoleMultipliers): NutrientVector {
  let n = { ...sums.flavor };
  n = addNutrients(n, sums.protein, m.protein);
  n = addNutrients(n, sums.carb, m.carb);
  n = addNutrients(n, sums.fat, m.fat);
  n = addNutrients(n, sums.vegetable, m.vegetable);
  return n;
}

/**
 * Role multipliers (before rounding): protein role first to reach the protein target, then carb
 * and fat roles share the remaining calories in the target's carb/fat calorie split. Leftover gap
 * goes to protein (only upward), then vegetables, all inside ROLE_LIMITS.
 */
export function solveRoleMultipliers(
  ingredients: RecipeIngredient[],
  target: DailyTargets,
): RoleMultipliers {
  const lines = baseLines(ingredients);
  const S = roleSums(lines);
  const m: RoleMultipliers = { ...UNIFORM_MULTIPLIERS };
  const L = ROLE_LIMITS;
  const carbKcal = Math.max(0, target.carbs) * 4;
  const fatKcal = Math.max(0, target.fat) * 9;
  const carbShare = carbKcal + fatKcal > 0 ? carbKcal / (carbKcal + fatKcal) : 0.5;
  const hasP = S.protein.protein > 0;
  const hasC = kcal(S.carb) > 0;
  const hasF = kcal(S.fat) > 0;

  for (let iter = 0; iter < 4; iter++) {
    if (hasP) {
      const other =
        S.flavor.protein +
        m.carb * S.carb.protein +
        m.fat * S.fat.protein +
        m.vegetable * S.vegetable.protein;
      m.protein = clamp((target.protein - other) / S.protein.protein, L.protein.min, L.protein.max);
    }
    const rest = kcal(S.flavor) + m.protein * kcal(S.protein) + m.vegetable * kcal(S.vegetable);
    const R = target.calories - rest;
    if (hasC && hasF) {
      m.carb = clamp((R * carbShare) / kcal(S.carb), L.carb.min, L.carb.max);
      m.fat = clamp((R * (1 - carbShare)) / kcal(S.fat), L.fat.min, L.fat.max);
      const left = R - m.carb * kcal(S.carb) - m.fat * kcal(S.fat);
      if (Math.abs(left) > 1) {
        // One role hit a limit: move the leftover to the other.
        m.fat = clamp(m.fat + left / kcal(S.fat), L.fat.min, L.fat.max);
        const left2 = R - m.carb * kcal(S.carb) - m.fat * kcal(S.fat);
        m.carb = clamp(m.carb + left2 / kcal(S.carb), L.carb.min, L.carb.max);
      }
    } else if (hasC) {
      m.carb = clamp(R / kcal(S.carb), L.carb.min, L.carb.max);
    } else if (hasF) {
      m.fat = clamp(R / kcal(S.fat), L.fat.min, L.fat.max);
    }
  }

  let gap = target.calories - kcal(nutritionAt(S, m));
  if (gap > 0 && kcal(S.protein) > 0) {
    m.protein = clamp(m.protein + gap / kcal(S.protein), m.protein, L.protein.max);
    gap = target.calories - kcal(nutritionAt(S, m));
  }
  if (Math.abs(gap) > 1 && kcal(S.vegetable) > 0) {
    m.vegetable = clamp(1 + gap / kcal(S.vegetable), L.vegetable.min, L.vegetable.max);
  }
  return m;
}

/** One rounded ingredient line for display, groceries, and nutrition. */
export type PortionLine = {
  /** Rounded amount in the recipe's unit (for grocery lists and legacy display). */
  ingredient: RecipeIngredient;
  role: IngredientRole;
  state: IngredientState;
  /** Rounded grams as measured (raw, dry, or as sold); rice is shown dry. Null when unmatched. */
  grams: number | null;
  /** Grams used for nutrition (cooked grams for foods stored cooked, e.g. rice). */
  nutritionGrams: number | null;
  /** Label for the measured amount: raw, dry, cooked, or "". */
  stateLabel: string;
  /** Count items (eggs, slices, tortillas) keep their count. */
  count: number | null;
};

function shownAsDry(name: string): { cookedPerDry: number; dryCupGrams?: number } | null {
  const food = matchIngredient(name);
  const y = food?.yield;
  if (food?.state === "cooked" && y && y.cookedPerRaw > 1 && y.dryCupGrams) {
    return { cookedPerDry: y.cookedPerRaw, dryCupGrams: y.dryCupGrams };
  }
  return null;
}

function roundTspTbsp(name: string, unit: string, grams: number): { qty: number; unit: string } | null {
  const perTsp = gramsPerUnit(name, "tsp");
  if (!perTsp) return null;
  const tsp = grams / perTsp;
  if (tsp < 1) {
    return { qty: Math.max(0.25, Math.round(tsp * 4) / 4), unit: "tsp" };
  }
  if (tsp < 3 || normalizeUnit(unit) === "tsp") {
    return { qty: Math.max(1, Math.round(tsp)), unit: "tsp" };
  }
  return { qty: Math.max(0.5, Math.round((tsp / 3) * 2) / 2), unit: "tbsp" };
}

/** Round one scaled ingredient to a practical amount, keeping grams for nutrition. */
export function roundPortionLine(ing: RecipeIngredient, rawQty: number, role: IngredientRole): PortionLine {
  const unit = normalizeUnit(ing.unit);
  const name = ing.name;
  const state = ingredientState(name);
  const stateLabel = state === "as-sold" ? "" : state;
  const perUnit = gramsPerUnit(name, unit);
  const base = { role, state };

  if (!perUnit || !matchIngredient(name)) {
    const qty = roundIngredientQuantity(ing, rawQty);
    return {
      ...base,
      ingredient: { ...ing, quantity: qty },
      grams: null,
      nutritionGrams: null,
      stateLabel,
      count: null,
    };
  }

  if (unit === "pinch") {
    const qty = Math.max(1, Math.round(rawQty));
    const g = qty * perUnit;
    return { ...base, ingredient: { ...ing, quantity: qty }, grams: g, nutritionGrams: g, stateLabel: "", count: null };
  }

  if (COUNT_UNITS.has(unit) || /tortilla/i.test(name)) {
    const halves = unit === "scoop" || (HALF_STEP_COUNT.test(name) && !/egg/i.test(name));
    const qty = halves
      ? Math.max(0.5, Math.round(rawQty * 2) / 2)
      : Math.max(1, Math.round(rawQty));
    const g = qty * perUnit;
    return {
      ...base,
      ingredient: { ...ing, quantity: qty },
      grams: Math.round(g),
      nutritionGrams: g,
      stateLabel,
      count: qty,
    };
  }

  const rawGrams = rawQty * perUnit;
  const dry = shownAsDry(name);
  if (dry) {
    const dryGrams = Math.max(5, Math.round(rawGrams / dry.cookedPerDry / 5) * 5);
    const cooked = dryGrams * dry.cookedPerDry;
    return {
      ...base,
      ingredient: { ...ing, quantity: cooked / perUnit },
      grams: dryGrams,
      nutritionGrams: cooked,
      stateLabel: "dry",
      count: null,
    };
  }

  if (unit === "tsp" || unit === "tbsp") {
    const r = roundTspTbsp(name, unit, rawGrams);
    if (r) {
      const per = gramsPerUnit(name, r.unit) ?? perUnit;
      const g = r.qty * per;
      return {
        ...base,
        ingredient: { ...ing, quantity: r.qty, unit: r.unit },
        grams: Math.round(g),
        nutritionGrams: g,
        stateLabel,
        count: null,
      };
    }
  }

  const g = Math.max(5, Math.round(rawGrams / 5) * 5);
  return {
    ...base,
    ingredient: { ...ing, quantity: g / perUnit },
    grams: g,
    nutritionGrams: g,
    stateLabel,
    count: null,
  };
}

/** Scaled + rounded lines for `servings` portions at the given role multipliers. */
export function portionLines(
  ingredients: RecipeIngredient[],
  multipliers: RoleMultipliers,
  servings = 1,
): PortionLine[] {
  return ingredients.map((ing) => {
    const role = ingredientRole(ing);
    const raw = ing.quantity * multiplierForRole(multipliers, role) * servings;
    return roundPortionLine(ing, raw, role);
  });
}

/** Nutrition of rounded lines ÷ servings; null when any line is unmatched. */
export function nutritionOfLines(lines: PortionLine[], servings = 1): NutrientVector | null {
  let total = { ...ZERO_NUTRIENTS };
  for (const line of lines) {
    if (line.nutritionGrams == null) return null;
    const n = nutritionForGrams(line.ingredient.name, line.nutritionGrams);
    if (!n) return null;
    total = addNutrients(total, n);
  }
  const s = servings > 0 ? servings : 1;
  return {
    calories: total.calories / s,
    protein: total.protein / s,
    carbs: total.carbs / s,
    fat: total.fat / s,
    fiber: total.fiber / s,
  };
}

/** Allowed calorie miss for a target: 10% or 50 kcal, whichever is larger. */
export function fitKcalTolerance(target: Pick<DailyTargets, "calories">): number {
  return Math.max(target.calories * FIT_KCAL_TOLERANCE, FIT_KCAL_MIN_TOLERANCE);
}

/** Snacks are checked on calories only (`caloriesOnly`). */
export function fitsTarget(
  n: Pick<NutrientVector, "calories" | "protein">,
  target: DailyTargets,
  opts: { caloriesOnly?: boolean } = {},
): boolean {
  if (!(target.calories > 0)) return true;
  const kcalOk = Math.abs(n.calories - target.calories) <= fitKcalTolerance(target);
  if (opts.caloriesOnly) return kcalOk;
  const proteinOk = n.protein >= target.protein - FIT_PROTEIN_ALLOWANCE_G;
  return kcalOk && proteinOk;
}

export type PortionResult = GoalPortion & { nutrition: NutrientVector; lines: PortionLine[] };

/**
 * Size one serving to a meal target: solve role multipliers, round, recalculate from the rounded
 * amounts, and check the fit. Unmatched ingredients fall back to stored macros scaled uniformly.
 */
export function sizePortion(
  ingredients: RecipeIngredient[],
  target: DailyTargets,
  storedFallback: NutrientVector,
  opts: { extra?: NutrientVector; caloriesOnly?: boolean } = {},
): PortionResult {
  const extra = opts.extra ?? ZERO_NUTRIENTS;
  const fitOpts = { caloriesOnly: opts.caloriesOnly };
  // Sides are fixed amounts: size the recipe to what is left, then judge the meal as a whole.
  const inner: DailyTargets = {
    calories: Math.max(0, target.calories - extra.calories),
    protein: Math.max(0, target.protein - extra.protein),
    carbs: Math.max(0, target.carbs - extra.carbs),
    fat: Math.max(0, target.fat - extra.fat),
    fiber: Math.max(0, (target.fiber ?? 0) - extra.fiber),
  };
  const matched = ingredients.every((ing) => gramsForIngredient(ing) != null);
  if (!matched) {
    const u = storedFallback.calories > 0
      ? clamp(inner.calories / storedFallback.calories, ROLE_LIMITS.carb.min, ROLE_LIMITS.carb.max)
      : 1;
    const multipliers = { protein: u, carb: u, fat: u, vegetable: 1 };
    const nutrition = addNutrients(scaleNutrients(storedFallback, u), extra);
    return {
      multipliers,
      target,
      nutrition,
      lines: portionLines(ingredients, multipliers),
      kcalGap: Math.round(nutrition.calories - target.calories),
      fits: fitsTarget(nutrition, target, fitOpts),
    };
  }
  const multipliers = solveRoleMultipliers(ingredients, inner);
  const lines = portionLines(ingredients, multipliers);
  const nutrition = addNutrients(nutritionOfLines(lines) ?? scaleNutrients(storedFallback, 1), extra);
  return {
    multipliers,
    target,
    nutrition,
    lines,
    kcalGap: Math.round(nutrition.calories - target.calories),
    fits: fitsTarget(nutrition, target, fitOpts),
  };
}

export function scaleNutrients(n: NutrientVector, times: number): NutrientVector {
  return addNutrients({ ...ZERO_NUTRIENTS }, n, times);
}

// ---------- Serving weight ----------

/** Vegetables lose water only when cooked into the dish; meats and grains always cook. */
function cookedGramsForLine(line: PortionLine, cookedTogether: boolean): number {
  if (line.nutritionGrams == null) return 0;
  const name = line.ingredient.name;
  if (line.state === "cooked") return line.nutritionGrams;
  if (line.role === "vegetable" && !cookedTogether) return line.nutritionGrams;
  if (line.state === "raw" || line.state === "dry") {
    return line.nutritionGrams * cookedPerMeasured(name);
  }
  return line.nutritionGrams;
}

export function cookedWeightOfLines(lines: PortionLine[], cookedTogether: boolean): number {
  return lines.reduce((s, l) => s + cookedGramsForLine(l, cookedTogether), 0);
}

export function cookedGramsOfLine(line: PortionLine, cookedTogether: boolean): number {
  return cookedGramsForLine(line, cookedTogether);
}

// ---------- Display ----------

const PLURAL_UNIT: Record<string, string> = { slice: "slices", clove: "cloves", can: "cans", stick: "sticks", bar: "bars" };

function householdMeasure(line: PortionLine): string | null {
  if (line.grams == null) return null;
  const name = line.ingredient.name;
  const dry = shownAsDry(name);
  if (dry?.dryCupGrams) return cupsText(snapCup(line.grams / dry.dryCupGrams));
  const unit = normalizeUnit(line.ingredient.unit);
  if (unit === "oz") {
    const oz = Math.round((line.grams / 28.3495) * 2) / 2;
    // A pound or more reads better in pounds: 680 g → "1½ lb".
    if (oz >= 16) return `${formatPracticalQty(Math.round((oz / 16) * 4) / 4)} lb`;
    return `${formatPracticalQty(oz)} oz`;
  }
  const cupG = gramsPerUnit(name, "cup");
  if (unit === "cup" || (unit === "g" && cupG)) {
    if (cupG) {
      const cups = line.grams / cupG;
      if (cups >= 0.2) return cupsText(snapCup(cups));
      const tbspG = gramsPerUnit(name, "tbsp");
      if (tbspG) return `${formatPracticalQty(Math.max(0.5, Math.round((line.grams / tbspG) * 2) / 2))} tbsp`;
    }
  }
  if (unit === "tbsp" || unit === "tsp") return null;
  return null;
}

function cupsText(cups: number): string {
  return `${formatPracticalQty(cups)} ${cups > 1 ? "cups" : "cup"}`;
}

function snapCup(cups: number): number {
  const steps = [0.25, 1 / 3, 0.5, 2 / 3, 0.75, 1];
  const whole = Math.floor(cups);
  const frac = cups - whole;
  if (frac < 0.125) return Math.max(whole, 0.25);
  let best = steps[0]!;
  for (const s of steps) if (Math.abs(frac - s) < Math.abs(frac - best)) best = s;
  return whole + best;
}

/**
 * e.g. "Ground turkey: 680 g raw (about 1½ lb)", "Rice: 300 g dry (about 1½ cups)",
 * "Eggs: 3 large (150 g)", "Olive oil: 2 tsp".
 */
export function formatPortionLine(line: PortionLine): string {
  const ing = line.ingredient;
  const unit = normalizeUnit(ing.unit);
  const name = displayName(ing.name, line.stateLabel === "dry");
  if (line.grams == null) {
    return `${name}: ${formatPracticalQty(ing.quantity)} ${ing.unit}`;
  }
  if (line.count != null) {
    const qty = formatPracticalQty(line.count);
    const u = line.count >= 1.5 && PLURAL_UNIT[unit] ? PLURAL_UNIT[unit]! : ing.unit;
    return `${name}: ${qty} ${u} (${line.grams} g)`;
  }
  if (unit === "tsp" || unit === "tbsp" || unit === "pinch") {
    const grams = line.grams >= 10 ? ` (${line.grams} g)` : "";
    return `${name}: ${formatPracticalQty(ing.quantity)} ${ing.unit}${grams}`;
  }
  const label = line.stateLabel ? ` ${line.stateLabel}` : "";
  const measure = householdMeasure(line);
  return `${name}: ${line.grams} g${label}${measure ? ` (about ${measure})` : ""}`;
}

/** Drop "Cooked" from a name when the line is shown as a dry amount. */
function displayName(name: string, dry: boolean): string {
  if (!dry) return name;
  const stripped = name.replace(/^cooked\s+/i, "").replace(/\s*\(cooked\)/i, "");
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

export function portionLineKey(line: PortionLine): string {
  return `${line.ingredient.name}-${line.ingredient.unit}`;
}

export type MealPortionInput = Pick<PlannedMeal, "portion" | "scale"> & { recipe: Recipe };
