import type {
  BiologicalSex,
  ChildAgeBand,
  HouseholdMember,
  HouseholdMemberKind,
  OtherAdultSize,
  UserProfile,
} from "@/types/profile";
import { computeDailyTargets, computeFormulaTdee } from "@/utils/tdee";
import { DISLIKED_FOOD_CHIPS } from "@/utils/chipMatching";

const OTHER_ADULT_FACTOR: Record<OtherAdultSize, number> = {
  smaller: 0.8,
  similar: 1,
  larger: 1.25,
};

const CHILD_AGE_FACTOR: Record<ChildAgeBand, number> = {
  "1_3": 0.4,
  "4_8": 0.6,
  "9_13": 0.8,
  "14_18": 1,
};

export const OTHER_ADULT_SIZE_OPTIONS: { id: OtherAdultSize; label: string }[] = [
  { id: "smaller", label: "Smaller" },
  { id: "similar", label: "Similar to me" },
  { id: "larger", label: "Larger" },
];

export const CHILD_AGE_BAND_OPTIONS: { id: ChildAgeBand; label: string }[] = [
  { id: "1_3", label: "1–3" },
  { id: "4_8", label: "4–8" },
  { id: "9_13", label: "9–13" },
  { id: "14_18", label: "14–18" },
];

export const DEFAULT_OTHER_ADULT_SIZE: OtherAdultSize = "similar";
export const DEFAULT_CHILD_AGE_BAND: ChildAgeBand = "4_8";

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
  householdFoodAvoidChips?: string[] | null;
  householdFoodAvoidCustom?: string | null;
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

export function resolveOtherAdultSize(member: HouseholdMember | null | undefined): OtherAdultSize {
  return member?.adultSize ?? DEFAULT_OTHER_ADULT_SIZE;
}

export function resolveChildAgeBand(member: HouseholdMember | null | undefined): ChildAgeBand {
  return member?.childAgeBand ?? DEFAULT_CHILD_AGE_BAND;
}

export function childAgeBandLabel(band: ChildAgeBand): string {
  return CHILD_AGE_BAND_OPTIONS.find((o) => o.id === band)?.label ?? "4–8";
}

function adultSizeFromLegacy(member: HouseholdMember): OtherAdultSize | null {
  if (member.adultSize) return member.adultSize;
  if (member.size === "small") return "smaller";
  if (member.size === "large") return "larger";
  if (member.size === "medium") return "similar";
  return null;
}

function childAgeBandFromLegacy(member: HouseholdMember): ChildAgeBand | null {
  if (member.childAgeBand) return member.childAgeBand;
  const age = member.age;
  if (age != null && Number.isFinite(age)) {
    if (age <= 3) return "1_3";
    if (age <= 8) return "4_8";
    if (age <= 13) return "9_13";
    return "14_18";
  }
  if (member.size === "small") return "1_3";
  if (member.size === "large") return "9_13";
  return null;
}

/** Drop sex/size/age after mapping onto the new fields. */
export function migrateHouseholdMember(member: HouseholdMember): HouseholdMember {
  if (member.kind === "child") {
    return { kind: "child", childAgeBand: childAgeBandFromLegacy(member) };
  }
  return { kind: "adult", adultSize: adultSizeFromLegacy(member) };
}

export function migrateHouseholdMembers(members: HouseholdMember[] | null | undefined): HouseholdMember[] {
  return (members ?? []).map(migrateHouseholdMember);
}

/** Maintenance TDEE ÷ goal-adjusted target. Other people scale from maintenance, not the user's cut/surplus. */
export function maintenanceToTargetRatio(
  profile: HouseholdProfileFields | null | undefined,
): number {
  if (
    !profile ||
    profile.age == null ||
    !Number.isFinite(profile.age) ||
    profile.heightCm == null ||
    !Number.isFinite(profile.heightCm) ||
    profile.weightKg == null ||
    !Number.isFinite(profile.weightKg)
  ) {
    return 1;
  }
  const asProfile = profile as UserProfile;
  if (!asProfile.goal) return 1;
  const userKcal = computeDailyTargets(asProfile).calories;
  const baseKcal =
    asProfile.knownTdeeKcal != null && asProfile.knownTdeeKcal > 0
      ? asProfile.knownTdeeKcal
      : computeFormulaTdee(asProfile);
  if (!(userKcal > 0) || !(baseKcal > 0)) return 1;
  return baseKcal / userKcal;
}

/** User plate is always 1 of their own target-sized meal. */
export function ownerAdultMultiplier(
  _profile?: HouseholdProfileFields | null,
): number {
  return 1;
}

export function portionMultiplierForMember(
  member: HouseholdMember,
  ctx: { baseRatio: number; isOwner: boolean } = { baseRatio: 1, isOwner: false },
): number {
  if (member.kind === "adult") {
    if (ctx.isOwner) return 1;
    return OTHER_ADULT_FACTOR[resolveOtherAdultSize(member)] * ctx.baseRatio;
  }
  return CHILD_AGE_FACTOR[resolveChildAgeBand(member)] * ctx.baseRatio;
}

