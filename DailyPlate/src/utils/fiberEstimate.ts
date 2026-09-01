import type { RecipeIngredient } from "@/types";

function unit(ing: RecipeIngredient): string {
  return ing.unit.toLowerCase().replace(/\.$/, "");
}

function toCups(qty: number, u: string): number | null {
  if (u.includes("cup")) return qty;
  if (u.includes("tbsp") || u.includes("tablespoon")) return qty / 16;
  if (u.includes("tsp") || u.includes("teaspoon")) return qty / 48;
  if (u === "ml" || u === "milliliter" || u === "milliliters") return qty / 240;
  return null;
}

function toTbsp(qty: number, u: string): number | null {
  if (u.includes("tbsp") || u.includes("tablespoon")) return qty;
  if (u.includes("tsp") || u.includes("teaspoon")) return qty / 3;
  if (u.includes("cup")) return qty * 16;
  return null;
}

function toOz(qty: number, u: string): number | null {
  if (u === "oz" || u.includes("ounce")) return qty;
  if (u === "g" || u === "gram" || u === "grams") return qty / 28.35;
  if (u === "lb" || u.includes("pound")) return qty * 16;
  return null;
}

function isItemUnit(u: string): boolean {
  return (
    u === "large" ||
    u === "medium" ||
    u === "small" ||
    u === "clove" ||
    u === "cloves" ||
    u === "slice" ||
    u === "slices" ||
    u === "piece" ||
    u === "pieces" ||
    u === "whole" ||
    u === "each" ||
    u === "item" ||
    u === "count" ||
    u.includes("spear")
  );
}

const ANIMAL_OR_FAT =
  /\b(chicken|turkey|beef|steak|pork|lamb|salmon|tuna|shrimp|cod|tilapia|egg whites?|eggs?\b|bacon|ham|sausage|ghee|olive oil|avocado oil|canola oil|oil\b|butter\b|mayo|mayonnaise)\b/i;

