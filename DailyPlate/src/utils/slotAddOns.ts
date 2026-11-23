import type { RecipeIngredient } from "@/types";

/** A protein add-on that can go with a meal. Ordered by preference; avoided foods are skipped. */
export type AddOnOption = { label: string; item: RecipeIngredient; protein: number };
export const ADD_ON_OPTIONS: AddOnOption[] = [
  { label: "a Greek yogurt", item: { name: "Plain Greek yogurt cup (5.3 oz)", quantity: 1, unit: "each", category: "Dairy" }, protein: 15 },
  { label: "a cottage cheese cup", item: { name: "Cottage cheese cup (4 oz)", quantity: 1, unit: "each", category: "Dairy" }, protein: 12 },
  { label: "2 eggs", item: { name: "Eggs", quantity: 2, unit: "large", category: "Dairy" }, protein: 12 },
  { label: "a protein shake", item: { name: "RTD protein shake (11.5 fl oz)", quantity: 1, unit: "bottle", category: "Dairy" }, protein: 30 },
];
export const ADD_ON_NAMES = new Set(ADD_ON_OPTIONS.map((o) => o.item.name));

/** Add-ons for the meal's slot, replacing any earlier add-on (so Undo takes it back out). */
export function withSlotAddOns(sides: RecipeIngredient[] | undefined, addOns: RecipeIngredient[] | undefined): RecipeIngredient[] | undefined {
  const base = (sides ?? []).filter((s) => !ADD_ON_NAMES.has(s.name));
  const next = [...base, ...(addOns ?? [])];
  return next.length > 0 ? next : undefined;
}
