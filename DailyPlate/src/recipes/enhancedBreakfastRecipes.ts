import type { Recipe, RecipeVariationDetail } from "@/types";

const overnightOatsVariations: RecipeVariationDetail[] = [
  {
    id: "blueberry-lemon",
    label: "Blueberry Lemon",
    ingredients: [
      { name: "Fresh blueberries", quantity: 0.33, unit: "cup", category: "Produce" },
      { name: "Lemon zest", quantity: 1, unit: "tsp", category: "Produce" },
      { name: "Fresh lemon juice", quantity: 1, unit: "tsp", category: "Produce" },
    ],
    instructions: [
      "Fold blueberries and lemon zest into the oat base.",
      "Drizzle lemon juice over each jar before sealing.",
      "Top with extra blueberries when serving if desired.",
    ],
    servingWeightGrams: 420,
  },
  {
    id: "chocolate-banana-nut",
    label: "Chocolate Banana Nut",
    ingredients: [
      { name: "Sliced banana", quantity: 0.5, unit: "medium", category: "Produce" },
      { name: "Dark chocolate chips", quantity: 1, unit: "tbsp", category: "Pantry" },
      { name: "Chopped walnuts or hazelnuts", quantity: 1, unit: "tbsp", category: "Pantry" },
      { name: "Chocolate protein powder (or vanilla)", quantity: 0.5, unit: "scoop", category: "Pantry" },
    ],
    instructions: [
      "Mash half the banana into the oat base; layer remaining slices on top.",
      "Fold in chocolate chips and nuts before sealing jars.",
      "Stir before eating so chocolate melts slightly into the oats.",
    ],
    servingWeightGrams: 435,
  },
  {
    id: "cinnamon-maple",
    label: "Cinnamon Maple",
    ingredients: [
      { name: "Cinnamon", quantity: 0.5, unit: "tsp", category: "Spices" },
      { name: "Maple syrup", quantity: 1, unit: "tbsp", category: "Pantry" },
      { name: "Brown sugar or coconut sugar", quantity: 1, unit: "tsp", category: "Pantry" },
    ],
    instructions: [
      "Whisk cinnamon and maple syrup into the oat base.",
      "Sprinkle brown sugar over each jar for a crumble-style topping.",
      "Stir well before eating.",
    ],
    servingWeightGrams: 415,
  },
  {
    id: "apple-pecan",
    label: "Apple Pecan",
    ingredients: [
      { name: "Diced apple", quantity: 0.5, unit: "medium", category: "Produce" },
      { name: "Chopped pecans", quantity: 2, unit: "tbsp", category: "Pantry" },
      { name: "Cinnamon", quantity: 0.25, unit: "tsp", category: "Spices" },
    ],
    instructions: [
      "Fold diced apple and cinnamon into the oat base.",
      "Top each jar with pecans before sealing.",
      "Best after chilling overnight so apples soften slightly.",
    ],
    servingWeightGrams: 425,
  },
  {
    id: "strawberry",
    label: "Strawberry",
    ingredients: [
      { name: "Diced strawberries", quantity: 0.33, unit: "cup", category: "Produce" },
      { name: "Strawberry jam (low sugar)", quantity: 1, unit: "tbsp", category: "Pantry" },
      { name: "Strawberry protein powder (or vanilla)", quantity: 0.5, unit: "scoop", category: "Pantry" },
    ],
    instructions: [
      "Stir jam into the oat base for a ribbon effect.",
      "Fold in diced strawberries before sealing jars.",
      "Top with extra strawberry pieces when serving if desired.",
    ],
    servingWeightGrams: 415,
  },
  {
    id: "coconut-chocolate-banana",
    label: "Coconut Chocolate Banana",
    ingredients: [
      { name: "Sliced banana", quantity: 0.5, unit: "medium", category: "Produce" },
      { name: "Unsweetened shredded coconut", quantity: 2, unit: "tbsp", category: "Pantry" },
      { name: "Dark chocolate chips", quantity: 1, unit: "tbsp", category: "Pantry" },
    ],
    instructions: [
      "Layer banana slices and coconut through the oat base.",
      "Top each jar with chocolate chips before sealing.",
      "Stir before eating so coconut and chocolate distribute evenly.",
    ],
    servingWeightGrams: 430,
  },
];

