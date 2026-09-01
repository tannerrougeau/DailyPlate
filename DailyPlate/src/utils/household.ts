import type { BiologicalSex, HouseholdMember, HouseholdMemberKind, PersonSize } from "@/types/profile";

/** Child plate as a fraction of the owner's adult serving when the child has no extra details. */
const CHILD_FRACTION_OF_ADULT = 0.45;

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

export type HouseholdDayCounts = { adults: number; children: number };

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
  age?: number | null;
  sex?: BiologicalSex | null;
  heightCm?: number | null;
  weightKg?: number | null;
};

export type HouseholdDayOverride = {
  dateKey: string;
  adults: number;
  children: number;
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
  countsOverride?: HouseholdDayCounts | null,
): { adults: number; children: number } {
  if (countsOverride) {
    return {
      adults: clampAdults(countsOverride.adults),
      children: clampChildren(countsOverride.children),
    };
  }
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
  return kind === "child" ? "small" : "medium";
}

export function memberHasExtraDetails(member: HouseholdMember | null | undefined): boolean {
  if (!member) return false;
  return member.size != null || member.age != null || member.sex != null;
}

function sizeFromAge(kind: HouseholdMemberKind, age: number | null | undefined): PersonSize | null {
  if (age == null || !Number.isFinite(age)) return null;
  if (kind === "child") {
    if (age < 7) return "small";
    if (age < 12) return "medium";
    return "large";
  }
  if (age < 16) return "small";
  return null;
}

/** Profile owner's adult plate. Other adults copy this unless they have extra details. */
export function ownerAdultSizeFromProfile(
  profile: HouseholdProfileFields | null | undefined,
): PersonSize {
  const owner = (profile?.householdMembers ?? []).find((m) => m.kind === "adult");
  if (owner?.size) return owner.size;
  const kg = profile?.weightKg;
  if (kg != null && Number.isFinite(kg)) {
    if (kg < 58) return "small";
    if (kg > 85) return "large";
  }
  const cm = profile?.heightCm;
  if (cm != null && Number.isFinite(cm)) {
    if (cm < 163) return "small";
    if (cm > 180) return "large";
  }
  return "medium";
}

export function ownerAdultMultiplier(
  profile: HouseholdProfileFields | null | undefined,
): number {
  return ADULT_SIZE_MULT[ownerAdultSizeFromProfile(profile)];
}

export function portionMultiplierForMember(
  member: HouseholdMember,
  ctx: { ownerMult: number; isOwner: boolean } = { ownerMult: 1, isOwner: false },
): number {
  if (member.kind === "adult") {
    if (ctx.isOwner) return ctx.ownerMult;
    if (memberHasExtraDetails(member)) {
      const size =
        member.size ?? sizeFromAge("adult", member.age) ?? defaultSizeForKind("adult");
      return ADULT_SIZE_MULT[size];
    }
    return ctx.ownerMult;
  }
  if (memberHasExtraDetails(member)) {
    const size =
      member.size ?? sizeFromAge("child", member.age) ?? defaultSizeForKind("child");
    return CHILD_SIZE_MULT[size];
  }
  return ctx.ownerMult * CHILD_FRACTION_OF_ADULT;
}

export function defaultHouseholdMember(kind: HouseholdMemberKind): HouseholdMember {
  return { kind, size: null, age: null, sex: null };
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
  countsOverride?: HouseholdDayCounts | null,
): HouseholdMember[] {
  const { adults, children } = resolveHouseholdCounts(profile, countsOverride);
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
  const ownerMult = ADULT_SIZE_MULT.medium;
  return resolveHouseholdMembers({
    householdAdults: adults,
    householdChildren: children,
  }).reduce((sum, m, i) => {
    return (
      sum +
      portionMultiplierForMember(m, { ownerMult, isOwner: m.kind === "adult" && i === 0 })
    );
  }, 0);
}

export function householdMultiplierFor(
  profile: HouseholdProfileFields | null | undefined,
  countsOverride?: HouseholdDayCounts | null,
): number {
  const members = resolveHouseholdMembers(profile, countsOverride);
  const ownerMult = ownerAdultMultiplier(profile);
  let adultIndex = 0;
  return members.reduce((sum, m) => {
    const isOwner = m.kind === "adult" && adultIndex === 0;
    if (m.kind === "adult") adultIndex += 1;
    return sum + portionMultiplierForMember(m, { ownerMult, isOwner });
  }, 0);
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
  _countsOverride?: HouseholdDayCounts | null,
): number {
  return ownerAdultMultiplier(profile);
}

