import type { Recipe, RecipeIngredient } from "@/types";
import { resolveRecipeIngredients } from "@/utils/recipeDisplay";

export type MicronutrientId =
  | "vitaminD"
  | "calcium"
  | "iron"
  | "potassium"
  | "vitaminC";

export type MicronutrientHit = {
  id: MicronutrientId;
  label: string;
  amountLabel: string;
};

type NutrientKey = MicronutrientId;
type PerUnit = Partial<Record<NutrientKey, number>>;

const LABELS: Record<NutrientKey, { label: string; unit: string }> = {
  vitaminD: { label: "Vitamin D", unit: "mcg" },
  calcium: { label: "Calcium", unit: "mg" },
  iron: { label: "Iron", unit: "mg" },
  potassium: { label: "Potassium", unit: "mg" },
  vitaminC: { label: "Vitamin C", unit: "mg" },
};

/** Conservative per-unit amounts from common USDA food-data values. Unknown foods are skipped. */
const BY_NAME: { match: RegExp; unit: "cup" | "fl oz" | "oz" | "g" | "large" | "medium"; per: PerUnit }[] = [
  { match: /fat-free milk|skim milk/, unit: "cup", per: { calcium: 316, vitaminD: 2.9, potassium: 382 } },
  { match: /\bmilk\b/, unit: "cup", per: { calcium: 293, vitaminD: 2.9, potassium: 342 } },
  { match: /greek yogurt|yogurt/, unit: "cup", per: { calcium: 200, potassium: 240 } },
  { match: /cottage cheese/, unit: "cup", per: { calcium: 174, potassium: 220 } },
  { match: /cheddar|american cheese|cheese/, unit: "oz", per: { calcium: 200 } },
  { match: /egg whites?|\beggs?\b/, unit: "large", per: { vitaminD: 1.1, iron: 0.9 } },
  { match: /salmon/, unit: "oz", per: { vitaminD: 3.2, potassium: 109, iron: 0.1 } },
  { match: /tuna/, unit: "oz", per: { vitaminD: 1.7, potassium: 70 } },
  { match: /chicken/, unit: "oz", per: { potassium: 70, iron: 0.2 } },
  { match: /turkey/, unit: "oz", per: { potassium: 70, iron: 0.3 } },
  { match: /beef|steak|sirloin/, unit: "oz", per: { iron: 0.7, potassium: 90 } },
  { match: /spinach/, unit: "cup", per: { iron: 0.8, vitaminC: 8, potassium: 167, calcium: 30 } },
  { match: /broccoli/, unit: "cup", per: { vitaminC: 81, potassium: 288, calcium: 43 } },
  { match: /bell pepper/, unit: "medium", per: { vitaminC: 95, potassium: 211 } },
  { match: /orange|berries|strawberr|blueberr/, unit: "cup", per: { vitaminC: 70, potassium: 180 } },
  { match: /tomato/, unit: "medium", per: { vitaminC: 17, potassium: 292 } },
  { match: /sweet potato/, unit: "medium", per: { vitaminC: 22, potassium: 542 } },
  { match: /potato(?!.*sweet)/, unit: "medium", per: { potassium: 620, vitaminC: 17 } },
  { match: /banana/, unit: "medium", per: { potassium: 422, vitaminC: 10 } },
  { match: /avocado/, unit: "medium", per: { potassium: 690, vitaminC: 10 } },
  { match: /beans?|lentil|chickpea/, unit: "cup", per: { iron: 3.6, potassium: 400, calcium: 60 } },
  { match: /spinach|kale/, unit: "cup", per: { vitaminC: 20, calcium: 50, iron: 0.8, potassium: 170 } },
];

const THRESHOLDS: Record<NutrientKey, number> = {
  vitaminD: 0.5,
  calcium: 40,
  iron: 0.4,
  potassium: 80,
  vitaminC: 5,
};

function toCups(qty: number, unit: string): number | null {
  const u = unit.toLowerCase();
  if (u.includes("cup")) return qty;
  if (u === "fl oz" || u === "floz") return qty / 8;
  if (u === "ml") return qty / 240;
  return null;
}

function toOz(qty: number, unit: string): number | null {
  const u = unit.toLowerCase();
  if (u === "oz" || u.includes("ounce")) return qty;
  if (u === "g" || u.includes("gram")) return qty / 28.35;
  if (u.includes("lb") || u.includes("pound")) return qty * 16;
  return null;
}

function multiplier(ing: RecipeIngredient, rowUnit: string): number | null {
  const u = ing.unit.toLowerCase();
  if (rowUnit === "cup") return toCups(ing.quantity, u);
  if (rowUnit === "fl oz") {
    if (u === "fl oz" || u === "floz") return ing.quantity;
    const cups = toCups(ing.quantity, u);
    return cups != null ? cups * 8 : null;
  }
  if (rowUnit === "oz") return toOz(ing.quantity, u);
  if (rowUnit === "g") {
    if (u === "g" || u.includes("gram")) return ing.quantity;
    const oz = toOz(ing.quantity, u);
    return oz != null ? oz * 28.35 : null;
  }
  if (rowUnit === "large" || rowUnit === "medium") {
    if (u === rowUnit || u === "each" || u === "item") return ing.quantity;
  }
  return null;
}

function formatAmount(id: NutrientKey, value: number): string {
  const { unit } = LABELS[id];
  if (id === "iron" || id === "vitaminD") {
    const n = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
    return `~${n} ${unit}`;
  }
  return `~${Math.round(value)} ${unit}`;
}

export function notableMicronutrients(
  recipe: Recipe,
  variationId?: string,
  scale = 1,
): MicronutrientHit[] {
  const ingredients = resolveRecipeIngredients(recipe, variationId).map((ing) => ({
    ...ing,
    quantity: ing.quantity * scale,
  }));
  const totals: Record<NutrientKey, number> = {
    vitaminD: 0,
    calcium: 0,
    iron: 0,
    potassium: 0,
    vitaminC: 0,
  };

  for (const ing of ingredients) {
    const name = ing.name.toLowerCase();
    const row = BY_NAME.find((r) => r.match.test(name));
    if (!row) continue;
    const mult = multiplier(ing, row.unit);
    if (mult == null || !(mult > 0)) continue;
    for (const key of Object.keys(row.per) as NutrientKey[]) {
      const per = row.per[key];
      if (per) totals[key] += per * mult;
    }
  }

  const hits: MicronutrientHit[] = [];
  for (const id of Object.keys(LABELS) as NutrientKey[]) {
    if (totals[id] < THRESHOLDS[id]) continue;
    hits.push({
      id,
      label: LABELS[id].label,
      amountLabel: formatAmount(id, totals[id]),
    });
  }
  return hits;
}
