import fs from "fs";
import path from "path";

const OZ = 28.3495;
const FLOZ = 29.5735;

/** @type {Array<{id:string,name:string,fdcId:number|null,query:string,per100g:{calories:number,protein:number,carbs:number,fat:number,fiber:number},grams:Record<string,number|null>,aliases:string[]}>} */
const foods = [];

function g(cup, tbsp, tsp, oz, each, extra = {}) {
  return { cup, tbsp, tsp, oz, each, g: 1, ...extra };
}

function add(entry) {
  foods.push(entry);
}

const zero = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

add({
  id: "turkey-ground-93-raw",
  name: "ground turkey 93% lean, raw",
  fdcId: 172850,
  query: "Turkey, ground, 93% lean, 7% fat, raw",
  per100g: { calories: 150, protein: 18.73, carbs: 0, fat: 8.34, fiber: 0 },
  grams: g(null, null, null, OZ, null),
  aliases: ["Lean ground turkey"],
});

add({
  id: "beef-ground-93-raw",
  name: "beef, ground, 93% lean, raw",
  fdcId: 173110,
  query: "Beef, ground, 93% lean meat / 7% fat, raw",
  per100g: { calories: 152, protein: 20.85, carbs: 0, fat: 7, fiber: 0 },
  grams: g(null, null, null, OZ, null),
  aliases: ["Lean ground beef (93%)", "Lean beef strips"],
});

add({
  id: "chicken-breast-raw",
  name: "chicken breast, boneless skinless, raw",
  fdcId: 171077,
  query: "Chicken, broiler or fryers, breast, skinless, boneless, meat only, raw",
  per100g: { calories: 120, protein: 22.5, carbs: 0, fat: 2.62, fiber: 0 },
  grams: g(null, null, null, OZ, null),
  aliases: ["Chicken breast", "Chicken breast (boneless)", "Chicken breast (cubed)"],
});

add({
  id: "chicken-ground-raw",
  name: "chicken, ground, raw",
  fdcId: null,
  query: "Chicken, ground, raw",
  per100g: { calories: 143, protein: 17.44, carbs: 0, fat: 8.1, fiber: 0 },
  grams: g(null, null, null, OZ, null),
  aliases: ["Ground chicken"],
});

add({
  id: "chicken-breast-roasted",
  name: "chicken breast, roasted",
  fdcId: 171534,
  query: "Chicken, broiler or fryers, breast, meat only, cooked, roasted",
  per100g: { calories: 165, protein: 31.02, carbs: 0, fat: 3.57, fiber: 0 },
  grams: g(null, null, null, OZ, null),
  aliases: ["Cooked chicken breast", "Chopped turkey", "Rotisserie chicken (shredded)", "Diced turkey breast or deli turkey", "Sliced turkey", "Sliced turkey breast"],
});

add({
  id: "chicken-thigh-raw-skin",
  name: "chicken thigh, bone-in skin-on, raw",
  fdcId: null,
  query: "Chicken, broilers or fryers, thigh, meat and skin, raw",
  per100g: { calories: 221, protein: 16.5, carbs: 0, fat: 16.6, fiber: 0 },
  grams: g(null, null, null, OZ, 116, { medium: 116 }),
  edible: {
    fraction: 0.79,
    source:
      "Approximate share of bone-in thigh weight that is meat and skin (bone ~21%, typical of USDA SR Legacy refuse for this cut). Verify.",
  },
  aliases: ["Chicken thighs (bone-in, skin-on)"],
});

add({
  id: "sirloin-raw",
  name: "beef top sirloin, raw",
  fdcId: null,
  query: "Beef, top sirloin, separable lean only, trimmed to 1/8 inch fat, raw",
  per100g: { calories: 157, protein: 21.8, carbs: 0, fat: 7.4, fiber: 0 },
  grams: g(null, null, null, OZ, null),
  aliases: ["Sirloin steak"],
});

add({
  id: "salmon-raw",
  name: "salmon, Atlantic, raw",
  fdcId: 175167,
  query: "Fish, salmon, Atlantic, farmed, raw",
  per100g: { calories: 208, protein: 20.42, carbs: 0, fat: 13.42, fiber: 0 },
  grams: g(null, null, null, OZ, null),
  aliases: ["Salmon fillet", "Cooked salmon or tuna"],
});

add({
  id: "tuna-canned-water",
  name: "tuna, light, canned in water, drained",
  fdcId: null,
  query: "Fish, tuna, light, canned in water, drained solids",
  per100g: { calories: 116, protein: 25.51, carbs: 0, fat: 0.82, fiber: 0 },
  grams: g(null, null, null, OZ, 142, { can: 142 }),
  aliases: ["Canned tuna in water"],
});

add({
  id: "egg-whole-raw",
  name: "egg, whole, raw",
  fdcId: 171287,
  query: "Egg, whole, raw, fresh",
  per100g: { calories: 143, protein: 12.56, carbs: 0.72, fat: 9.51, fiber: 0 },
  grams: g(243, 15, 5, OZ, 50, { large: 50 }),
  aliases: ["Eggs"],
});

add({
  id: "egg-white-raw",
  name: "egg white, raw",
  fdcId: null,
  query: "Egg, white, raw, fresh",
  per100g: { calories: 52, protein: 10.9, carbs: 0.73, fat: 0.17, fiber: 0 },
  grams: g(243, 15, 5, OZ, 33),
  aliases: ["Liquid egg whites", "Extra liquid egg whites"],
});

add({
  id: "bacon-cooked",
  name: "pork bacon, cooked",
  fdcId: null,
  query: "Pork, cured, bacon, cooked, broiled, pan-fried or roasted",
  per100g: { calories: 541, protein: 37.04, carbs: 1.43, fat: 41.78, fiber: 0 },
  grams: g(null, null, null, OZ, 8, { slice: 8, slices: 8 }),
  aliases: ["Center-cut bacon", "Cooked bacon (crumbled)", "Cooked bacon, chopped"],
});

add({
  id: "turkey-bacon",
  name: "turkey bacon, cooked",
  fdcId: null,
  query: "Turkey bacon, cooked",
  per100g: { calories: 218, protein: 16.5, carbs: 1.5, fat: 16.8, fiber: 0 },
  grams: g(null, null, null, OZ, 15, { slice: 15, slices: 15 }),
  aliases: ["Turkey bacon"],
});

add({
  id: "ham-deli",
  name: "ham, sliced, extra lean",
  fdcId: 173863,
  query: "Ham, sliced, extra lean",
  per100g: { calories: 118, protein: 18.5, carbs: 1.5, fat: 3.8, fiber: 0 },
  grams: g(140, null, null, OZ, 28, { slice: 28, slices: 28 }),
  aliases: ["Deli ham (lean)", "Diced ham"],
});

add({
  id: "turkey-patty-cooked",
  name: "ground turkey 93% lean, cooked",
  fdcId: 174492,
  query: "Turkey, ground, 93% lean, 7% fat, patties, broiled",
  per100g: { calories: 196, protein: 27.4, carbs: 0, fat: 9.4, fiber: 0 },
  grams: g(null, null, null, OZ, 112, { large: 112 }),
  aliases: ["Turkey burger patty"],
});

add({
  id: "chicken-sausage",
  name: "chicken sausage, cooked",
  fdcId: 173880,
  query: "Chicken sausage, cooked",
  per100g: { calories: 179, protein: 16.5, carbs: 2, fat: 11.5, fiber: 0 },
  grams: g(null, null, null, OZ, null),
  aliases: ["Chicken sausage, diced"],
});

add({
  id: "beef-jerky",
  name: "beef jerky",
  fdcId: null,
  query: "Snacks, beef jerky, chopped and formed",
  per100g: { calories: 410, protein: 33.2, carbs: 11, fat: 25.6, fiber: 1.2 },
  grams: g(null, null, null, OZ, null),
  aliases: ["Beef jerky"],
});

add({
  id: "meat-stick",
  name: "beef stick, smoked",
  fdcId: null,
  query: "Snacks, beef sticks, smoked",
  per100g: { calories: 413, protein: 21.4, carbs: 6.5, fat: 33.2, fiber: 0 },
  grams: g(null, null, null, OZ, 28, { stick: 28 }),
  aliases: ["Beef or turkey meat stick"],
});