const smoothieVariations: RecipeVariationDetail[] = [
  {
    id: "strawberry",
    label: "Strawberry",
    ingredients: [
      { name: "Frozen strawberries", quantity: 0.5, unit: "cup", category: "Produce" },
      { name: "Strawberry protein powder (or vanilla)", quantity: 0.5, unit: "scoop", category: "Pantry" },
    ],
    instructions: [
      "Blend with base ingredients until smooth and pink.",
      "Top with fresh strawberry slices if serving immediately.",
    ],
    servingWeightGrams: 355,
  },
  {
    id: "blueberry",
    label: "Blueberry",
    ingredients: [
      { name: "Frozen blueberries", quantity: 0.5, unit: "cup", category: "Produce" },
    ],
    instructions: [
      "Blend with base ingredients until smooth and lavender-purple.",
      "Top with whole blueberries if serving immediately.",
    ],
    servingWeightGrams: 350,
  },
  {
    id: "chocolate-chip",
    label: "Chocolate Chip",
    ingredients: [
      { name: "Natural peanut butter", quantity: 1, unit: "tbsp", category: "Pantry" },
      { name: "Unsweetened cocoa powder", quantity: 1, unit: "tsp", category: "Pantry" },
      { name: "Mini chocolate chips", quantity: 1, unit: "tbsp", category: "Pantry" },
      { name: "Chocolate protein powder (or vanilla)", quantity: 0.5, unit: "scoop", category: "Pantry" },
    ],
    instructions: [
      "Blend base ingredients with peanut butter and cocoa until creamy.",
      "Stir in chocolate chips after blending (or pulse once) so they stay chunky.",
    ],
    servingWeightGrams: 365,
    calories: 385,
    protein: 40,
    carbs: 34,
    fat: 12,
  },
  {
    id: "cherry-berry",
    label: "Cherry Berry",
    ingredients: [
      { name: "Frozen cherries or mixed berries", quantity: 0.5, unit: "cup", category: "Produce" },
    ],
    instructions: [
      "Blend with base ingredients until deep pink and completely smooth.",
      "Top with extra cherries or cranberries if serving immediately.",
    ],
    servingWeightGrams: 350,
  },
  {
    id: "green-spinach",
    label: "Green Spinach",
    ingredients: [
      { name: "Baby spinach", quantity: 1, unit: "cup", category: "Produce" },
      { name: "Frozen pineapple (optional)", quantity: 0.25, unit: "cup", category: "Produce" },
    ],
    instructions: [
      "Blend spinach with base ingredients first until no green flecks remain.",
      "Add pineapple if using for extra sweetness without added sugar.",
    ],
    servingWeightGrams: 345,
    calories: 320,
    protein: 36,
    carbs: 30,
    fat: 7,
  },
  {
    id: "mango-tropical",
    label: "Mango Tropical",
    ingredients: [
      { name: "Frozen mango chunks", quantity: 0.5, unit: "cup", category: "Produce" },
      { name: "Lime juice", quantity: 1, unit: "tsp", category: "Produce" },
    ],
    instructions: [
      "Blend with base ingredients until bright yellow-orange and silky.",
      "Top with fresh mango cubes if serving immediately.",
    ],
    servingWeightGrams: 355,
  },
];

const eggBiteVariations: RecipeVariationDetail[] = [
  {
    id: "bacon-gruyere",
    label: "Bacon & Gruyère",
    ingredients: [
      { name: "Cooked bacon, chopped", quantity: 2, unit: "slices", category: "Protein" },
      { name: "Gruyère cheese, shredded", quantity: 0.25, unit: "cup", category: "Dairy" },
    ],
    instructions: [
      "Fold bacon and Gruyère into the egg mixture before pouring into the tin.",
    ],
  },
  {
    id: "egg-white-roasted-red-pepper",
    label: "Egg White & Roasted Red Pepper",
    ingredients: [
      { name: "Roasted red peppers, diced", quantity: 0.25, unit: "cup", category: "Produce" },
      { name: "Extra liquid egg whites", quantity: 0.25, unit: "cup", category: "Protein" },
    ],
    instructions: [
      "Use extra egg whites in place of one whole egg for a lighter bite.",
      "Fold in roasted red peppers before baking.",
    ],
  },
  {
    id: "ham-swiss-chives",
    label: "Ham & Swiss with Chives",
    ingredients: [
      { name: "Diced ham", quantity: 0.33, unit: "cup", category: "Protein" },
      { name: "Swiss cheese, shredded", quantity: 0.25, unit: "cup", category: "Dairy" },
      { name: "Fresh chives, chopped", quantity: 1, unit: "tbsp", category: "Produce" },
    ],
    instructions: [
      "Stir ham, Swiss, and chives into the blended egg mixture.",
    ],
  },
  {
    id: "spinach-feta-sundried",
    label: "Egg White Spinach Feta & Sun-Dried Tomato",
    ingredients: [
      { name: "Baby spinach, chopped", quantity: 0.5, unit: "cup", category: "Produce" },
      { name: "Feta cheese, crumbled", quantity: 2, unit: "tbsp", category: "Dairy" },
      { name: "Sun-dried tomatoes, chopped", quantity: 2, unit: "tbsp", category: "Produce" },
    ],
    instructions: [
      "Wilt spinach briefly in the pan; squeeze dry and fold into eggs with feta and tomatoes.",
    ],
  },
  {
    id: "chicken-sausage-pepper-jack",
    label: "Chicken Sausage & Pepper Jack",
    ingredients: [
      { name: "Chicken sausage, diced", quantity: 2, unit: "oz", category: "Protein" },
      { name: "Pepper Jack cheese, shredded", quantity: 0.25, unit: "cup", category: "Dairy" },
    ],
    instructions: [
      "Brown sausage lightly; cool and fold into egg mixture with Pepper Jack.",
    ],
  },
  {
    id: "smoked-salmon-cream-cheese",
    label: "Smoked Salmon & Cream Cheese",
    ingredients: [
      { name: "Smoked salmon, chopped", quantity: 2, unit: "oz", category: "Protein" },
      { name: "Light cream cheese", quantity: 2, unit: "tbsp", category: "Dairy" },
      { name: "Capers (optional)", quantity: 1, unit: "tsp", category: "Pantry" },
    ],
    instructions: [
      "Dot cream cheese and salmon over filled muffin cups; top with capers if using.",
    ],
  },
  {
    id: "broccoli-sharp-cheddar",
    label: "Broccoli & Sharp Cheddar",
    ingredients: [
      { name: "Steamed broccoli florets, chopped", quantity: 0.5, unit: "cup", category: "Produce" },
      { name: "Sharp cheddar, shredded", quantity: 0.25, unit: "cup", category: "Dairy" },
    ],
    instructions: [
      "Fold steamed, well-drained broccoli and cheddar into the egg mixture.",
    ],
  },
];