function fiberForIngredient(ing: RecipeIngredient): number {
  if (ing.category === "Spices") return 0;
  const name = ing.name.toLowerCase();
  const u = unit(ing);
  const q = ing.quantity;
  if (!Number.isFinite(q) || q <= 0) return 0;

  const cups = toCups(q, u);
  const tbsp = toTbsp(q, u);
  const oz = toOz(q, u);
  const item = isItemUnit(u) ? q : null;
  const cup = (n: number) => (cups != null ? cups * n : 0);
  const spoon = (n: number) => (tbsp != null ? tbsp * n : 0);

  if (/chia/.test(name)) return spoon(5) || cup(80) || q * 5;
  if (/flax/.test(name)) return spoon(2.8) || cup(45) || q * 2.8;
  if (/psyllium/.test(name)) return spoon(5) || q * 5;
  if (/granola/.test(name)) return cup(7) || q * 3;

  if (/black bean|pinto|kidney|cannellini|navy bean|white bean/.test(name)) {
    return cup(12.5) || (oz != null ? oz * 0.8 : 0) || q * 6;
  }
  if (/chickpea|garbanzo|hummus/.test(name)) {
    return cup(12) || (oz != null ? oz * 0.7 : 0) || (item != null ? item * 2 : 0) || q * 4;
  }
  if (/lentil/.test(name)) return cup(15.6) || q * 8;
  if (/\bbeans?\b/.test(name) && !/green bean/.test(name)) return cup(12) || q * 6;
  if (/edamame/.test(name)) return cup(8) || q * 4;

  if (/rolled oats|oats|oatmeal/.test(name)) return cup(8) || q * 4;
  if (/quinoa/.test(name)) return cup(5) || q * 2.5;
  if (/brown rice|wild rice/.test(name)) return cup(3.5) || q * 2;
  if (/riced cauliflower|cauliflower rice/.test(name)) return cup(3) || q * 3;
  if (/riced broccoli|broccoli rice/.test(name)) return cup(4) || q * 4;
  if (/\brice\b/.test(name) && !/vinegar|paper|flour|cake/.test(name)) {
    return cup(0.6) || q * 0.6;
  }
  if (/protein pasta|chickpea pasta|lentil pasta/.test(name)) return cup(8) || q * 4;
  if (/pasta|noodle|spaghetti|penne/.test(name)) return cup(2.5) || q * 2;

  if (/whole wheat|whole-wheat|wheat bread|wheat toast/.test(name)) {
    return (item ?? q) * 2;
  }
  if (/bread|toast|bagel|english muffin|bun|roll/.test(name)) {
    return (item ?? q) * 1;
  }
  if (/corn tortilla/.test(name)) return (item ?? q) * 1.5;
  if (/tortilla|wrap/.test(name)) return (item ?? q) * 1.2;
  if (/pita/.test(name)) return (item ?? q) * 1.5;

  if (/sweet potato/.test(name)) {
    return cup(4) || (item != null ? item * 4 : 0) || q * 3;
  }
  if (/\bpotato/.test(name)) {
    return cup(2.5) || (item != null ? item * 2.5 : 0) || q * 2;
  }
  if (/\bcorn\b/.test(name) && !/tortilla/.test(name)) return cup(3.5) || q * 2;

  if (/green beans? or broccoli|broccoli or green beans?/.test(name)) {
    return cup(4) || q * 3;
  }
  if (/broccoli/.test(name)) {
    return cup(5) || (oz != null ? oz * 0.9 : 0) || (item != null ? item * 2.4 : 0) || q * 3;
  }
  if (/brussels/.test(name)) return cup(4) || q * 3;
  if (/cauliflower/.test(name)) return cup(3) || q * 2;
  if (/spinach|kale|mixed greens|lettuce|arugula/.test(name)) {
    return cup(0.7) || q * 0.7;
  }
  if (/carrot/.test(name)) return cup(3.6) || (item != null ? item * 2 : 0) || q * 2;
  if (/bell pepper|pepper \(/.test(name) || /red pepper|green pepper/.test(name)) {
    return (item != null ? item * 2.5 : 0) || cup(2.5) || q * 2;
  }
  if (/asparagus/.test(name)) {
    if (u.includes("spear")) return q * 0.3;
    return cup(3.6) || q * 2;
  }
  if (/tomato/.test(name)) {
    if (oz != null) return oz * 0.25;
    return (item != null ? item * 1.5 : 0) || cup(2) || q * 1;
  }
  if (/onion/.test(name)) return (item != null ? item * 1.5 : 0) || cup(1.9) || q * 1;
  if (/garlic/.test(name) && !/powder/.test(name)) {
    if (u.includes("clove")) return q * 0.1;
    return spoon(0.3) || q * 0.1;
  }
  if (/avocado/.test(name)) {
    if (item != null) return item * 6.7;
    return cup(10) || q * 3;
  }
  if (/zucchini|squash|cucumber|celery|mushroom/.test(name)) {
    return cup(1.5) || q * 1;
  }
  if (/green bean|cabbage|coleslaw/.test(name)) return cup(3) || q * 2;
  if (/\bpeas?\b/.test(name)) return cup(8.8) || q * 4;
  if (/salsa|pico/.test(name)) return cup(2) || spoon(0.2) || q * 0.5;
  if (/parsley|cilantro|basil|herb/.test(name)) return spoon(0.1) || q * 0.1;

  if (/berr/.test(name)) return cup(4) || q * 3;
  if (/apple/.test(name)) return (item != null ? item * 4.4 : 0) || cup(3) || q * 3;
  if (/banana/.test(name)) return (item != null ? item * 3.1 : 0) || cup(3) || q * 2;
  if (/\borange\b/.test(name) && !/juice/.test(name)) {
    return (item != null ? item * 3 : 0) || q * 2;
  }
  if (/mango|peach|pear|grape|fruit/.test(name)) {
    return cup(2.5) || (item != null ? item * 3 : 0) || q * 2;
  }

  if (/peanut butter|almond butter|nut butter/.test(name)) {
    return spoon(1.6) || cup(12) || q * 2;
  }
  if (/almond|peanut|walnut|cashew|pistachio|sesame/.test(name)) {
    return spoon(1) || cup(12) || (oz != null ? oz * 3.5 : 0) || q * 1;
  }

  if (ANIMAL_OR_FAT.test(name) && !/bean|lentil|chickpea|oat|rice|quinoa|avocado/.test(name)) {
    return 0;
  }
  if (/greek yogurt|yogurt|cottage cheese|skyr|cheddar|mozzarella|parmesan|feta|cheese|milk|cream/.test(name)) {
    return 0;
  }
  if (/salt|pepper|honey|maple|soy sauce|tamari|vinegar|broth|stock|protein powder|whey|casein|collagen/.test(name)) {
    return 0;
  }

  if (ing.category === "Produce") {
    if (cups != null) return cups * 2.5;
    if (item != null) return item * 1.5;
    if (oz != null) return oz * 0.5;
    return Math.min(q, 6) * 0.5;
  }
  if (ing.category === "Grains") {
    if (cups != null) return cups * 2;
    return q * 1;
  }

  return 0;
}

export function estimateFiberFromIngredients(ingredients: RecipeIngredient[]): number {
  const raw = ingredients.reduce((sum, ing) => sum + fiberForIngredient(ing), 0);
  if (raw <= 0) return 0;
  return Math.round(raw);
}
