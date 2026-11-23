import type { PortionLine } from "@/utils/goalPortions";
import { cookedPerMeasured, firstIngredientOption, normalizeUnit } from "@/utils/ingredientNutrition";
import { formatPracticalQty } from "@/utils/practicalScaling";

/** Amount to put inline in a step, e.g. "210 g", "3", "2 tbsp", "195 g cooked". */
export function inlineAmount(line: PortionLine): string | null {
  const ing = line.ingredient;
  const unit = normalizeUnit(ing.unit);
  if (line.grams == null) return null;
  if (unit === "pinch") return null;
  if (line.count != null) {
    if (/egg/i.test(ing.name) || unit === "large" || unit === "medium" || unit === "small" || unit === "each") {
      return formatPracticalQty(line.count);
    }
    return `${formatPracticalQty(line.count)} ${ing.unit}`;
  }
  if (unit === "tsp" || unit === "tbsp") return `${formatPracticalQty(ing.quantity)} ${ing.unit}`;
  if (line.stateLabel === "dry" && line.state === "cooked" && line.nutritionGrams != null) {
    // Steps handle the cooked food (e.g. "portion with rice"); the list shows the dry amount to weigh.
    return `${Math.round(line.nutritionGrams / 5) * 5} g cooked`;
  }
  return `${line.grams} g`;
}

const STOP = new Set(["and", "with", "or", "the", "optional", "fresh", "plain", "low", "fat", "lean", "large", "medium", "small"]);

function cleanName(name: string): string {
  return firstIngredientOption(name)
    .replace(/\([^)]*\)/g, " ")
    .toLowerCase()
    .replace(/[^a-z\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Phrases to look for in steps, longest first: full name, last two words, last word. */
function candidatePhrases(name: string): string[] {
  const words = cleanName(name).split(" ").filter((w) => w.length > 1 && !STOP.has(w));
  const out: string[] = [];
  if (words.length >= 1) out.push(words.join(" "));
  if (words.length >= 3) out.push(words.slice(-2).join(" "));
  if (words.length >= 2) out.push(words[words.length - 1]!);
  return [...new Set(out)].filter((p) => p.length >= 3);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Put each ingredient's batch amount before its first mention in the steps ("Brown 210 g turkey").
 * A phrase shared by two ingredients, or a mention that already has a number, is left alone.
 */
export function stepsWithAmounts(steps: string[], lines: PortionLine[]): string[] {
  const phraseOwners = new Map<string, number>();
  const perLine = lines.map((l) => candidatePhrases(l.ingredient.name));
  for (const phrases of perLine) {
    for (const p of phrases) phraseOwners.set(p, (phraseOwners.get(p) ?? 0) + 1);
  }
  const out = [...steps];
  lines.forEach((line, i) => {
    const amount = inlineAmount(line);
    if (!amount) return;
    for (const phrase of perLine[i]!) {
      if ((phraseOwners.get(phrase) ?? 0) > 1) continue;
      const re = new RegExp(`\\b${escapeRe(phrase)}\\b`, "i");
      const stepIndex = out.findIndex((s) => re.test(s));
      if (stepIndex < 0) continue;
      const step = out[stepIndex]!;
      const m = re.exec(step)!;
      const before = step.slice(Math.max(0, m.index - 10), m.index);
      if (/\d|½|¼|¾|⅓|⅔/.test(before)) return;
      out[stepIndex] = `${step.slice(0, m.index)}${amount} ${step.slice(m.index)}`;
      return;
    }
  });
  return out;
}

export type PrepTip = { id: string; title: string; detail: string };

/** Short prep notes where technique changes the nutrition. */
export function prepTips(lines: PortionLine[]): PrepTip[] {
  const tips: PrepTip[] = [];
  const names = lines.map((l) => l.ingredient.name.toLowerCase());
  const has = (re: RegExp) => names.some((n) => re.test(n));

  const fat = lines.find((l) => /olive oil|\boil\b|butter/i.test(l.ingredient.name) && !/peanut|almond/i.test(l.ingredient.name));
  if (fat) {
    const amount = inlineAmount(fat);
    tips.push({
      id: "measure-oil",
      title: "Measure the oil instead of free-pouring",
      detail: `Use a measuring spoon${amount ? ` (${amount})` : ""}. Oil is about 120 kcal per tablespoon, and a free pour is often two or three times that.`,
    });
  }
  if (has(/ground (turkey|beef|chicken|pork)|lean ground/)) {
    tips.push({
      id: "drain-meat",
      title: "Drain the fat from the ground meat",
      detail: "After browning, tilt the pan and spoon off the melted fat, or blot with a paper towel. The numbers assume lean meat; draining keeps you at or under them.",
    });
  }
  if (has(/thigh/) && has(/skin|bone-in/)) {
    tips.push({
      id: "remove-skin",
      title: "Remove the skin",
      detail: "Most of the fat in a chicken thigh is in the skin. Take it off before eating to stay close to the planned fat.",
    });
  }
  const rice = lines.find((l) => l.stateLabel === "dry" && /rice/i.test(l.ingredient.name));
  if (rice && rice.grams != null) {
    const cooked = Math.round((rice.grams * cookedPerMeasured(rice.ingredient.name)) / 5) * 5;
    tips.push({
      id: "weigh-rice",
      title: "Weigh the rice dry",
      detail: `Weigh ${rice.grams} g of dry rice before cooking. It cooks to about ${cooked} g; cooked weight varies with the water used, so the dry weight is the reliable measure.`,
    });
  }
  const pasta = lines.find((l) => l.state === "dry" && /pasta|spaghetti|penne|noodle/i.test(l.ingredient.name));
  if (pasta && pasta.grams != null) {
    tips.push({
      id: "weigh-pasta",
      title: "Weigh the pasta dry",
      detail: `Weigh ${pasta.grams} g of dry pasta before boiling. Cooked pasta weighs about 2½ times as much, depending on how long it cooks.`,
    });
  }
  if (has(/peanut butter|almond butter|cheese|cheddar|parmesan|feta/)) {
    tips.push({
      id: "level-measure",
      title: "Level off nut butter and cheese",
      detail: "Use a level spoon or cup. A heaping tablespoon of nut butter can be close to double the amount.",
    });
  }
  return tips;
}
