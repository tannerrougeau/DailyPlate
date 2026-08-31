import type { HouseholdMember, HouseholdMemberKind, PersonSize } from "@/types/profile";

/** Default child plate vs a medium adult serving when no size is set. */
const DEFAULT_CHILD_SIZE: PersonSize = "small";
const DEFAULT_ADULT_SIZE: PersonSize = "medium";

const ADULT_SIZE_MULT: Record<PersonSize, number> = {
  small: 0.85,
  medium: 1,
  large: 1.2,
};

const CHILD_SIZE_MULT: Record<PersonSize, number> = {
  small: 0.45,
  medium: 0.6,
  large: 0.75,
};

export const HOUSEHOLD_ADULTS_MIN = 1;
export const HOUSEHOLD_ADULTS_MAX = 8;
export const HOUSEHOLD_CHILDREN_MIN = 0;
export const HOUSEHOLD_CHILDREN_MAX = 6;
export const HOUSEHOLD_ADULTS_DEFAULT = 2;

export type HouseholdPreset =
  | "single"
  | "two_adults"
  | "two_adults_one_child"
  | "two_adults_two_children"
  | "three_plus_adults"
  | "other";

/** @deprecated Preset UI removed; kept so legacy saves still scale correctly. */
export const HOUSEHOLD_OPTIONS: { id: HouseholdPreset; label: string }[] = [
  { id: "single", label: "Single person (1)" },
  { id: "two_adults", label: "2 adults" },
  { id: "two_adults_one_child", label: "2 adults + 1 child" },
  { id: "two_adults_two_children", label: "2 adults + 2 children" },
  { id: "three_plus_adults", label: "3+ adults" },
  { id: "other", label: "Other (custom number)" },
];

export type HouseholdProfileFields = {
  householdAdults?: number | null;
  householdChildren?: number | null;
  householdPreset?: HouseholdPreset | null;
  householdCustomCount?: number | null;
  householdMembers?: HouseholdMember[] | null;
};

export function clampAdults(n: number): number {
  if (!Number.isFinite(n)) return HOUSEHOLD_ADULTS_DEFAULT;
  return Math.min(HOUSEHOLD_ADULTS_MAX, Math.max(HOUSEHOLD_ADULTS_MIN, Math.round(n)));
}

export function clampChildren(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(HOUSEHOLD_CHILDREN_MAX, Math.max(HOUSEHOLD_CHILDREN_MIN, Math.round(n)));
}

function countsFromLegacyPreset(
  preset: HouseholdPreset | null | undefined,
  customCount: number | null | undefined,
): { adults: number; children: number } {
  switch (preset ?? "two_adults") {
    case "single":
      return { adults: 1, children: 0 };
    case "two_adults":
      return { adults: 2, children: 0 };
    case "two_adults_one_child":
      return { adults: 2, children: 1 };
    case "two_adults_two_children":
      return { adults: 2, children: 2 };
    case "three_plus_adults":
      return { adults: 3, children: 0 };
    case "other": {
      const n = customCount;
      if (n == null || !Number.isFinite(n)) return { adults: HOUSEHOLD_ADULTS_DEFAULT, children: 0 };
      return { adults: clampAdults(n), children: 0 };
    }
    default:
      return { adults: HOUSEHOLD_ADULTS_DEFAULT, children: 0 };
  }
}

/** Resolve adults/children from new fields, else migrate from a legacy preset. */
export function resolveHouseholdCounts(
  profile: HouseholdProfileFields | null | undefined,
): { adults: number; children: number } {
  if (!profile) return { adults: HOUSEHOLD_ADULTS_DEFAULT, children: 0 };
  if (profile.householdAdults != null && Number.isFinite(profile.householdAdults)) {
    return {
      adults: clampAdults(profile.householdAdults),
      children: clampChildren(profile.householdChildren ?? 0),
    };
  }
  return countsFromLegacyPreset(profile.householdPreset, profile.householdCustomCount);
}

export function defaultSizeForKind(kind: HouseholdMemberKind): PersonSize {
  return kind === "child" ? DEFAULT_CHILD_SIZE : DEFAULT_ADULT_SIZE;
}

export function portionMultiplierForMember(member: HouseholdMember): number {
  const size = member.size ?? defaultSizeForKind(member.kind);
  return member.kind === "child" ? CHILD_SIZE_MULT[size] : ADULT_SIZE_MULT[size];
}

export function defaultHouseholdMember(kind: HouseholdMemberKind): HouseholdMember {
  return { kind, size: defaultSizeForKind(kind), age: null, sex: null };
}

