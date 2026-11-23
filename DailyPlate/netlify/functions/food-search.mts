/**
 * GET /.netlify/functions/food-search?q=chobani+vanilla   (search)
 * GET /.netlify/functions/food-search?fdcId=12345         (household portions for a generic food)
 * USDA FoodData Central (key from the USDA_API_KEY environment variable, server-side only), then
 * Open Food Facts. Errors are logged (Netlify → Logs → Functions → food-search).
 */
import { handleFoodSearchRequest } from "../../src/server/foodSources.ts";

export default async (req: Request): Promise<Response> => {
  const key = process.env.USDA_API_KEY?.trim() || undefined;
  return handleFoodSearchRequest(req.url, key);
};
