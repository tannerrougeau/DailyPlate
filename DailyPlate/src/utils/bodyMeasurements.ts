export type WeightUnit = "lbs" | "kg";

const CM_PER_INCH = 2.54;
const KG_PER_LB = 0.45359237;

export const HEIGHT_CM_MIN = 120;
export const HEIGHT_CM_MAX = 220;
export const WEIGHT_KG_MIN = 30;
export const WEIGHT_KG_MAX = 250;

export function feetInchesToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * CM_PER_INCH;
}

export function weightToKg(value: number, unit: WeightUnit): number {
  return unit === "lbs" ? value * KG_PER_LB : value;
}

export function kgToDisplayWeight(kg: number, unit: WeightUnit): string {
  if (unit === "kg") return String(Math.round(kg * 10) / 10);
  return String(Math.round(kg / KG_PER_LB));
}

export function parseHeightFeetInches(
  feetStr: string,
  inchesStr: string,
): { feet: number; inches: number } | null {
  if (feetStr.trim() === "") return null;
  const feet = Number(feetStr);
  const inches = inchesStr.trim() === "" ? 0 : Number(inchesStr);
  if (!Number.isFinite(feet) || !Number.isFinite(inches)) return null;
  if (feet < 0 || inches < 0 || inches > 11) return null;
  if (!Number.isInteger(feet) || !Number.isInteger(inches)) return null;
  return { feet, inches };
}

export function heightCmFromFeetInches(feetStr: string, inchesStr: string): number | null {
  const parsed = parseHeightFeetInches(feetStr, inchesStr);
  if (!parsed) return null;
  const cm = feetInchesToCm(parsed.feet, parsed.inches);
  if (cm < HEIGHT_CM_MIN || cm > HEIGHT_CM_MAX) return null;
  return Math.round(cm * 10) / 10;
}

export function weightKgFromInput(valueStr: string, unit: WeightUnit): number | null {
  if (valueStr.trim() === "") return null;
  const value = Number(valueStr);
  if (!Number.isFinite(value) || value <= 0) return null;
  const kg = weightToKg(value, unit);
  if (kg < WEIGHT_KG_MIN || kg > WEIGHT_KG_MAX) return null;
  return Math.round(kg * 10) / 10;
}

export function isValidHeightFeetInches(feetStr: string, inchesStr: string): boolean {
  return heightCmFromFeetInches(feetStr, inchesStr) !== null;
}

export function isValidWeightInput(valueStr: string, unit: WeightUnit): boolean {
  return weightKgFromInput(valueStr, unit) !== null;
}