export const highProteinOvernightOats: Recipe = {
  id: "high-protein-overnight-oats-54",
  number: 28,
  name: "High Protein Overnight Oats",
  imageUrl: "/recipes/high-protein-overnight-oats.png",
  cuisine: "american",
  tags: ["high_protein", "meal_prep", "breakfast_friendly", "batch_friendly"],
  mealSlots: ["breakfast", "snack"],
  calories: 385,
  protein: 32,
  carbs: 42,
  fat: 10,
  prepMinutes: 10,
  cookMinutes: 0,
  servingWeightGrams: 415,
  batchWeightGrams: 1660,
  mealPrepBatchServings: 4,
  ingredients: [
    { name: "Rolled oats", quantity: 0.5, unit: "cup", category: "Grains" },
    { name: "Plain Greek yogurt (0% or low sugar)", quantity: 0.5, unit: "cup", category: "Dairy" },
    { name: "Unsweetened almond milk", quantity: 0.5, unit: "cup", category: "Pantry" },
    { name: "Vanilla protein powder", quantity: 1, unit: "scoop", category: "Pantry" },
    { name: "Chia seeds", quantity: 1, unit: "tbsp", category: "Pantry" },
    { name: "Pinch of salt", quantity: 1, unit: "pinch", category: "Spices" },
  ],
  instructions: [
    "In a bowl, whisk oats, Greek yogurt, almond milk, protein powder, chia, and salt until combined.",
    "Add variation-specific ingredients (see chosen flavor below) and mix.",
    "For jar meal prep: divide evenly among 4 mason jars (~415 g each, ~1,660 g total batch).",
    "Refrigerate at least 6 hours or overnight. Stir before eating.",
    "If your plan needs more protein, we slightly increase protein powder and yogurt while keeping oats moderate so texture stays creamy.",
  ],
  variationDetails: overnightOatsVariations,
  mealPrepNotes:
    "Keeps 4 days refrigerated in sealed jars. Do not freeze (texture breaks). Stir and add fresh fruit when serving if desired.",
};

export const highProteinSmoothie: Recipe = {
  id: "high-protein-smoothie-55",
  number: 29,
  name: "High Protein Smoothie",
  imageUrl: "/recipes/high-protein-smoothie.png",
  cuisine: "american",
  tags: ["high_protein", "quick", "meal_prep", "breakfast_friendly"],
  mealSlots: ["breakfast", "snack"],
  calories: 340,
  protein: 38,
  carbs: 32,
  fat: 8,
  prepMinutes: 5,
  cookMinutes: 0,
  servingWeightGrams: 350,
  batchWeightGrams: 1400,
  mealPrepBatchServings: 4,
  ingredients: [
    { name: "Vanilla or unflavored protein powder", quantity: 1.5, unit: "scoop", category: "Pantry" },
    { name: "Unsweetened almond milk (or milk of choice)", quantity: 1, unit: "cup", category: "Pantry" },
    { name: "Frozen banana", quantity: 0.5, unit: "medium", category: "Produce" },
    { name: "Ice", quantity: 0.5, unit: "cup", category: "Pantry" },
  ],
  instructions: [
    "Add base ingredients and your chosen variation add-ins to a blender.",
    "Blend until completely smooth (60–90 seconds).",
    "Pour into a glass and drink immediately, or portion for meal prep (see below).",
    "Single serving weighs about 350 g blended.",
    "Meal prep (4 servings): blend one full batch, pour into four 12–16 oz containers (~350 g each, ~1,400 g total). Refrigerate up to 24 hours; shake well before drinking.",
  ],
  variationDetails: smoothieVariations,
  mealPrepNotes:
    "Best within 24 hours refrigerated. Freeze portions only if you accept a slightly icier texture when thawed in the fridge overnight.",
};

export const eggBiteVariationDetails = eggBiteVariations;