add({
  id: "rice-white-cooked",
  name: "white rice, long-grain, cooked",
  fdcId: 168878,
  query: "Rice, white, long-grain, regular, enriched, cooked",
  per100g: { calories: 130, protein: 2.69, carbs: 28.17, fat: 0.28, fiber: 0.4 },
  grams: g(158, 9.9, 3.3, OZ, null),
  aliases: ["Cooked rice", "Cooked white rice", "Cooked rice or quinoa", "Microwave rice (cooked)"],
});

add({
  id: "oats-dry",
  name: "oats, rolled, dry",
  fdcId: null,
  query: "Cereals, oats, regular and quick, not fortified, dry",
  per100g: { calories: 379, protein: 13.15, carbs: 67.7, fat: 6.52, fiber: 10.1 },
  grams: g(81, 5, 1.7, OZ, null),
  aliases: ["Rolled oats"],
});

add({
  id: "pasta-dry",
  name: "pasta, enriched, dry",
  fdcId: null,
  query: "Pasta, dry, enriched",
  per100g: { calories: 371, protein: 13.04, carbs: 74.67, fat: 1.51, fiber: 3.2 },
  grams: g(91, null, null, OZ, null),
  aliases: ["Orzo (dry)"],
});

add({
  id: "protein-pasta-dry",
  name: "chickpea pasta, dry",
  fdcId: null,
  skipUsda: "No chickpea pasta in USDA Foundation/SR Legacy; typed package-label values.",
  query: "Pasta, gluten-free, chickpea, dry",
  per100g: { calories: 352, protein: 21, carbs: 59, fat: 6, fiber: 11 },
  grams: g(91, null, null, OZ, null),
  aliases: ["Protein pasta (dry)"],
});

add({
  id: "bread-wheat",
  name: "bread, whole-wheat",
  fdcId: null,
  query: "Bread, whole-wheat, commercially prepared",
  per100g: { calories: 252, protein: 12.3, carbs: 42.7, fat: 3.5, fiber: 6 },
  grams: g(null, null, null, OZ, 28, { slice: 28, slices: 28 }),
  aliases: ["Bread (for toast)", "Sliced bread (toasted)"],
});

add({
  id: "bagel",
  name: "bagel, plain",
  fdcId: null,
  query: "Bagels, plain, enriched",
  per100g: { calories: 257, protein: 10, carbs: 50.5, fat: 1.6, fiber: 2.3 },
  grams: g(null, null, null, OZ, 105, { medium: 105 }),
  aliases: ["Plain bagel (halved, toasted)"],
});

add({
  id: "croissant",
  name: "croissant, butter",
  fdcId: null,
  query: "Croissants, butter",
  per100g: { calories: 406, protein: 8.2, carbs: 45.8, fat: 21, fiber: 2.6 },
  grams: g(null, null, null, OZ, 67, { medium: 67 }),
  aliases: ["Croissant"],
});

add({
  id: "biscuit",
  name: "biscuit, plain",
  fdcId: null,
  query: "Biscuits, plain or buttermilk, commercially prepared",
  per100g: { calories: 353, protein: 7, carbs: 45, fat: 16, fiber: 1.5 },
  grams: g(null, null, null, OZ, 70, { large: 70 }),
  aliases: ["Breakfast biscuit"],
});

add({
  id: "tortilla-flour",
  name: "tortilla, flour, 10-inch",
  fdcId: 175037,
  query: "Tortillas, ready-to-bake or -fry, flour",
  per100g: { calories: 312, protein: 8.2, carbs: 51.6, fat: 8, fiber: 3.1 },
  grams: g(null, null, null, OZ, 72, { large: 72 }),
  aliases: ["10-inch flour tortilla"],
});

add({
  id: "tortilla-wheat",
  name: "tortilla, whole wheat",
  fdcId: 174081,
  query: "Tortillas, ready-to-bake or -fry, whole wheat",
  per100g: { calories: 310, protein: 9.8, carbs: 50, fat: 7.5, fiber: 6.4 },
  grams: g(null, null, null, OZ, 70, { large: 70 }),
  aliases: ["Whole wheat or spinach tortilla"],
});

add({
  id: "tortilla-corn",
  name: "tortilla, corn, 6-inch",
  fdcId: 175036,
  query: "Tortillas, ready-to-bake or -fry, corn",
  per100g: { calories: 218, protein: 5.7, carbs: 44.6, fat: 2.85, fiber: 6.3 },
  grams: g(null, null, null, OZ, 24, { small: 24 }),
  aliases: ["6-inch corn tortillas"],
});

add({
  id: "teriyaki",
  name: "teriyaki sauce, ready-to-serve",
  fdcId: 171167,
  query: "Sauce, teriyaki, ready-to-serve",
  per100g: { calories: 89, protein: 5.93, carbs: 15.56, fat: 0.02, fiber: 0.1 },
  grams: g(288, 18, 6, null, null, { "fl oz": 36 }),
  aliases: ["Teriyaki sauce"],
});

add({
  id: "soy-sauce",
  name: "soy sauce",
  fdcId: null,
  query: "Soy sauce made from soy and wheat (shoyu)",
  per100g: { calories: 53, protein: 8.14, carbs: 4.93, fat: 0.57, fiber: 0.8 },
  grams: g(255, 16, 5.3, null, null),
  aliases: ["Soy sauce", "Soy sauce (low-sodium)", "Soy sauce or teriyaki"],
});

add({
  id: "broccoli-cooked",
  name: "broccoli, cooked, boiled, drained",
  fdcId: 169967,
  query: "Broccoli, cooked, boiled, drained, without salt",
  per100g: { calories: 35, protein: 2.38, carbs: 7.18, fat: 0.41, fiber: 3.3 },
  grams: g(156, 9.8, 3.3, OZ, null, { cups: 156 }),
  aliases: [
    "Broccoli",
    "Broccoli florets",
    "Steamed broccoli",
    "Steamed broccoli florets, chopped",
    "Broccoli, cooked",
  ],
});

add({
  id: "green-beans-cooked",
  name: "green beans, cooked, boiled, drained",
  fdcId: 169141,
  query: "Beans, snap, green, cooked, boiled, drained, without salt",
  per100g: { calories: 35, protein: 1.89, carbs: 7.88, fat: 0.28, fiber: 3.2 },
  grams: g(125, 7.8, 2.6, OZ, null, { cups: 125 }),
  aliases: ["Green beans or broccoli", "Green vegetable mix"],
});

add({
  id: "sesame",
  name: "sesame seeds, whole, dried",
  fdcId: 170150,
  query: "Seeds, sesame seeds, whole, dried",
  per100g: { calories: 573, protein: 17.73, carbs: 23.45, fat: 49.67, fiber: 11.8 },
  grams: g(144, 9, 3, OZ, null),
  aliases: ["Sesame seeds", "Sesame seeds (optional)"],
});

add({
  id: "olive-oil",
  name: "olive oil",
  fdcId: null,
  query: "Oil, olive, salad or cooking",
  per100g: { calories: 884, protein: 0, carbs: 0, fat: 100, fiber: 0 },
  grams: g(216, 13.5, 4.5, OZ, null),
  aliases: ["Olive oil", "Olive oil (for vegetables)", "Olive oil or butter", "Avocado oil"],
});

add({
  id: "butter",
  name: "butter, salted",
  fdcId: null,
  query: "Butter, salted",
  per100g: { calories: 717, protein: 0.85, carbs: 0.06, fat: 81.11, fiber: 0 },
  grams: g(227, 14.2, 4.7, OZ, null),
  aliases: ["Butter", "Butter or oil"],
});

add({
  id: "chia",
  name: "chia seeds, dried",
  fdcId: null,
  query: "Seeds, chia seeds, dried",
  per100g: { calories: 486, protein: 16.54, carbs: 42.12, fat: 30.74, fiber: 34.4 },
  grams: g(192, 12, 4, OZ, null),
  aliases: ["Chia seeds"],
});

