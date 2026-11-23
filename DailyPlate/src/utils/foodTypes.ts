/** A food found by name (USDA, Open Food Facts) or typed from a label, per one serving. */
export type FoodItem = {
  /** Stable key: `${source}:${sourceId}`. */
  id: string;
  name: string;
  brand?: string;
  /** e.g. "1 container (150 g)" */
  servingLabel: string;
  servingGrams?: number | null;
  calories: number;
  protein: number;
  carbs?: number;
  fat?: number;
  source: "usda" | "off" | "manual";
  sourceId: string;
  /** Shown with Open Food Facts results. */
  credit?: string;
};
