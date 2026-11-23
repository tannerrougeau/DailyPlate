/**
 * GET /.netlify/functions/food-search?q=chobani+vanilla
 * Searches USDA FoodData Central (key from the USDA_API_KEY environment variable, server-side only),
 * then Open Food Facts when USDA has few results. Results are cached for a day.
 */
import { searchRemote, usdaPortions } from "../../src/server/foodSources.ts";

export default async (req: Request): Promise<Response> => {
  const params = new URL(req.url).searchParams;
  // Details for a generic USDA food: household portions (?fdcId=12345).
  const fdcId = (params.get("fdcId") ?? "").trim();
  if (fdcId) {
    const key = process.env.USDA_API_KEY;
    if (!/^\d{1,10}$/.test(fdcId) || !key) return Response.json({ portions: [] }, { status: key ? 400 : 503 });
    try {
      const portions = await usdaPortions(fdcId, key);
      return Response.json({ fdcId, portions }, { headers: { "Cache-Control": "public, max-age=86400" } });
    } catch {
      return Response.json({ portions: [] }, { status: 502 });
    }
  }
  const q = (params.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) {
    return Response.json({ error: "Type at least 2 characters." }, { status: 400 });
  }
  const { results, usdaCount, offCount } = await searchRemote(q, process.env.USDA_API_KEY);
  return Response.json(
    { query: q, results, usdaCount, offCount },
    { headers: { "Cache-Control": "public, max-age=86400" } },
  );
};