add({
  id: "whey",
  name: "whey protein powder",
  fdcId: null,
  skipUsda: "USDA SR Legacy whey isolate (FDC 173177) lists 58 g protein and 29 g carbs per 100 g, unlike typical isolate; typed label values kept.",
  query: "Beverages, Whey protein powder isolate",
  per100g: { calories: 381, protein: 74.2, carbs: 9, fat: 3.2, fiber: 0 },
  grams: g(null, null, null, OZ, 31, { scoop: 31 }),
  aliases: [
    "Whey protein powder",
    "Vanilla protein powder",
    "Chocolate protein powder",
    "Chocolate protein powder (or vanilla)",
    "Strawberry protein powder (or vanilla)",
  ],
});

add({
  id: "greek-nonfat",
  name: "yogurt, Greek, plain, nonfat",
  fdcId: null,
  query: "Yogurt, Greek, plain, nonfat",
  per100g: { calories: 59, protein: 10.19, carbs: 3.6, fat: 0.39, fiber: 0 },
  grams: g(245, 15, 5, OZ, null),
  aliases: [
    "Plain Greek yogurt",
    "Plain Greek yogurt (0% or low sugar)",
    "Nonfat Greek yogurt",
    "Greek yogurt (optional)",
  ],
});

add({
  id: "greek-cup",
  name: "yogurt, Greek, plain, nonfat, 5.3 oz cup",
  fdcId: null,
  query: "Yogurt, Greek, plain, nonfat",
  per100g: { calories: 59, protein: 10.19, carbs: 3.6, fat: 0.39, fiber: 0 },
  grams: g(150, 15, 5, OZ, 150),
  aliases: ["Plain Greek yogurt cup (5.3 oz)"],
});

add({
  id: "cottage-lowfat",
  name: "cottage cheese, lowfat, 2%",
  fdcId: null,
  query: "Cheese, cottage, lowfat, 2% milkfat",
  per100g: { calories: 81, protein: 10.45, carbs: 4.76, fat: 2.27, fiber: 0 },
  grams: g(226, 14, 4.7, OZ, null),
  aliases: [
    "Cottage cheese",
    "Cottage cheese (low-fat)",
    "Low-fat cottage cheese",
  ],
});

add({
  id: "cottage-cup",
  name: "cottage cheese, lowfat, 2%, 4 oz cup",
  fdcId: null,
  query: "Cheese, cottage, lowfat, 2% milkfat",
  per100g: { calories: 81, protein: 10.45, carbs: 4.76, fat: 2.27, fiber: 0 },
  grams: g(113, 14, 4.7, OZ, 113),
  aliases: ["Cottage cheese cup (4 oz)"],
});

add({
  id: "almond-milk",
  name: "almond milk, unsweetened",
  fdcId: null,
  query: "Beverages, almond milk, unsweetened, shelf stable",
  per100g: { calories: 15, protein: 0.59, carbs: 0.58, fat: 1.1, fiber: 0.4 },
  grams: g(240, 15, 5, null, null, { "fl oz": FLOZ }),
  aliases: ["Unsweetened almond milk", "Unsweetened almond milk (or milk of choice)"],
});

add({
  id: "milk-2",
  name: "milk, 2%",
  fdcId: null,
  query: "Milk, reduced fat, fluid, 2% milkfat",
  per100g: { calories: 50, protein: 3.3, carbs: 4.8, fat: 1.98, fiber: 0 },
  grams: g(244, 15, 5, null, null, { "fl oz": FLOZ }),
  aliases: ["Milk (2%)"],
});

add({
  id: "milk-fat-free",
  name: "milk, fat-free",
  fdcId: null,
  query: "Milk, nonfat, fluid",
  per100g: { calories: 34, protein: 3.37, carbs: 4.96, fat: 0.08, fiber: 0 },
  grams: g(245, 15, 5, null, null, { "fl oz": FLOZ }),
  aliases: ["Fat-free milk"],
});

add({
  id: "water",
  name: "water",
  fdcId: null,
  query: "Water, tap",
  per100g: zero,
  grams: g(240, 15, 5, null, null, { "fl oz": FLOZ }),
  aliases: ["Water", "Ice"],
});

add({
  id: "salt",
  name: "salt, table",
  fdcId: null,
  query: "Salt, table",
  per100g: zero,
  grams: g(273, 18, 6, OZ, null, { pinch: 0.4 }),
  aliases: ["Salt", "Pinch of salt"],
});

const SPICE_PLACEHOLDER = { calories: 250, protein: 8, carbs: 50, fat: 6, fiber: 20 };

function spice(id, name, query, aliases, tsp = 2.3, per100g = SPICE_PLACEHOLDER) {
  add({
    id,
    name,
    fdcId: null,
    query,
    per100g,
    grams: g(null, tsp * 3, tsp, OZ, null),
    aliases,
  });
}

spice("chili-powder", "chili powder", "Spices, chili powder", ["Chili powder", "Mild chili seasoning"], 2.7);
spice("cinnamon", "cinnamon, ground", "Spices, cinnamon, ground", ["Cinnamon"], 2.6);
spice("cumin", "cumin, ground", "Spices, cumin seed", ["Cumin"], 2.1);
spice("garlic-powder", "garlic powder", "Spices, garlic powder", ["Garlic powder"], 3.1, {
  calories: 331, protein: 16.55, carbs: 72.73, fat: 0.73, fiber: 9,
});
spice("italian-herbs", "italian seasoning, dried", "Spices, poultry seasoning", ["Dried Italian herbs", "Dried oregano", "Italian herbs"], 1);
spice("paprika", "paprika, smoked", "Spices, paprika", ["Smoked paprika"], 2.3, {
  calories: 282, protein: 14.14, carbs: 53.99, fat: 12.89, fiber: 34.9,
});
spice("ranch", "ranch seasoning mix", "Spices, onion powder", ["Ranch seasoning mix"], 2);
spice("ginger", "ginger, fresh", "Ginger root, raw", ["Ginger (fresh)"], 2);

