/**
 * The scan result schema: the report_scan tool's input schema (strict tool use) and a hand-written
 * validator, because the server checks every reply itself. Strict mode needs every key present
 * and additionalProperties false; numeric ranges aren't supported there, so they're checked here.
 */
import type { ScanItem, ScanLabel, ScanResult, ScanWhole } from "./types";

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: "null" }] });
const num = { type: "number" };
const numOrNull = { type: ["number", "null"] };
const strOrNull = { type: ["string", "null"] };

export const SCAN_RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["type", "confidence", "plannedMeal", "items", "label", "multipleLabels", "barcode", "suggestions"],
  properties: {
    type: { type: "string", enum: ["food", "label", "barcode", "unknown"] },
    confidence: { ...num, description: "0 to 1, how sure you are overall." },
    plannedMeal: {
      ...nullable({
        type: "object",
        additionalProperties: false,
        required: ["matches", "confidence"],
        properties: { matches: { type: "boolean" }, confidence: num },
      }),
      description: "null when no planned meal was given.",
    },
    items: {
      type: "array",
      description: "Food only; empty otherwise.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "brand", "confidence", "portion", "notes", "whole"],
        properties: {
          name: { type: "string", description: "Plain, searchable food name, e.g. 'turkey sandwich'." },
          brand: { ...strOrNull, description: "Brand if a package or wrapper shows one, else null." },
          confidence: num,
          portion: {
            type: "object",
            additionalProperties: false,
            required: ["amount", "unit", "grams"],
            properties: { amount: num, unit: { type: "string" }, grams: num },
          },
          notes: {
            type: "array",
            items: { type: "string" },
            description: "Only things that change nutrition: fried, sauce, visible oil, cheese, etc.",
          },
          whole: {
            ...nullable({
              type: "object",
              additionalProperties: false,
              required: ["name", "servings", "unit", "gramsPerServing"],
              properties: {
                name: { type: "string", description: "The whole item, e.g. '12-inch pizza'." },
                servings: { ...num, description: "Servings in the whole item, e.g. 8." },
                unit: { type: "string", description: "Singular serving unit, e.g. 'slice'." },
                gramsPerServing: num,
              },
            }),
            description: "Whole or shared dishes only (pizza, cake, casserole); null otherwise.",
          },
        },
      },
    },
    label: {
      ...nullable({
        type: "object",
        additionalProperties: false,
        required: [
          "productName",
          "servingSize",
          "servingsPerContainer",
          "calories",
          "protein",
          "carbs",
          "fat",
          "fiber",
          "sodiumMg",
        ],
        properties: {
          productName: strOrNull,
          servingSize: {
            type: "object",
            additionalProperties: false,
            required: ["text", "grams"],
            properties: { text: { type: "string" }, grams: numOrNull },
          },
          servingsPerContainer: numOrNull,
          calories: num,
          protein: num,
          carbs: numOrNull,
          fat: numOrNull,
          fiber: numOrNull,
          sodiumMg: numOrNull,
        },
      }),
      description: "Nutrition Facts label only; per-serving column. null otherwise.",
    },
    multipleLabels: {
      type: "boolean",
      description: "true when more than one Nutrition Facts panel is visible.",
    },
    barcode: {
      ...nullable({
        type: "object",
        additionalProperties: false,
        required: ["digits"],
        properties: { digits: strOrNull },
      }),
      description: "Barcode only: the printed digits if legible. null otherwise.",
    },
    suggestions: {
      type: "array",
      items: { type: "string" },
      description: "Up to 3 likely food names when unsure or unknown.",
    },
  },
} as const;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isNumOrNull = (v: unknown) => v === null || isNum(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isUnit = (v: unknown) => isNum(v) && v >= 0 && v <= 1;

/** A usable whole-dish description, or null (it's optional detail, so a bad one is dropped, not fatal). */
function wholeOf(v: unknown): ScanWhole | null {
  if (!isObj(v) || !isStr(v.name) || !v.name.trim() || !isStr(v.unit) || !v.unit.trim()) return null;
  if (!isNum(v.servings) || v.servings < 1 || v.servings > 100) return null;
  if (!isNum(v.gramsPerServing) || v.gramsPerServing <= 0 || v.gramsPerServing > 5000) return null;
  return { name: v.name.trim(), servings: v.servings, unit: v.unit.trim(), gramsPerServing: v.gramsPerServing };
}

function validItem(v: unknown): v is Omit<ScanItem, "whole"> & { whole?: unknown } {
  if (!isObj(v) || !isStr(v.name) || !v.name.trim() || !isUnit(v.confidence)) return false;
  if (!(v.brand === null || isStr(v.brand))) return false;
  const p = v.portion;
  if (!isObj(p) || !isNum(p.amount) || !isStr(p.unit) || !isNum(p.grams) || p.grams < 0 || p.grams > 5000) return false;
  return Array.isArray(v.notes) && v.notes.every(isStr);
}

function validLabel(v: unknown): v is ScanLabel {
  if (!isObj(v) || !(v.productName === null || isStr(v.productName))) return false;
  const s = v.servingSize;
  if (!isObj(s) || !isStr(s.text) || !isNumOrNull(s.grams)) return false;
  if (!isNum(v.calories) || v.calories < 0 || !isNum(v.protein) || v.protein < 0) return false;
  return ["servingsPerContainer", "carbs", "fat", "fiber", "sodiumMg"].every((k) => isNumOrNull(v[k]));
}

/** The reply as a ScanResult, or null when anything is missing or out of range. Trims suggestions to 3. */
export function validateScanResult(v: unknown): ScanResult | null {
  if (!isObj(v)) return null;
  if (!["food", "label", "barcode", "unknown"].includes(v.type as string)) return null;
  if (!isUnit(v.confidence)) return null;
  const pm = v.plannedMeal;
  if (!(pm === null || (isObj(pm) && typeof pm.matches === "boolean" && isUnit(pm.confidence)))) return null;
  if (!Array.isArray(v.items) || !v.items.every(validItem)) return null;
  if (!(v.label === null || validLabel(v.label))) return null;
  const b = v.barcode;
  if (!(b === null || (isObj(b) && (b.digits === null || isStr(b.digits))))) return null;
  if (!Array.isArray(v.suggestions) || !v.suggestions.every(isStr)) return null;
  if (!(v.multipleLabels === undefined || typeof v.multipleLabels === "boolean")) return null;
  const multipleLabels = v.multipleLabels === true;
  // Several labels: nothing is read from them, so a label scan needs values only when there's one.
  if (v.type === "label" && v.label === null && !multipleLabels) return null;
  return {
    type: v.type as ScanResult["type"],
    confidence: v.confidence as number,
    plannedMeal: pm as ScanResult["plannedMeal"],
    items: v.items.map((i: Record<string, unknown>) => ({ ...i, whole: wholeOf(i.whole) }) as ScanItem),
    label: v.label as ScanLabel | null,
    multipleLabels,
    barcode: b as ScanResult["barcode"],
    suggestions: (v.suggestions as string[]).map((s) => s.trim()).filter(Boolean).slice(0, 3),
  };
}