export function childPortionMultiplier(
  profile: HouseholdProfileFields | null | undefined,
  countsOverride?: HouseholdDayCounts | null,
): number {
  const children = resolveHouseholdMembers(profile, countsOverride).filter(
    (m) => m.kind === "child",
  );
  const ownerMult = ownerAdultMultiplier(profile);
  if (children.length === 0) return ownerMult * CHILD_FRACTION_OF_ADULT;
  const total = children.reduce(
    (sum, m) => sum + portionMultiplierForMember(m, { ownerMult, isOwner: false }),
    0,
  );
  return total / children.length;
}

export function countsFromOverride(
  override: HouseholdDayOverride | null | undefined,
  todayDateKey: string,
): HouseholdDayCounts | null {
  if (!override || override.dateKey !== todayDateKey) return null;
  return { adults: override.adults, children: override.children };
}

function peopleLabel(adults: number, children: number): string {
  const adultPart = adults === 1 ? "1 adult" : `${adults} adults`;
  if (children <= 0) return adultPart;
  const childPart = children === 1 ? "1 child" : `${children} children`;
  return `${adultPart}, ${childPart}`;
}

export interface PersonPortion {
  kind: HouseholdMemberKind;
  index: number;
  label: string;
  multiplier: number;
}

export function householdPersonPortions(
  profile: HouseholdProfileFields | null | undefined,
  countsOverride?: HouseholdDayCounts | null,
): PersonPortion[] {
  const members = resolveHouseholdMembers(profile, countsOverride);
  const ownerMult = ownerAdultMultiplier(profile);
  let adultIndex = 0;
  let childIndex = 0;
  return members.map((m) => {
    const isOwner = m.kind === "adult" && adultIndex === 0;
    if (m.kind === "adult") adultIndex += 1;
    else childIndex += 1;
    const index = m.kind === "adult" ? adultIndex : childIndex;
    return {
      kind: m.kind,
      index,
      label: m.kind === "adult" ? `Adult ${index}` : `Child ${index}`,
      multiplier: portionMultiplierForMember(m, { ownerMult, isOwner }),
    };
  });
}

/** Collapse identical adult/child multipliers into a single Adult / Child row. */
export function collapsedPersonPortions(
  profile: HouseholdProfileFields | null | undefined,
  countsOverride?: HouseholdDayCounts | null,
): PersonPortion[] {
  const people = householdPersonPortions(profile, countsOverride);
  const out: PersonPortion[] = [];
  for (const kind of ["adult", "child"] as const) {
    const group = people.filter((p) => p.kind === kind);
    if (group.length === 0) continue;
    const same = group.every((p) => Math.abs(p.multiplier - group[0]!.multiplier) < 0.01);
    if (same) {
      out.push({
        kind,
        index: 1,
        label: kind === "adult" ? "Adult" : "Child",
        multiplier: group[0]!.multiplier,
      });
    } else {
      out.push(...group);
    }
  }
  return out;
}

export function formatHouseholdServingSplit(
  profile: HouseholdProfileFields | null | undefined,
  countsOverride?: HouseholdDayCounts | null,
): string {
  const { adults, children } = resolveHouseholdCounts(profile, countsOverride);
  if (children <= 0) {
    return adults === 1 ? "1 adult serving" : `${adults} adult servings`;
  }
  const adultPart = adults === 1 ? "1 adult serving" : `${adults} adult servings`;
  const childPart =
    children === 1 ? "1 smaller child serving" : `${children} smaller child servings`;
  return `${adultPart} + ${childPart}`;
}

/** One-line label for Plan screen (e.g. "Planning for 2 adults"). */
export function formatHouseholdPlanningLine(
  profile: HouseholdProfileFields | null,
  countsOverride?: HouseholdDayCounts | null,
): string {
  const { adults, children } = resolveHouseholdCounts(profile, countsOverride);
  return `Planning for ${peopleLabel(adults, children)}`;
}

/** One-line label for Today / Grocery (e.g. "Cooking for 2 adults, 1 child"). */
export function formatHouseholdCookingLine(
  profile: HouseholdProfileFields | null,
  countsOverride?: HouseholdDayCounts | null,
): string {
  const { adults, children } = resolveHouseholdCounts(profile, countsOverride);
  return `Cooking for ${peopleLabel(adults, children)}`;
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