add({
  id: "almond-butter",
  name: "almond butter",
  fdcId: null,
  query: "Nuts, almond butter, plain, without salt added",
  per100g: { calories: 614, protein: 20.96, carbs: 18.82, fat: 55.5, fiber: 10.3 },
  grams: g(250, 16, 5.3, OZ, null),
  aliases: ["Almond butter"],
});
add({
  id: "peanut-butter",
  name: "peanut butter, smooth",
  fdcId: null,
  query: "Peanut butter, smooth style, without salt",
  per100g: { calories: 588, protein: 25.09, carbs: 19.56, fat: 50.39, fiber: 6 },
  grams: g(258, 16, 5.3, OZ, null),
  aliases: ["Peanut butter"],
});
add({
  id: "almonds",
  name: "almonds, dry roasted",
  fdcId: null,
  query: "Nuts, almonds",
  per100g: { calories: 579, protein: 21.15, carbs: 21.55, fat: 49.93, fiber: 12.5 },
  grams: g(143, 9, 3, OZ, null),
  aliases: ["Almonds"],
});
add({
  id: "peanuts",
  name: "peanuts, dry roasted",
  fdcId: null,
  query: "Peanuts, all types, dry-roasted, without salt",
  per100g: { calories: 587, protein: 24.35, carbs: 21.51, fat: 49.66, fiber: 8.4 },
  grams: g(146, 9, 3, OZ, null),
  aliases: ["Peanuts"],
});
add({
  id: "cashews",
  name: "cashews, dry roasted",
  fdcId: null,
  query: "Nuts, cashew nuts, dry roasted, without salt added",
  per100g: { calories: 574, protein: 15.31, carbs: 32.69, fat: 46.35, fiber: 3 },
  grams: g(137, 8.6, 2.9, OZ, null),
  aliases: ["Cashews"],
});
add({
  id: "pecans",
  name: "pecans",
  fdcId: null,
  query: "Nuts, pecans",
  per100g: { calories: 691, protein: 9.17, carbs: 13.86, fat: 71.97, fiber: 9.6 },
  grams: g(109, 7, 2.3, OZ, null),
  aliases: ["Chopped pecans"],
});
add({
  id: "walnuts",
  name: "walnuts",
  fdcId: null,
  query: "Nuts, walnuts, english",
  per100g: { calories: 654, protein: 15.23, carbs: 13.71, fat: 65.21, fiber: 6.7 },
  grams: g(117, 7.5, 2.5, OZ, null),
  aliases: ["Chopped walnuts or hazelnuts", "Mixed nuts"],
});
add({
  id: "apple-raw",
  name: "apple, raw, with skin",
  fdcId: null,
  query: "Apples, raw, with skin",
  per100g: { calories: 52, protein: 0.26, carbs: 13.81, fat: 0.17, fiber: 2.4 },
  grams: g(125, null, null, OZ, 182, { medium: 182 }),
  aliases: ["Apple", "Diced apple"],
});
add({
  id: "banana-raw",
  name: "banana, raw",
  fdcId: null,
  query: "Bananas, raw",
  per100g: { calories: 89, protein: 1.09, carbs: 22.84, fat: 0.33, fiber: 2.6 },
  grams: g(150, null, null, OZ, 118, { medium: 118 }),
  aliases: ["Banana", "Frozen banana", "Sliced banana"],
});
add({
  id: "asparagus-raw",
  name: "asparagus, raw",
  fdcId: null,
  query: "Asparagus, raw",
  per100g: { calories: 20, protein: 2.2, carbs: 3.88, fat: 0.12, fiber: 2.1 },
  grams: g(134, null, null, OZ, 16, { spear: 16, spears: 16 }),
  aliases: ["Asparagus"],
});
add({
  id: "avocado-raw",
  name: "avocado, raw",
  fdcId: null,
  query: "Avocados, raw, all commercial varieties",
  per100g: { calories: 160, protein: 2, carbs: 8.53, fat: 14.66, fiber: 6.7 },
  grams: g(150, null, null, OZ, 150, { medium: 150 }),
  aliases: ["Avocado (sliced)"],
});
add({
  id: "potato-raw",
  name: "potato, raw, flesh and skin",
  fdcId: null,
  query: "Potatoes, flesh and skin, raw",
  per100g: { calories: 77, protein: 2.05, carbs: 17.49, fat: 0.09, fiber: 2.1 },
  grams: g(150, null, null, OZ, 213, { medium: 213 }),
  aliases: ["Baby red potatoes (halved)", "Potato (cubed)"],
});
add({
  id: "hash-brown",
  // Recipes cook these in their own measured oil, so use plain potato with no added fat.
  name: "hash brown potatoes, shredded, no added fat",
  fdcId: null,
  query: "Potatoes, flesh and skin, raw",
  per100g: { calories: 77, protein: 2.05, carbs: 17.49, fat: 0.09, fiber: 2.1 },
  grams: g(156, null, null, OZ, null),
  aliases: ["Shredded hash browns (cooked)"],
});
add({
  id: "sweet-potato-raw",
  name: "sweet potato, raw",
  fdcId: 168482,
  query: "Sweet potato, raw, unprepared",
  per100g: { calories: 86, protein: 1.57, carbs: 20.12, fat: 0.05, fiber: 3 },
  grams: g(133, null, null, OZ, 130, { medium: 130, cups: 133 }),
  aliases: ["Sweet potato", "Sweet potato (diced)"],
});
add({
  id: "spinach-raw",
  name: "spinach, raw",
  fdcId: null,
  query: "Spinach, raw",
  per100g: { calories: 23, protein: 2.86, carbs: 3.63, fat: 0.39, fiber: 2.2 },
  grams: g(30, null, null, OZ, null),
  aliases: ["Baby spinach", "Baby spinach, chopped", "Mixed greens or spinach"],
});
add({
  id: "lettuce-raw",
  name: "romaine lettuce, raw",
  fdcId: null,
  query: "Lettuce, cos or romaine, raw",
  per100g: { calories: 17, protein: 1.24, carbs: 3.29, fat: 0.3, fiber: 2.1 },
  grams: g(47, null, null, OZ, null, { cups: 47 }),
  aliases: ["Romaine lettuce", "Romaine or mixed greens", "Shredded lettuce"],
});
add({
  id: "pepper-raw",
  name: "bell pepper, raw",
  fdcId: null,
  query: "Peppers, sweet, red, raw",
  per100g: { calories: 31, protein: 0.99, carbs: 6.03, fat: 0.3, fiber: 2.1 },
  grams: g(149, null, null, OZ, 119, { medium: 119 }),
  aliases: [
    "Bell pepper",
    "Bell pepper (chunked)",
    "Bell pepper (chunks)",
    "Bell pepper strips",
    "Bell peppers (optional)",
    "Diced bell pepper",
    "Roasted red peppers, diced",
  ],
});
add({
  id: "berries",
  name: "blueberries, raw",
  fdcId: null,
  query: "Blueberries, raw",
  per100g: { calories: 57, protein: 0.74, carbs: 14.49, fat: 0.33, fiber: 2.4 },
  grams: g(148, null, null, OZ, null),
  aliases: [
    "Berries",
    "Fresh blueberries",
    "Frozen blueberries",
    "Mixed berries",
    "Raspberries (for topping)",
    "Fresh fruit (berries or sliced fruit)",
    "Frozen cherries or mixed berries",
  ],
});
add({
  id: "strawberries",
  name: "strawberries, raw",
  fdcId: null,
  query: "Strawberries, raw",
  per100g: { calories: 32, protein: 0.67, carbs: 7.68, fat: 0.3, fiber: 2 },
  grams: g(152, null, null, OZ, null),
  aliases: ["Diced strawberries", "Frozen strawberries"],
});
add({
  id: "black-beans",
  name: "black beans, canned, drained",
  fdcId: null,
  query: "Beans, black, mature seeds, canned, drained",
  per100g: { calories: 91, protein: 6.03, carbs: 16.6, fat: 0.29, fiber: 6.9 },
  grams: g(172, null, null, OZ, null),
  aliases: ["Black beans", "Black beans (canned, drained)"],
});
add({
  id: "chickpeas",
  name: "chickpeas, canned, drained",
  fdcId: 173800,
  query: "Chickpeas, canned, drained solids",
  per100g: { calories: 139, protein: 7.05, carbs: 22.53, fat: 2.77, fiber: 6.4 },
  grams: g(152, null, null, OZ, null),
  aliases: ["Canned chickpeas (drained)"],
});
add({
  id: "edamame",
  name: "edamame, cooked",
  fdcId: null,
  query: "Edamame, frozen, prepared",
  per100g: { calories: 121, protein: 11.91, carbs: 8.91, fat: 5.2, fiber: 5.2 },
  grams: g(155, null, null, OZ, null),
  aliases: ["Shelled edamame"],
});
add({
  id: "sugar",
  name: "brown sugar",
  fdcId: null,
  query: "Sugars, brown",
  per100g: { calories: 380, protein: 0.12, carbs: 98.09, fat: 0, fiber: 0 },
  grams: g(220, 14, 4.6, OZ, null),
  aliases: ["Brown sugar or coconut sugar", "Sweetener (to taste)"],
});
add({
  id: "brussels",
  name: "brussels sprouts, raw",
  fdcId: null,
  query: "Brussels sprouts, raw",
  per100g: { calories: 43, protein: 3.38, carbs: 8.95, fat: 0.3, fiber: 3.8 },
  grams: g(88, null, null, OZ, null, { cups: 88 }),
  aliases: ["Brussels sprouts (halved)"],
});
add({
  id: "carrot-raw",
  name: "carrot, raw",
  fdcId: null,
  query: "Carrots, raw",
  per100g: { calories: 41, protein: 0.93, carbs: 9.58, fat: 0.24, fiber: 2.8 },
  grams: g(128, null, null, OZ, 61),
  aliases: [
    "Carrot (thick slices)",
    "Carrot coins",
    "Carrot sticks",
    "Carrots (diced)",
    "Carrots (thick batons)",
    "Shredded carrots",
  ],
});
add({
  id: "celery-raw",
  name: "celery, raw",
  fdcId: null,
  query: "Celery, raw",
  per100g: { calories: 14, protein: 0.69, carbs: 2.97, fat: 0.17, fiber: 1.6 },
  grams: g(101, null, null, OZ, 40, { medium: 40 }),
  aliases: ["Celery (diced)", "Celery stalks"],
});
add({
  id: "tomato-raw",
  name: "tomato, raw",
  fdcId: null,
  query: "Tomatoes, red, ripe, raw",
  per100g: { calories: 18, protein: 0.88, carbs: 3.89, fat: 0.2, fiber: 1.2 },
  grams: g(149, null, null, OZ, 123, { medium: 123, slice: 20, slices: 20 }),
  aliases: [
    "Cherry tomatoes",
    "Cherry tomatoes (halved)",
    "Diced tomato",
    "Fresh tomato slices (optional)",
    "Tomato (sliced)",
  ],
});

