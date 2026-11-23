/**
 * GET /.netlify/functions/food-search?q=chobani+vanilla
 * Searches USDA FoodData Central (key from the USDA_API_KEY environment variable, server-side only),
 * then Open Food Facts when USDA has few results. Results are cached for a day.
 */
import { searchRemote } from "../../src/server/foodSources.ts";

export default async (req: Request): Promise<Response> => {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) {
    return Response.json({ error: "Type at least 2 characters." }, { status: 400 });
  }
  const { results, usdaCount, offCount } = await searchRemote(q, process.env.USDA_API_KEY);
  return Response.json(
    { query: q, results, usdaCount, offCount },
    { headers: { "Cache-Control": "public, max-age=86400" } },
  );
};
