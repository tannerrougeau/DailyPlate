/**
 * Scan types shared by the food-scan function and the app. A provider identifies what was
 * photographed; it never supplies calories for foods (USDA does) and reads labels as printed.
 */

export type ScanType = "food" | "label" | "barcode" | "unknown";

export type ScanItem = {
  /** Plain, searchable name: "turkey sandwich". */
  name: string;
  /** Brand when a package or wrapper shows one ("Snickers"), else null. */
  brand: string | null;
  confidence: number;
  portion: { amount: number; unit: string; grams: number };
  /** Things that change nutrition: "fried", "creamy sauce", "visible oil". */
  notes: string[];
  /**
   * A whole or shared dish (pizza, cake, casserole): the whole item and its serving unit, e.g.
   * { name: "12-inch pizza", servings: 8, unit: "slice", gramsPerServing: 80 }. null otherwise.
   */
  whole: ScanWhole | null;
};

export type ScanWhole = {
  /** The whole item as seen: "12-inch pizza". */
  name: string;
  /** How many servings the whole item makes: 8. */
  servings: number;
  /** Singular serving unit: "slice". */
  unit: string;
  gramsPerServing: number;
};

export type ScanLabel = {
  /** From the label or, when visible, the front of the package. null when neither shows it. */
  productName: string | null;
  /** The per-serving column when the label has two. grams null when not printed. */
  servingSize: { text: string; grams: number | null };
  servingsPerContainer: number | null;
  calories: number;
  protein: number;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sodiumMg: number | null;
};

export type ScanResult = {
  type: ScanType;
  /** 0–1, overall. */
  confidence: number;
  /** null when no planned meal was sent. */
  plannedMeal: { matches: boolean; confidence: number } | null;
  /** Food only; [] otherwise. */
  items: ScanItem[];
  /** Label only. */
  label: ScanLabel | null;
  /** More than one Nutrition Facts panel is visible: the app asks for a photo of just one. */
  multipleLabels: boolean;
  /** Barcode the phone couldn't read: digits if legible. */
  barcode: { digits: string | null } | null;
  /** Up to 3 likely names, for low confidence or unknown. */
  suggestions: string[];
};

export type ScanContext = {
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  plannedMeal?: { name: string; ingredients: string[] };
};

export type ScanImage = { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" };

export type RecognizeOptions = {
  /** Abort when the whole scan's deadline passes. */
  signal?: AbortSignal;
  /** Milliseconds left before the deadline. */
  timeLeftMs?: () => number;
};

/** One interface for every provider, chosen by SCAN_PROVIDER. */
export interface ScanProvider {
  name: string;
  model: string;
  recognize(image: ScanImage, context: ScanContext, options?: RecognizeOptions): Promise<ScanResult>;
}

export type ScanErrorCode = "too_large" | "bad_request" | "limit_reached" | "scan_failed";

export type ScanResponse =
  | { result: ScanResult; meta: { provider: string; model: string; ms: number } }
  | { error: ScanErrorCode };