add({
  id: "tomato-sundried",
  name: "tomatoes, sun-dried, packed in oil",
  fdcId: null,
  query: "Tomatoes, sun-dried, packed in oil, drained",
  per100g: { calories: 213, protein: 5.06, carbs: 23.33, fat: 14.08, fiber: 5.8 },
  grams: g(null, 7, 2.3, OZ, null),
  aliases: ["Sun-dried tomatoes, chopped"],
});
add({
  id: "tomato-canned",
  name: "tomatoes, canned, diced",
  fdcId: null,
  query: "Tomatoes, red, ripe, canned, stewed",
  per100g: { calories: 26, protein: 0.96, carbs: 5.4, fat: 0.2, fiber: 1 },
  grams: g(245, null, null, OZ, null, { cups: 245 }),
  aliases: ["Diced tomatoes (canned)"],
});
add({
  id: "cucumber-raw",
  name: "cucumber, raw, with peel",
  fdcId: null,
  query: "Cucumber, with peel, raw",
  per100g: { calories: 15, protein: 0.65, carbs: 3.63, fat: 0.11, fiber: 0.5 },
  grams: g(104, null, null, OZ, 201, { medium: 201 }),
  aliases: ["Cucumber", "Cucumber (chunked)", "Cucumber (sliced)"],
});
add({
  id: "onion-raw",
  name: "onion, raw",
  fdcId: null,
  query: "Onions, raw",
  per100g: { calories: 40, protein: 1.1, carbs: 9.34, fat: 0.1, fiber: 1.7 },
  grams: g(160, 10, 3.3, OZ, 110, { medium: 110, cups: 160 }),
  aliases: [
    "Onion",
    "Diced onion",
    "Red onion",
    "Red onion (optional)",
    "Red onion (thick wedges)",
    "Red onion (thin slices)",
    "Red onion (wedges)",
    "Yellow onion (thinly sliced)",
    "Yellow onion (wedges)",
  ],
});
add({
  id: "garlic-raw",
  name: "garlic, raw",
  fdcId: null,
  query: "Garlic, raw",
  per100g: { calories: 149, protein: 6.36, carbs: 33.06, fat: 0.5, fiber: 2.1 },
  grams: g(136, 8.5, 2.8, OZ, 3, { clove: 3, cloves: 3 }),
  aliases: ["Garlic"],
});
add({
  id: "corn",
  name: "corn, sweet, cooked",
  fdcId: null,
  query: "Corn, sweet, yellow, cooked, boiled, drained, without salt",
  per100g: { calories: 96, protein: 3.41, carbs: 20.98, fat: 1.5, fiber: 2.4 },
  grams: g(145, null, null, OZ, null),
  aliases: ["Corn kernels"],
});
add({
  id: "frozen-veg",
  name: "mixed vegetables, frozen, cooked",
  fdcId: null,
  query: "Vegetables, mixed, frozen, cooked, boiled, drained, without salt",
  per100g: { calories: 65, protein: 2.9, carbs: 13, fat: 0.2, fiber: 4 },
  grams: g(160, null, null, OZ, null, { cups: 160 }),
  aliases: ["Frozen mixed vegetables", "Roasted vegetables"],
});
add({
  id: "zucchini-raw",
  name: "zucchini, raw",
  fdcId: null,
  query: "Squash, summer, zucchini, includes skin, raw",
  per100g: { calories: 17, protein: 1.21, carbs: 3.11, fat: 0.32, fiber: 1 },
  grams: g(124, null, null, OZ, 196, { medium: 196 }),
  aliases: ["Zucchini", "Zucchini (chunked)", "Zucchini (half-moons)", "Zucchini or yellow squash (diced)"],
});
add({
  id: "mushroom-raw",
  name: "mushrooms, raw",
  fdcId: null,
  query: "Mushrooms, white, raw",
  per100g: { calories: 22, protein: 3.09, carbs: 3.26, fat: 0.34, fiber: 1 },
  grams: g(70, null, null, OZ, null),
  aliases: ["Mushrooms (optional)", "Sliced mushrooms"],
});
add({
  id: "pineapple",
  name: "pineapple, raw",
  fdcId: null,
  query: "Pineapple, raw, all varieties",
  per100g: { calories: 50, protein: 0.54, carbs: 13.12, fat: 0.12, fiber: 1.4 },
  grams: g(165, null, null, OZ, null),
  aliases: ["Pineapple chunks", "Frozen pineapple (optional)"],
});
add({
  id: "mango",
  name: "mango, raw",
  fdcId: null,
  query: "Mangos, raw",
  per100g: { calories: 60, protein: 0.82, carbs: 14.98, fat: 0.38, fiber: 1.6 },
  grams: g(165, null, null, OZ, null),
  aliases: ["Frozen mango chunks"],
});
add({
  id: "cauliflower-raw",
  name: "cauliflower, raw",
  fdcId: null,
  query: "Cauliflower, raw",
  per100g: { calories: 25, protein: 1.92, carbs: 4.97, fat: 0.28, fiber: 2 },
  grams: g(100, null, null, OZ, null),
  aliases: ["Riced cauliflower"],
});
add({
  id: "broccoli-raw",
  name: "broccoli, raw",
  fdcId: null,
  query: "Broccoli, raw",
  per100g: { calories: 34, protein: 2.82, carbs: 6.64, fat: 0.37, fiber: 2.6 },
  grams: g(90, null, null, OZ, null),
  aliases: ["Riced broccoli"],
});
add({
  id: "broth",
  name: "chicken broth",
  fdcId: null,
  query: "Soup, chicken broth, ready-to-serve",
  per100g: { calories: 6, protein: 0.7, carbs: 0.4, fat: 0.2, fiber: 0 },
  grams: g(240, 15, 5, null, null),
  aliases: ["Chicken broth", "Beef broth or chicken broth"],
});
add({
  id: "cheddar",
  name: "cheddar cheese",
  fdcId: null,
  query: "Cheese, cheddar",
  per100g: { calories: 403, protein: 22.87, carbs: 3.09, fat: 33.31, fiber: 0 },
  grams: g(113, 7, 2.3, OZ, 21, { slice: 21 }),
  aliases: [
    "Cheese slices",
    "Sharp cheddar, shredded",
    "Shredded cheddar",
    "Shredded cheddar (optional)",
    "Shredded cheddar or mozzarella",
    "Shredded cheese",
    "Shredded cheese (optional)",
    "Sliced cheddar or American cheese",
  ],
});

add({
  id: "pepper-jack",
  name: "pepper jack cheese",
  fdcId: null,
  query: "Cheese, pepper jack",
  per100g: { calories: 373, protein: 24.48, carbs: 0.68, fat: 30.28, fiber: 0 },
  grams: g(113, 7, 2.3, OZ, 21, { slice: 21 }),
  aliases: ["Pepper Jack cheese, shredded"],
});

add({
  id: "gruyere",
  name: "gruyere cheese",
  fdcId: null,
  query: "Cheese, gruyere",
  per100g: { calories: 413, protein: 29.81, carbs: 0.36, fat: 32.34, fiber: 0 },
  grams: g(108, 6.8, 2.3, OZ, null),
  aliases: ["Gruyère cheese, shredded"],
});

