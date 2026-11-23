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
  /** Generic USDA food (Survey, SR Legacy, Foundation): values are per 100 g until a portion is chosen. */
  generic?: boolean;
  /** Original name from the source (e.g. "Candies, MARS SNACKFOOD US, SNICKERS Bar"), shown in details. */
  sourceName?: string;
  /** Calories per 100 g, used to spot the same food in two datasets. */
  kcalPer100g?: number;
  /** USDA dataset ("Branded", "SR Legacy", "Survey (FNDDS)", "Foundation"). */
  dataset?: string;
};

/** A household portion from USDA details, e.g. "1 sandwich" = 230 g. */
export type FoodPortion = { label: string; grams: number };
