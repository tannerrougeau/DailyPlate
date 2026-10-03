import type { CheckInEntry } from "@/types/tdeeFeedback";

export const CHECK_IN_SCALE_MAX = 5;

const SCALE_KEYS = [
  "energyLevel",
  "calorieAdherence",
  "proteinAdherence",
  "sleepQuality",
  "strengthProgress",
  "mealVarietySatisfaction",
  "planEaseOfUse",
  "recipeEnjoyment",
  "hungerManagement",
] as const;

export type CheckInScaleKey = (typeof SCALE_KEYS)[number];

/** Map a stored 1–10 score onto the current 1–5 scale. */
export function convertTenPointToFive(value: number): number {
  if (!Number.isFinite(value)) return 3;
  return Math.max(1, Math.min(5, Math.round(value / 2)));
}

export function clampFivePoint(value: number): number {
  if (!Number.isFinite(value)) return 3;
  return Math.max(1, Math.min(5, Math.round(value)));
}

export function entryUsesTenPointScale(entry: CheckInEntry): boolean {
  if (entry.scaleMax === 5) return false;
  if (entry.scaleMax === 10) return true;
  return SCALE_KEYS.some((key) => (entry[key] ?? 0) > 5);
}

export function checkInScale(entry: CheckInEntry, key: CheckInScaleKey): number {
  const raw = entry[key];
  return entryUsesTenPointScale(entry) ? convertTenPointToFive(raw) : clampFivePoint(raw);
}

/** Persist older 1–10 rows as 1–5 so the adaptive model keeps the same meaning. */
export function normalizeCheckInEntry(entry: CheckInEntry): CheckInEntry {
  if (entry.scaleMax === 5) return entry;
  if (!entryUsesTenPointScale(entry)) return { ...entry, scaleMax: 5 };
  const next: CheckInEntry = { ...entry, scaleMax: 5 };
  for (const key of SCALE_KEYS) {
    next[key] = convertTenPointToFive(entry[key]);
  }
  return next;
}

export function normalizeCheckInHistory(history: CheckInEntry[]): CheckInEntry[] {
  return history.map(normalizeCheckInEntry);
}

export function isLowScore(n: number): boolean {
  return n <= 2;
}

export function isMidLowScore(n: number): boolean {
  return n <= 3;
}

export function isHighScore(n: number): boolean {
  return n >= 4;
}

export function isMaxScore(n: number): boolean {
  return n >= 5;
}