add({
  id: "swiss",
  name: "swiss cheese",
  fdcId: null,
  query: "Cheese, swiss",
  per100g: { calories: 393, protein: 26.96, carbs: 1.44, fat: 30.99, fiber: 0 },
  grams: g(108, 6.8, 2.3, OZ, 28, { slice: 28 }),
  aliases: ["Swiss cheese, shredded"],
});
add({
  id: "mozzarella",
  name: "mozzarella, part skim",
  fdcId: null,
  query: "Cheese, mozzarella, part skim milk",
  per100g: { calories: 254, protein: 24.26, carbs: 2.77, fat: 15.92, fiber: 0 },
  grams: g(112, 7, 2.3, OZ, 28, { stick: 28 }),
  aliases: ["Mozzarella pearls", "Mozzarella string cheese", "Shredded mozzarella or Gruyère"],
});
add({
  id: "babybel",
  name: "cheese, semisoft, Babybel-style",
  fdcId: null,
  query: "Cheese, gouda",
  per100g: { calories: 333, protein: 23.8, carbs: 0.5, fat: 26, fiber: 0 },
  grams: g(null, null, null, OZ, 21, { wheel: 21 }),
  aliases: ["Mini Babybel cheese"],
});
add({
  id: "feta",
  name: "feta cheese",
  fdcId: null,
  query: "Cheese, feta",
  per100g: { calories: 264, protein: 14.21, carbs: 4.09, fat: 21.28, fiber: 0 },
  grams: g(150, 9.4, 3.1, OZ, null),
  aliases: ["Crumbled feta", "Feta", "Feta cheese (crumbled)", "Feta cheese, crumbled"],
});
add({
  id: "parmesan",
  name: "parmesan cheese",
  fdcId: null,
  query: "Cheese, parmesan, hard",
  per100g: { calories: 392, protein: 35.75, carbs: 3.22, fat: 25.83, fiber: 0 },
  grams: g(100, 5, 1.7, OZ, null),
  aliases: ["Parmesan"],
});
add({
  id: "cream-cheese",
  name: "cream cheese, low fat (light)",
  fdcId: null,
  query: "Cheese, cream, low fat",
  per100g: { calories: 201, protein: 7.85, carbs: 8.13, fat: 15.28, fiber: 0 },
  grams: g(232, 14.5, 4.8, OZ, null),
  aliases: ["Light cream cheese"],
});
add({
  id: "sour-cream",
  name: "sour cream, light",
  fdcId: null,
  query: "Cream, sour, reduced fat",
  per100g: { calories: 181, protein: 7, carbs: 7, fat: 14, fiber: 0 },
  grams: g(230, 14, 4.7, OZ, null),
  aliases: ["Sour cream (optional)"],
});
add({
  id: "mayo",
  name: "mayonnaise, light",
  fdcId: null,
  query: "Salad dressing, mayonnaise, light",
  per100g: { calories: 238, protein: 0.4, carbs: 7.5, fat: 22.6, fiber: 0 },
  grams: g(240, 15, 5, OZ, null),
  aliases: ["Light mayonnaise", "Light chipotle mayo or burger sauce", "Spicy mayo or yogurt sauce"],
});
add({
  id: "caesar",
  name: "caesar dressing, light",
  fdcId: null,
  query: "Salad dressing, caesar, low calorie",
  per100g: { calories: 160, protein: 1.5, carbs: 6, fat: 14, fiber: 0.4 },
  grams: g(240, 15, 5, OZ, null),
  aliases: ["Light Caesar dressing"],
});
add({
  id: "mustard",
  name: "mustard, prepared",
  fdcId: null,
  query: "Mustard, prepared, yellow",
  per100g: { calories: 60, protein: 3.74, carbs: 5.83, fat: 3.34, fiber: 3.3 },
  grams: g(249, 15, 5, OZ, null),
  aliases: ["Mustard (optional)"],
});
add({
  id: "salsa",
  name: "salsa, ready-to-serve",
  fdcId: null,
  query: "Sauce, salsa, ready-to-serve",
  per100g: { calories: 36, protein: 1.5, carbs: 7, fat: 0.2, fiber: 1.4 },
  grams: g(255, 16, 5.3, OZ, null),
  aliases: ["Salsa", "Salsa verde (optional)"],
});
add({
  id: "hummus",
  name: "hummus, commercial",
  fdcId: null,
  query: "Hummus, commercial",
  per100g: { calories: 166, protein: 7.9, carbs: 14.29, fat: 9.6, fiber: 6 },
  grams: g(246, 15, 5, OZ, null),
  aliases: ["Hummus"],
});
add({
  id: "tzatziki",
  name: "tzatziki, yogurt cucumber sauce",
  fdcId: null,
  query: "Yogurt, Greek, plain, lowfat",
  per100g: { calories: 73, protein: 6, carbs: 4, fat: 3.5, fiber: 0.2 },
  grams: g(240, 15, 5, OZ, null),
  aliases: ["Tzatziki"],
});
add({
  id: "honey",
  name: "honey",
  fdcId: null,
  query: "Honey",
  per100g: { calories: 304, protein: 0.3, carbs: 82.4, fat: 0, fiber: 0.2 },
  grams: g(339, 21, 7, OZ, null),
  aliases: ["Honey"],
});
add({
  id: "maple",
  name: "maple syrup",
  fdcId: null,
  query: "Syrups, maple",
  per100g: { calories: 260, protein: 0.04, carbs: 67, fat: 0.06, fiber: 0 },
  grams: g(322, 20, 6.7, OZ, null),
  aliases: ["Maple syrup"],
});
add({
  id: "jam",
  name: "strawberry jam",
  fdcId: null,
  query: "Jams and preserves, strawberry",
  per100g: { calories: 250, protein: 0.4, carbs: 66, fat: 0.1, fiber: 1 },
  grams: g(320, 20, 6.7, OZ, null),
  aliases: ["Strawberry jam (low sugar)", "Orange marmalade"],
});
add({
  id: "cocoa",
  name: "cocoa powder, unsweetened",
  fdcId: null,
  query: "Cocoa, dry powder, unsweetened",
  per100g: { calories: 228, protein: 19.6, carbs: 57.9, fat: 13.7, fiber: 37 },
  grams: g(86, 5.4, 1.8, OZ, null),
  aliases: ["Unsweetened cocoa powder"],
});
add({
  id: "choc-chips",
  name: "chocolate chips, dark",
  fdcId: null,
  query: "Candies, semisweet chocolate",
  per100g: { calories: 480, protein: 4.2, carbs: 63.9, fat: 30, fiber: 5.9 },
  grams: g(175, 11, 3.6, OZ, null),
  aliases: ["Dark chocolate chips", "Mini chocolate chips"],
});
add({
  id: "coconut",
  name: "coconut, dried, unsweetened",
  fdcId: null,
  query: "Nuts, coconut meat, dried, not sweetened",
  per100g: { calories: 660, protein: 6.88, carbs: 23.65, fat: 64.53, fiber: 16.3 },
  grams: g(80, 5, 1.7, OZ, null),
  aliases: ["Unsweetened shredded coconut"],
});
add({
  id: "granola",
  name: "granola",
  fdcId: null,
  query: "Cereals ready-to-eat, granola, homemade",
  per100g: { calories: 489, protein: 13.7, carbs: 53.8, fat: 24.3, fiber: 8.9 },
  grams: g(122, 7.6, 2.5, OZ, null),
  aliases: ["Granola", "High-protein granola (low sugar)"],
});
add({
  id: "cornstarch",
  name: "cornstarch",
  fdcId: null,
  query: "Cornstarch",
  per100g: { calories: 381, protein: 0.26, carbs: 91.27, fat: 0.05, fiber: 0.9 },
  grams: g(128, 8, 2.7, OZ, null),
  aliases: ["Cornstarch"],
});
add({
  id: "rice-vinegar",
  name: "vinegar, rice",
  fdcId: null,
  query: "Vinegar, distilled",
  per100g: { calories: 18, protein: 0, carbs: 0.04, fat: 0, fiber: 0 },
  grams: g(239, 15, 5, null, null),
  aliases: ["Rice vinegar"],
});
add({
  id: "lemon-juice",
  name: "lemon juice, raw",
  fdcId: null,
  query: "Lemon juice, raw",
  per100g: { calories: 22, protein: 0.35, carbs: 6.9, fat: 0.24, fiber: 0.3 },
  grams: g(244, 15, 5, null, 48, { pcs: 48 }),
  aliases: ["Fresh lemon juice", "Squeeze of lemon (optional)", "Lemon", "Lime juice"],
});
add({
  id: "lemon-zest",
  name: "lemon peel, raw",
  fdcId: null,
  query: "Lemon peel, raw",
  per100g: { calories: 47, protein: 1.5, carbs: 16, fat: 0.3, fiber: 10.6 },
  grams: g(null, 6, 2, OZ, null),
  aliases: ["Lemon zest"],
});
add({
  id: "herbs-fresh",
  name: "parsley, fresh",
  fdcId: null,
  query: "Parsley, fresh",
  per100g: { calories: 36, protein: 2.97, carbs: 6.33, fat: 0.79, fiber: 3.3 },
  grams: g(60, 3.8, 1.3, OZ, 0.5, { leaves: 0.5 }),
  aliases: [
    "Fresh basil",
    "Fresh cilantro",
    "Fresh dill or parsley (optional)",
    "Fresh herbs (parsley or cilantro)",
    "Fresh parsley",
    "Fresh parsley (optional)",
    "Fresh thyme (optional)",
    "Parsley",
  ],
});