/** Keep members in sync with adult/child counts without dropping saved sizes. */
export function syncHouseholdMembers(
  adults: number,
  children: number,
  existing?: HouseholdMember[] | null,
): HouseholdMember[] {
  const adultN = clampAdults(adults);
  const childN = clampChildren(children);
  const prevAdults = (existing ?? []).filter((m) => m.kind === "adult");
  const prevChildren = (existing ?? []).filter((m) => m.kind === "child");
  const nextAdults = Array.from({ length: adultN }, (_, i) =>
    prevAdults[i] ? { ...prevAdults[i]!, kind: "adult" as const } : defaultHouseholdMember("adult"),
  );
  const nextChildren = Array.from({ length: childN }, (_, i) =>
    prevChildren[i]
      ? { ...prevChildren[i]!, kind: "child" as const }
      : defaultHouseholdMember("child"),
  );
  return [...nextAdults, ...nextChildren];
}

export function resolveHouseholdMembers(
  profile: HouseholdProfileFields | null | undefined,
): HouseholdMember[] {
  const { adults, children } = resolveHouseholdCounts(profile);
  return syncHouseholdMembers(adults, children, profile?.householdMembers);
}

export function householdPresetFromCounts(adults: number, children: number): HouseholdPreset {
  if (adults === 1 && children === 0) return "single";
  if (adults === 2 && children === 0) return "two_adults";
  if (adults === 2 && children === 1) return "two_adults_one_child";
  if (adults === 2 && children === 2) return "two_adults_two_children";
  if (adults >= 3 && children === 0) return "three_plus_adults";
  return "other";
}

export function householdPortionFromCounts(adults: number, children: number): number {
  return resolveHouseholdMembers({
    householdAdults: adults,
    householdChildren: children,
  }).reduce((sum, m) => sum + portionMultiplierForMember(m), 0);
}

export function householdMultiplierFor(
  profile: HouseholdProfileFields | null | undefined,
): number {
  return resolveHouseholdMembers(profile).reduce(
    (sum, m) => sum + portionMultiplierForMember(m),
    0,
  );
}

/** Legacy signature — still used by older call sites; prefers preset math. */
export function householdPortionMultiplier(
  preset: HouseholdPreset | null | undefined,
  customCount: number | null | undefined,
): number {
  const { adults, children } = countsFromLegacyPreset(preset, customCount);
  return householdPortionFromCounts(adults, children);
}

export function adultPortionMultiplier(
  profile: HouseholdProfileFields | null | undefined,
): number {
  const adults = resolveHouseholdMembers(profile).filter((m) => m.kind === "adult");
  if (adults.length === 0) return ADULT_SIZE_MULT.medium;
  const total = adults.reduce((sum, m) => sum + portionMultiplierForMember(m), 0);
  return total / adults.length;
}

export function childPortionMultiplier(
  profile: HouseholdProfileFields | null | undefined,
): number {
  const children = resolveHouseholdMembers(profile).filter((m) => m.kind === "child");
  if (children.length === 0) return CHILD_SIZE_MULT.small;
  const total = children.reduce((sum, m) => sum + portionMultiplierForMember(m), 0);
  return total / children.length;
}

function peopleLabel(adults: number, children: number): string {
  const adultPart = adults === 1 ? "1 adult" : `${adults} adults`;
  if (children <= 0) return adultPart;
  const childPart = children === 1 ? "1 child" : `${children} children`;
  return `${adultPart} + ${childPart}`;
}

export function formatHouseholdServingSplit(
  profile: HouseholdProfileFields | null | undefined,
): string {
  const { adults, children } = resolveHouseholdCounts(profile);
  if (children <= 0) {
    return adults === 1 ? "1 adult serving" : `${adults} adult servings`;
  }
  const adultPart = adults === 1 ? "1 adult serving" : `${adults} adult servings`;
  const childPart = children === 1 ? "1 smaller child serving" : `${children} smaller child servings`;
  return `${adultPart} + ${childPart}`;
}

/** One-line label for Plan screen (e.g. "Planning for: 2 adults"). */
export function formatHouseholdPlanningLine(
  profile: HouseholdProfileFields | null,
): string {
  const { adults, children } = resolveHouseholdCounts(profile);
  return `Planning for: ${peopleLabel(adults, children)}`;
}

/** One-line label for Today / Grocery (e.g. "Cooking for: 2 adults + 2 children"). */
export function formatHouseholdCookingLine(
  profile: HouseholdProfileFields | null,
): string {
  const { adults, children } = resolveHouseholdCounts(profile);
  return `Cooking for: ${peopleLabel(adults, children)}`;
}

/** Map size to a body estimate when height/weight were not collected. */
export function sizeToBodyDefaults(size: PersonSize): { heightCm: number; weightKg: number } {
  switch (size) {
    case "small":
      return { heightCm: 160, weightKg: 55 };
    case "large":
      return { heightCm: 183, weightKg: 88 };
    default:
      return { heightCm: 170, weightKg: 70 };
  }
}