export function defaultHouseholdMember(kind: HouseholdMemberKind): HouseholdMember {
  return kind === "child"
    ? { kind: "child", childAgeBand: null }
    : { kind: "adult", adultSize: null };
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
    prevAdults[i]
      ? migrateHouseholdMember({ ...prevAdults[i]!, kind: "adult" })
      : defaultHouseholdMember("adult"),
  );
  const nextChildren = Array.from({ length: childN }, (_, i) =>
    prevChildren[i]
      ? migrateHouseholdMember({ ...prevChildren[i]!, kind: "child" })
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
  return resolveHouseholdMembers({
    householdAdults: adults,
    householdChildren: children,
  }).reduce((sum, m, i) => {
    return (
      sum +
      portionMultiplierForMember(m, { baseRatio: 1, isOwner: m.kind === "adult" && i === 0 })
    );
  }, 0);
}

export function householdMultiplierFor(
  profile: HouseholdProfileFields | null | undefined,
  countsOverride?: HouseholdDayCounts | null,
): number {
  const { adults, children } = resolveHouseholdCounts(profile, countsOverride);
  if (adults <= 1 && children <= 0) return 1;
  const members = resolveHouseholdMembers(profile, countsOverride);
  const baseRatio = maintenanceToTargetRatio(profile);
  let adultIndex = 0;
  return members.reduce((sum, m) => {
    const isOwner = m.kind === "adult" && adultIndex === 0;
    if (m.kind === "adult") adultIndex += 1;
    return sum + portionMultiplierForMember(m, { baseRatio, isOwner });
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
  const baseRatio = maintenanceToTargetRatio(profile);
  if (children.length === 0) return CHILD_AGE_FACTOR[DEFAULT_CHILD_AGE_BAND] * baseRatio;
  const total = children.reduce(
    (sum, m) => sum + portionMultiplierForMember(m, { baseRatio, isOwner: false }),
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
  const baseRatio = maintenanceToTargetRatio(profile);
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
      multiplier: portionMultiplierForMember(m, { baseRatio, isOwner }),
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
  return formatHouseholdServesLine(profile, countsOverride) ?? "Serves you";
}

/** Meal-card line, e.g. "Serves you + 1 adult + 1 child". Null when cooking only for the user. */
export function formatHouseholdServesLine(
  profile: HouseholdProfileFields | null | undefined,
  countsOverride?: HouseholdDayCounts | null,
): string | null {
  const { adults, children } = resolveHouseholdCounts(profile, countsOverride);
  if (adults <= 1 && children <= 0) return null;
  const extras: string[] = [];
  const otherAdults = Math.max(0, adults - 1);
  if (otherAdults === 1) extras.push("1 adult");
  else if (otherAdults > 1) extras.push(`${otherAdults} adults`);
  if (children === 1) extras.push("1 child");
  else if (children > 1) extras.push(`${children} children`);
  if (extras.length === 0) return null;
  return `Serves you + ${extras.join(" + ")}`;
}

export function householdCardSummary(
  profile: HouseholdProfileFields | null | undefined,
  extra?: { avoidChips?: string[]; avoidCustom?: string },
): string {
  const { adults, children } = resolveHouseholdCounts(profile);
  const members = resolveHouseholdMembers(profile);
  const parts: string[] = [];
  parts.push(adults === 1 ? "1 adult" : `${adults} adults`);
  if (children > 0) {
    const bands = members
      .filter((m) => m.kind === "child")
      .map((m) => childAgeBandLabel(resolveChildAgeBand(m)));
    const unique = [...new Set(bands)];
    const childWord = children === 1 ? "1 child" : `${children} children`;
    parts.push(unique.length === 1 ? `${childWord} (${unique[0]})` : childWord);
  }
  const chips = extra?.avoidChips ?? profile?.householdFoodAvoidChips ?? [];
  const custom = extra?.avoidCustom ?? profile?.householdFoodAvoidCustom ?? "";
  const avoidLabels = [
    ...chips
      .filter((id) => id !== "none")
      .map((id) => DISLIKED_FOOD_CHIPS.find((c) => c.id === id)?.label ?? id),
    ...custom.split(",").map((s) => s.trim()).filter(Boolean),
  ];
  if (avoidLabels.length) parts.push(`avoids ${avoidLabels.slice(0, 2).join(", ").toLowerCase()}`);
  return parts.join(" · ");
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
export function formatHouseholdChip(
  profile: UserProfile | null | undefined,
  countsOverride?: HouseholdDayCounts | null,
): string {
  const { adults, children } = resolveHouseholdCounts(profile, countsOverride);
  const adultPart = adults === 1 ? "1 adult" : `${adults} adults`;
  if (children <= 0) return adultPart;
  const childPart = children === 1 ? "1 child" : `${children} children`;
  return `${adultPart} · ${childPart}`;
}

export function formatHouseholdCookingLine(
  profile: HouseholdProfileFields | null,
  countsOverride?: HouseholdDayCounts | null,
): string {
  const { adults, children } = resolveHouseholdCounts(profile, countsOverride);
  return `Cooking for ${peopleLabel(adults, children)}`;
}

