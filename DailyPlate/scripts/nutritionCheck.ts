/**
 * Every built-in recipe build (variation × carb swap × fat swap) must match ingredients.json, since
 * built-in nutrition is computed from it. Exits 1 and lists the lines that don't match.
 *
 * Usage: npm run nutrition:check
 */
import { recipeLibrary } from "../src/recipes/recipeLibrary.ts";
import { unmatchedBuiltInBuilds } from "../src/utils/nutritionCheck.ts";

const unmatched = unmatchedBuiltInBuilds(recipeLibrary);
if (unmatched.length === 0) {
  console.log(`nutrition:check passed: all ${recipeLibrary.length} built-in recipes match ingredients.json.`);
} else {
  console.log(`nutrition:check failed: ${unmatched.length} build(s) have ingredients missing from ingredients.json.`);
  for (const b of unmatched) {
    console.log(`  ${b.recipe} (${b.build})`);
    for (const line of b.lines) console.log(`      ${line}`);
  }
  process.exit(1);
}