add({
  id: "chives",
  name: "chives, raw",
  fdcId: null,
  query: "Chives, raw",
  per100g: { calories: 30, protein: 3.27, carbs: 4.35, fat: 0.73, fiber: 2.5 },
  grams: g(48, 3, 1, OZ, null),
  aliases: ["Fresh chives, chopped"],
});
add({
  id: "capers",
  name: "capers, canned",
  fdcId: null,
  query: "Capers, canned",
  per100g: { calories: 23, protein: 2.36, carbs: 4.89, fat: 0.86, fiber: 3.2 },
  grams: g(null, 8.6, 2.9, OZ, null),
  aliases: ["Capers (optional)"],
});
add({
  id: "olives",
  name: "olives, ripe, canned",
  fdcId: null,
  query: "Olives, ripe, canned",
  per100g: { calories: 115, protein: 0.84, carbs: 6.26, fat: 10.68, fiber: 3.2 },
  grams: g(134, 8.4, 2.8, OZ, null),
  aliases: ["Kalamata olives (pitted, halved)", "Kalamata olives (pitted)"],
});
add({
  id: "jalapeno",
  name: "jalapeno, raw",
  fdcId: null,
  query: "Peppers, jalapeno, raw",
  per100g: { calories: 29, protein: 0.91, carbs: 6.5, fat: 0.37, fiber: 2.8 },
  grams: g(90, 9, 3, OZ, null),
  aliases: ["Jalapeño slices (optional)"],
});
add({
  id: "hot-sauce",
  name: "hot sauce, ready-to-serve",
  fdcId: null,
  query: "Sauce, ready-to-serve, pepper, TABASCO",
  per100g: { calories: 12, protein: 0.5, carbs: 0.8, fat: 0.6, fiber: 0.4 },
  grams: g(240, 15, 5, null, null),
  aliases: ["Hot sauce (optional)"],
});
add({
  id: "croutons",
  name: "croutons, plain",
  fdcId: null,
  query: "Croutons, plain",
  per100g: { calories: 407, protein: 11.9, carbs: 73.5, fat: 6.5, fiber: 5.5 },
  grams: g(30, null, null, OZ, null),
  aliases: ["Croutons"],
});
add({
  id: "stir-fry-sauce",
  name: "stir-fry sauce",
  fdcId: null,
  query: "Sauce, teriyaki, ready-to-serve",
  per100g: { calories: 89, protein: 5.93, carbs: 15.56, fat: 0.02, fiber: 0.1 },
  grams: g(288, 18, 6, null, null),
  aliases: ["Simple stir-fry sauce"],
});
add({
  id: "smoked-salmon",
  name: "salmon, smoked",
  fdcId: null,
  query: "Fish, salmon, chinook, smoked",
  per100g: { calories: 117, protein: 18.28, carbs: 0, fat: 4.32, fiber: 0 },
  grams: g(null, null, null, OZ, null),
  aliases: ["Smoked salmon, chopped"],
});
add({
  id: "protein-bar",
  name: "snack, protein bar",
  fdcId: null,
  skipUsda: "Packaged product; typed label values.",
  query: "Snacks, protein bar",
  per100g: { calories: 404, protein: 23, carbs: 40, fat: 15, fiber: 6 },
  grams: g(null, null, null, OZ, 52, { bar: 52 }),
  aliases: ["Protein bar", "RXBAR or similar nut-and-egg-white bar"],
});
add({
  id: "protein-chips",
  name: "snack, protein chips",
  fdcId: null,
  skipUsda: "Packaged product; typed label values.",
  query: "Snacks, tortilla chips, plain, white corn",
  per100g: { calories: 438, protein: 56, carbs: 22, fat: 16, fiber: 3 },
  grams: g(null, null, null, OZ, 32, { bag: 32 }),
  aliases: ["Protein chips (1 bag)"],
});
add({
  id: "rtd-shake",
  name: "protein shake, ready-to-drink",
  fdcId: null,
  skipUsda: "Packaged product; typed label values.",
  query: "Beverages, Protein powder soy based, prepared with water",
  per100g: { calories: 50, protein: 7.65, carbs: 2.35, fat: 1.47, fiber: 0.3 },
  grams: g(null, null, null, null, 340, { bottle: 340, "fl oz": FLOZ }),
  aliases: ["RTD protein shake (11.5 fl oz)"],
});
add({
  id: "seaweed",
  name: "seaweed, dried",
  fdcId: null,
  query: "Seaweed, wakame, raw",
  per100g: { calories: 45, protein: 3, carbs: 9.1, fat: 0.6, fiber: 0.5 },
  grams: g(null, null, null, OZ, 5, { pack: 5 }),
  aliases: ["Seaweed snacks"],
});
add({
  id: "diet-drink",
  name: "carbonated beverage, diet",
  fdcId: null,
  skipUsda: "USDA search returns regular cola; diet cola is zero-calorie.",
  query: "Beverages, carbonated, cola, diet",
  per100g: zero,
  grams: g(237, null, null, null, null, { "fl oz": FLOZ }),
  aliases: ["Diet beverage (zero-calorie soda, sparkling water, or similar)"],
});
add({
  id: "soda",
  name: "carbonated beverage, cola",
  fdcId: null,
  query: "Beverages, carbonated, cola",
  per100g: { calories: 39, protein: 0, carbs: 9.9, fat: 0, fiber: 0 },
  grams: g(246, null, null, null, null, { "fl oz": FLOZ }),
  aliases: ["Sweetened drink (soda, juice, or similar)"],
});

add({
  id: "black-pepper",
  name: "pepper, black",
  fdcId: null,
  query: "Spices, pepper, black",
  per100g: { calories: 251, protein: 10.39, carbs: 63.95, fat: 3.26, fiber: 25.3 },
  grams: g(null, 7, 2.3, OZ, null),
  aliases: ["Black pepper"],
});

/*
 * Portion roles, measuring state, and cooked/raw yields.
 * role:  protein | carb | fat | vegetable | flavor — default for goal-based portions (recipes can override).
 * state: raw | dry | cooked | as-sold — how the recipe amount is measured.
 * yield: cookedPerRaw = cooked weight ÷ weight as measured (raw or dry). Cooked-state foods
 *        keep the factor so the dry amount can be shown (dry = cooked ÷ cookedPerRaw);
 *        dryCupGrams gives the household measure for that dry amount.
 */
const MEAT_YIELD_SOURCE =
  "Approximate; typical of USDA Table of Cooking Yields for Meat and Poultry (Release 2, 2014). Verify per cut.";
const VEG_YIELD_SOURCE =
  "Estimate of sauté moisture loss; not from a USDA table. Applied only in recipes cooked together.";

