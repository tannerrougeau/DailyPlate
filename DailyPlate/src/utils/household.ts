/** Child portions count as this fraction of one adult serving for grocery scaling. */
const CHILD_PORTION = 0.6;

export type HouseholdPreset =
  | "single"
  | "two_adults"
  | "two_adults_one_child"
  | "two_adults_two_children"
  | "three_plus_adults"
  | "other";

export const HOUSEHOLD_OPTIONS: { id: HouseholdPreset; label: string }[] = [
  { id: "single", label: "Single person (1)" },
  { id: "two_adults", label: "2 adults" },
  { id: "two_adults_one_child", label: "2 adults + 1 child" },
  { id: "two_adults_two_children", label: "2 adults + 2 children" },
  { id: "three_plus_adults", label: "3+ adults" },
  { id: "other", label: "Other (custom number)" },
];

export function householdPortionMultiplier(
  preset: HouseholdPreset | null | undefined,
  customCount: number | null | undefined,
): number {
  switch (preset ?? "single") {
    case "single":
      return 1;
    case "two_adults":
      return 2;
    case "two_adults_one_child":
      return 2 + CHILD_PORTION;
    case "two_adults_two_children":
      return 2 + 2 * CHILD_PORTION;
    case "three_plus_adults":
      return 3;
    case "other": {
      const n = customCount;
      if (n == null || !Number.isFinite(n)) return 1;
      const rounded = Math.round(n);
      return Math.min(20, Math.max(1, rounded));
    }
    default:
      return 1;
  }
}

/** One-line label for Plan screen (e.g. "Planning for: 2 adults"). */
export function formatHouseholdPlanningLine(profile: {
  householdPreset?: HouseholdPreset | null;
  householdCustomCount?: number | null;
} | null): string {
  if (!profile) return "Planning for: 1 person";
  const preset = profile.householdPreset ?? "single";
  const custom = profile.householdCustomCount ?? null;
  switch (preset) {
    case "single":
      return "Planning for: 1 person";
    case "two_adults":
      return "Planning for: 2 adults";
    case "two_adults_one_child":
      return "Planning for: 2 adults + 1 child";
    case "two_adults_two_children":
      return "Planning for: 2 adults + 2 children";
    case "three_plus_adults":
      return "Planning for: 3+ adults";
    case "other": {
      const n = householdPortionMultiplier("other", custom);
      return n === 1 ? "Planning for: 1 person" : `Planning for: ${n} people`;
    }
    default:
      return "Planning for: 1 person";
  }
}

/** One-line label for Today / Grocery (e.g. "Cooking for: 2 adults + 2 children"). */
export function formatHouseholdCookingLine(profile: {
  householdPreset?: HouseholdPreset | null;
  householdCustomCount?: number | null;
} | null): string {
  if (!profile) return "Cooking for: Single person (1)";
  const preset = profile.householdPreset ?? "single";
  const custom = profile.householdCustomCount ?? null;
  switch (preset) {
    case "single":
      return "Cooking for: Single person (1)";
    case "two_adults":
      return "Cooking for: 2 adults";
    case "two_adults_one_child":
      return "Cooking for: 2 adults + 1 child";
    case "two_adults_two_children":
      return "Cooking for: 2 adults + 2 children";
    case "three_plus_adults":
      return "Cooking for: 3+ adults";
    case "other": {
      const n = householdPortionMultiplier("other", custom);
      return n === 1 ? "Cooking for: 1 person" : `Cooking for: ${n} people`;
    }
    default:
      return "Cooking for: Single person (1)";
  }
}
