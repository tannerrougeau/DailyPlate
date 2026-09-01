import type { RecipeIngredient } from "@/types";

const FLEXIBLE_INGREDIENT =
  /cheese|oil|butter|sauce|dressing|seasoning|spice|herb|pepper|salt|honey|maple|sweetener|cocoa|jam|vinegar|mayo|parsley|tzatziki|salsa|broth|marmalade|cornstarch|crouton|parmesan|feta|granola|chia|almond milk|milk/i;

const RIGID_PROTEIN =
  /egg|bacon|ham|turkey|chicken|beef|salmon|tuna|shrimp|fish|sausage|ground|protein powder|cottage cheese|greek yogurt|rotisserie|egg white/i;

const SIMPLE_FRACTIONS = [0, 0.25, 0.33, 0.5, 0.67, 0.75];

function normalizeUnit(unit: string): string {
  const u = unit.toLowerCase().trim();
  if (u === "cups") return "cup";
  if (u === "cloves") return "clove";
  if (u === "slices") return "slice";
  if (u === "tablespoons" || u === "tablespoon") return "tbsp";
  if (u === "teaspoons" || u === "teaspoon") return "tsp";
  if (u === "grams") return "g";
  return u;
}

function snapToSimpleFraction(value: number): number {
  if (value <= 0) return 0;
  const whole = Math.floor(value + 1e-9);
  const frac = value - whole;
  if (frac < 0.08) return whole;
  let best = 0;
  let bestDist = Infinity;
  for (const f of SIMPLE_FRACTIONS) {
    const dist = Math.abs(frac - f);
    if (dist < bestDist) {
      bestDist = dist;
      best = f;
    }
  }
  return whole + best;
}

function roundToStep(value: number, step: number, min = step): number {
  if (value <= 0) return 0;
  const rounded = Math.round(value / step) * step;
  return snapToSimpleFraction(Math.max(min, rounded));
}

/** Round a scaled quantity to a practical kitchen amount. */
export function roundIngredientQuantity(
  ing: RecipeIngredient,
  rawQty: number,
): number {
  if (rawQty <= 0) return 0;

  const unit = normalizeUnit(ing.unit);
  const name = ing.name.toLowerCase();

  if (unit === "large" && /egg/.test(name)) {
    return Math.max(1, Math.round(rawQty));
  }

  if (unit === "slice") {
    return Math.max(1, Math.round(rawQty));
  }

  if (["clove", "pack", "medium", "spear", "can"].includes(unit)) {
    return Math.max(1, Math.round(rawQty));
  }

  if (unit === "fl oz" || unit === "floz") {
    return roundToStep(rawQty, 1, 1);
  }

  if (unit === "pcs") {
    if (rawQty < 0.75) return 0.5;
    return Math.max(1, Math.round(rawQty));
  }

  if (/tortilla|wrap/.test(name) && !["cup", "tbsp", "tsp", "oz", "g"].includes(unit)) {
    return Math.max(1, Math.round(rawQty));
  }

  if (unit === "scoop") {
    return roundToStep(rawQty, 0.25, 0.25);
  }

  if (unit === "g") {
    const step = /oat|rice|pasta|powder/i.test(name) ? 5 : 10;
    return Math.max(step, Math.round(rawQty / step) * step);
  }

  if (unit === "oz") {
    if (/ground|chicken|beef|turkey|salmon|tuna|sausage|thigh|breast|fish|shrimp|rotisserie/i.test(name)) {
      return Math.max(1, Math.round(rawQty));
    }
    return roundToStep(rawQty, 0.5, 0.5);
  }

  if (unit === "cup") {
    return roundToStep(rawQty, 0.25, 0.25);
  }

  if (unit === "tbsp") {
    return roundToStep(rawQty, 0.5, 0.5);
  }

  if (unit === "tsp") {
    return roundToStep(rawQty, 0.25, 0.125);
  }

  if (unit === "pinch") {
    return rawQty < 0.5 ? 1 : Math.round(rawQty);
  }

  if (unit === "ml") {
    return Math.max(5, Math.round(rawQty / 5) * 5);
  }

  if (rawQty >= 1) {
    return Math.max(1, Math.round(rawQty));
  }

  return roundToStep(rawQty, 0.25, 0.25);
}

export function isFlexibleIngredient(ing: RecipeIngredient): boolean {
  return FLEXIBLE_INGREDIENT.test(ing.name) || ing.category === "Spices";
}

export function isRigidProteinIngredient(ing: RecipeIngredient): boolean {
  const name = ing.name.toLowerCase();
  const unit = normalizeUnit(ing.unit);

  if (RIGID_PROTEIN.test(name)) return true;
  if (unit === "large" && /egg/.test(name)) return true;
  if (unit === "slice") return true;
  if (unit === "scoop") return /protein/i.test(name);
  if (unit === "oz" || unit === "g") {
    return /chicken|beef|turkey|bacon|ham|salmon|tuna|ground|sausage|fish|shrimp|breast|thigh/i.test(
      name,
    );
  }
  if (unit === "cup" && /greek yogurt|cottage cheese|egg white/i.test(name)) return true;
  return false;
}

function proteinSignalWeight(ing: RecipeIngredient): number {
  const unit = normalizeUnit(ing.unit);
  if (unit === "large") return 3;
  if (unit === "scoop") return 2;
  if (unit === "slice") return 1.5;
  if (unit === "oz") return 1;
  if (unit === "g") return 0.03;
  if (unit === "cup" && /yogurt|cottage|egg white/i.test(ing.name)) return 2;
  return 1;
}

/** Apply practical rounding across a scaled ingredient list; nudge flexible items if protein drifts. */
export function applyPracticalIngredientScaling(
  ingredients: RecipeIngredient[],
): RecipeIngredient[] {
  const entries = ingredients.map((ing) => ({
    ing,
    raw: ing.quantity,
    practical: roundIngredientQuantity(ing, ing.quantity),
  }));

  const rigid = entries.filter((e) => isRigidProteinIngredient(e.ing));
  const flexible = entries.filter((e) => isFlexibleIngredient(e.ing));

  const rawSignal = rigid.reduce((s, e) => s + e.raw * proteinSignalWeight(e.ing), 0);
  const practicalSignal = rigid.reduce(
    (s, e) => s + e.practical * proteinSignalWeight(e.ing),
    0,
  );

  let factor = 1;
  if (rawSignal > 0 && practicalSignal > 0 && flexible.length > 0) {
    const drift = Math.abs(practicalSignal - rawSignal) / rawSignal;
    if (drift > 0.07) {
      factor = Math.min(1.08, Math.max(0.92, rawSignal / practicalSignal));
    }
  }

  return entries.map((e) => {
    let qty = e.practical;
    if (isFlexibleIngredient(e.ing) && factor !== 1) {
      qty = roundIngredientQuantity(e.ing, e.practical * factor);
    }
    return { ...e.ing, quantity: qty };
  });
}

const FRACTION_CHARS: Record<number, string> = {
  0.25: "¼",
  0.33: "⅓",
  0.5: "½",
  0.67: "⅔",
  0.75: "¾",
};

/** Human-friendly quantity for display (whole numbers and simple fractions). */
export function formatPracticalQty(value: number): string {
  if (value <= 0) return "0";

  const whole = Math.floor(value + 1e-9);
  const frac = Math.round((value - whole) * 100) / 100;

  for (const [num, sym] of Object.entries(FRACTION_CHARS)) {
    if (Math.abs(frac - Number(num)) < 0.06) {
      if (whole === 0) return sym;
      return `${whole} ${sym}`;
    }
  }

  if (frac < 0.06) return String(whole);

  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