const ROLE_GROUPS = {
  protein: [
    "turkey-ground-93-raw", "beef-ground-93-raw", "chicken-breast-raw", "chicken-ground-raw",
    "chicken-breast-roasted", "chicken-thigh-raw-skin", "sirloin-raw", "salmon-raw",
    "tuna-canned-water", "egg-whole-raw", "egg-white-raw", "bacon-cooked", "turkey-bacon",
    "ham-deli", "turkey-patty-cooked", "chicken-sausage", "beef-jerky", "meat-stick", "whey",
    "greek-nonfat", "greek-cup", "cottage-lowfat", "cottage-cup", "edamame", "smoked-salmon",
    "protein-bar", "protein-chips", "rtd-shake",
  ],
  carb: [
    "rice-white-cooked", "oats-dry", "pasta-dry", "protein-pasta-dry", "bread-wheat", "bagel",
    "croissant", "biscuit", "tortilla-flour", "tortilla-wheat", "tortilla-corn", "apple-raw",
    "banana-raw", "potato-raw", "hash-brown", "sweet-potato-raw", "berries", "strawberries",
    "black-beans", "chickpeas", "corn", "pineapple", "mango", "granola", "honey", "maple", "jam",
    "sugar", "croutons", "almond-milk", "milk-2", "milk-fat-free",
  ],
  fat: [
    "olive-oil", "butter", "chia", "almond-butter", "peanut-butter", "almonds", "peanuts",
    "cashews", "pecans", "walnuts", "avocado-raw", "cheddar", "mozzarella", "babybel", "feta",
    "parmesan", "cream-cheese", "sour-cream", "mayo", "caesar", "hummus", "coconut",
    "pepper-jack", "gruyere", "swiss",
  ],
  vegetable: [
    "broccoli-cooked", "green-beans-cooked", "asparagus-raw", "spinach-raw", "lettuce-raw",
    "pepper-raw", "brussels", "carrot-raw", "celery-raw", "tomato-raw", "tomato-canned",
    "cucumber-raw", "onion-raw", "zucchini-raw", "mushroom-raw", "cauliflower-raw",
    "broccoli-raw", "frozen-veg",
  ],
};

const STATE_BY_ID = {
  "chicken-breast-roasted": "cooked",
  "bacon-cooked": "cooked",
  "turkey-bacon": "cooked",
  "turkey-patty-cooked": "cooked",
  "chicken-sausage": "cooked",
  "rice-white-cooked": "cooked",
  "broccoli-cooked": "cooked",
  "green-beans-cooked": "cooked",
  "hash-brown": "cooked",
  "edamame": "cooked",
  "corn": "cooked",
  "frozen-veg": "cooked",
  "oats-dry": "dry",
  "pasta-dry": "dry",
  "protein-pasta-dry": "dry",
};

const RAW_IDS = new Set([
  "turkey-ground-93-raw", "beef-ground-93-raw", "chicken-breast-raw", "chicken-ground-raw",
  "chicken-thigh-raw-skin", "sirloin-raw", "salmon-raw", "egg-whole-raw", "egg-white-raw",
  "brussels", "berries", "strawberries", "pineapple", "mango", "ginger", "jalapeno", "herbs-fresh",
]);

const YIELD_BY_ID = {
  "turkey-ground-93-raw": { cookedPerRaw: 0.75, source: MEAT_YIELD_SOURCE },
  "beef-ground-93-raw": { cookedPerRaw: 0.75, source: MEAT_YIELD_SOURCE },
  "chicken-ground-raw": { cookedPerRaw: 0.75, source: MEAT_YIELD_SOURCE },
  "chicken-breast-raw": { cookedPerRaw: 0.75, source: MEAT_YIELD_SOURCE },
  "chicken-thigh-raw-skin": { cookedPerRaw: 0.75, source: MEAT_YIELD_SOURCE },
  "sirloin-raw": { cookedPerRaw: 0.75, source: MEAT_YIELD_SOURCE },
  "salmon-raw": { cookedPerRaw: 0.8, source: MEAT_YIELD_SOURCE },
  "rice-white-cooked": {
    cookedPerRaw: 2.6,
    dryCupGrams: 185,
    source:
      "Derived from USDA FoodData Central portion weights: 1 cup dry long-grain rice ≈ 185 g yields ≈ 3 cups cooked at 158 g.",
  },
  "pasta-dry": {
    cookedPerRaw: 2.5,
    source:
      "Derived from USDA FoodData Central portion weights: 56 g (2 oz) dry yields ≈ 1 cup cooked at 140 g.",
  },
  "protein-pasta-dry": {
    cookedPerRaw: 2.5,
    source: "Assumed same as wheat pasta (USDA FoodData Central portion weights).",
  },
  "oats-dry": {
    cookedPerRaw: 1,
    source:
      "Recipes list the soaking/cooking liquid separately, so oats add their dry weight only (avoids double counting).",
  },
  "spinach-raw": { cookedPerRaw: 0.3, source: VEG_YIELD_SOURCE },
  "mushroom-raw": { cookedPerRaw: 0.6, source: VEG_YIELD_SOURCE },
  "onion-raw": { cookedPerRaw: 0.75, source: VEG_YIELD_SOURCE },
  "zucchini-raw": { cookedPerRaw: 0.8, source: VEG_YIELD_SOURCE },
  "pepper-raw": { cookedPerRaw: 0.85, source: VEG_YIELD_SOURCE },
};

const roleById = new Map();
for (const [role, ids] of Object.entries(ROLE_GROUPS)) {
  for (const id of ids) roleById.set(id, role);
}

for (const f of foods) {
  f.role = roleById.get(f.id) ?? "flavor";
  f.state = STATE_BY_ID[f.id] ?? (RAW_IDS.has(f.id) || f.id.endsWith("-raw") ? "raw" : "as-sold");
  f.yield = YIELD_BY_ID[f.id] ?? null;
}

// Keep values fetched from USDA (scripts/fetchUsda.ts) so a rebuild does not undo them.
// Change the typed entry's query or fdcId and re-run the fetch to pick a different USDA food.
const previous = fs.existsSync("src/data/ingredients.json")
  ? new Map(JSON.parse(fs.readFileSync("src/data/ingredients.json", "utf8")).map((f) => [f.id, f]))
  : new Map();
for (const f of foods) {
  const old = previous.get(f.id);
  if (f.skipUsda || !old?.usda || old.query !== f.query || (f.fdcId != null && f.fdcId !== old.fdcId)) continue;
  f.fdcId = old.fdcId;
  f.per100g = old.per100g;
  f.usda = old.usda;
  for (const [unit, grams] of Object.entries(old.grams ?? {})) {
    if (grams != null && f.grams[unit] == null) f.grams[unit] = grams;
  }
}

const clean = foods.map((f) => {
  const grams = {
    cup: f.grams.cup ?? null,
    tbsp: f.grams.tbsp ?? null,
    tsp: f.grams.tsp ?? null,
    oz: f.grams.oz ?? null,
    each: f.grams.each ?? null,
  };
  for (const [k, v] of Object.entries(f.grams)) {
    if (v != null) grams[k] = v;
  }
  return { ...f, grams };
});

fs.mkdirSync("src/data", { recursive: true });
fs.writeFileSync("src/data/ingredients.json", JSON.stringify(clean, null, 2) + "\n");
console.log("wrote", clean.length, "foods");

const root = "src/recipes";
const files = [];
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".ts")) files.push(p);
  }
}
walk(root);
const text = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");
const ingRe = /\{\s*name:\s*"([^"]+)"\s*,\s*quantity:\s*[^,]+,\s*unit:\s*"([^"]+)"/g;
const names = new Map();
let m;
while ((m = ingRe.exec(text))) {
  if (!names.has(m[1])) names.set(m[1], new Set());
  names.get(m[1]).add(m[2]);
}
const alias = new Set(clean.flatMap((f) => f.aliases.map((a) => a.toLowerCase())));
const missing = [...names.keys()].filter((n) => !alias.has(n.toLowerCase()));
console.log("missing aliases", missing.length);
for (const n of missing) console.log(" -", n, "|", [...names.get(n)].join(", "));
