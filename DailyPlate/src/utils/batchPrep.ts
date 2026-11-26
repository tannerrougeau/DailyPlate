import type { MealSlotId, PlannedMeal, RecipeIngredient } from "@/types";
import type { UserProfile } from "@/types/profile";
import { ingredientRole } from "@/utils/ingredientNutrition";
import {
  multiplierForRole,
  roundPortionLine,
  type PortionLine,
} from "@/utils/goalPortions";
import {
  countsFromOverride,
  householdMultiplierFor,
  householdPersonPortions,
  resolveHouseholdCounts,
  type HouseholdDayOverride,
  type PersonPortion,
} from "@/utils/household";
import {
  isPackagedRecipe,
  mealIngredients,
  dayHouseholdServings,
  mealMultipliers,
  mixedServingGrams,
  servingParts,
} from "@/utils/mealPortions";

const SLOT_ORDER: MealSlotId[] = ["breakfast", "lunch", "dinner", "snack", "snack_2", "snack_3"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** One planned day of a batch, with who's eating that day. */
export type BatchDay = {
  dateKey: string;
  meal: PlannedMeal;
  people: PersonPortion[];
  householdMult: number;
};

export type BatchPrep = {
  /** Every planned day this batch covers, cook day first. */
  days: BatchDay[];
  cookDateKey: string;
  /** This meal is a leftover day: no cooking today. */
  isLeftoverDay: boolean;
  /** People × days, e.g. 4. */
  servings: number;
  /** "Making 4 servings" */
  title: string;
  /** "You + 1 adult · 2 days (dinner tonight, lunch tomorrow)" */
  breakdown: string;
  /** Whole-batch amounts: the sum of each person's portions, rounded once. */
  lines: PortionLine[];
  /** "Your portion: about 430 g · Other adult: about 430 g" or "Pack 4 containers: …". */
  split: string;
  /** Leftover day only: "Leftovers from Monday's batch. No cooking today." */
  leftoverText: string | null;
  /** Leftover day only: that day's serving for each person. */
  leftoverServing: string | null;
};

export type BatchPrepInput = {
  meal: PlannedMeal;
  dateKey: string;
  todayKey: string;
  dailyPlans: Record<string, PlannedMeal[]>;
  profile: UserProfile | null | undefined;
  /** One-day "cooking for" override (applies to today only). */
  todayOverride?: HouseholdDayOverride | null;
};

function dayHousehold(input: BatchPrepInput, dateKey: string) {
  const counts = dateKey === input.todayKey ? countsFromOverride(input.todayOverride, input.todayKey) : null;
  return {
    people: householdPersonPortions(input.profile, counts),
    householdMult: householdMultiplierFor(input.profile, counts),
    counts: resolveHouseholdCounts(input.profile, counts),
  };
}

/** All planned meals of the same batch (or just this meal), sorted by date then slot. */
export function batchMeals(input: BatchPrepInput): { dateKey: string; meal: PlannedMeal }[] {
  const batchId = input.meal.mealPrep?.batchId;
  if (!batchId) return [{ dateKey: input.dateKey, meal: input.meal }];
  const found: { dateKey: string; meal: PlannedMeal }[] = [];
  for (const [dateKey, meals] of Object.entries(input.dailyPlans)) {
    for (const m of meals) if (m.mealPrep?.batchId === batchId) found.push({ dateKey, meal: m });
  }
  if (!found.some((f) => f.dateKey === input.dateKey && f.meal.slot === input.meal.slot)) {
    found.push({ dateKey: input.dateKey, meal: input.meal });
  }
  return found.sort((a, b) =>
    a.dateKey === b.dateKey
      ? SLOT_ORDER.indexOf(a.meal.slot) - SLOT_ORDER.indexOf(b.meal.slot)
      : a.dateKey < b.dateKey
        ? -1
        : 1,
  );
}

/**
 * Whole-batch amounts: each day's portion × that day's household, summed per ingredient before
 * rounding, so the batch equals the sum of everyone's portions. Used by the prep section and the
 * grocery list, so the two always match.
 */
export function batchLines(days: Pick<BatchDay, "meal" | "householdMult">[]): PortionLine[] {
  const totals = new Map<string, { ing: RecipeIngredient; raw: number }>();
  for (const day of days) {
    const m = mealMultipliers(day.meal);
    for (const ing of mealIngredients(day.meal)) {
      const key = `${ing.name}::${ing.unit}`;
      const raw = ing.quantity * multiplierForRole(m, ingredientRole(ing)) * dayHouseholdServings(day.meal, day.householdMult);
      const hit = totals.get(key);
      if (hit) hit.raw += raw;
      else totals.set(key, { ing, raw });
    }
  }
  return [...totals.values()].map(({ ing, raw }) => roundPortionLine(ing, raw, ingredientRole(ing)));
}

function addDays(dateKey: string, n: number): string {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function weekday(dateKey: string): string {
  return WEEKDAYS[new Date(`${dateKey}T12:00:00`).getDay()]!;
}

function slotWord(slot: MealSlotId): string {
  return slot.startsWith("snack") ? "snack" : slot;
}

/** "dinner tonight", "lunch tomorrow", "lunch Thursday". */
export function mealWhen(slot: MealSlotId, dateKey: string, todayKey: string): string {
  const word = slotWord(slot);
  if (dateKey === todayKey) return word === "dinner" ? "dinner tonight" : `${word} today`;
  if (dateKey === addDays(todayKey, 1)) return `${word} tomorrow`;
  return `${word} ${weekday(dateKey)}`;
}

/** "Monday's", "yesterday's", "today's". */
function dayPossessive(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) return "today's";
  if (dateKey === addDays(todayKey, -1)) return "yesterday's";
  return `${weekday(dateKey)}'s`;
}

/** "You", "You + 1 adult", "You + 1 adult + 2 children". */
export function peopleText(adults: number, children: number): string {
  const parts = ["You"];
  const others = Math.max(0, adults - 1);
  if (others > 0) parts.push(others === 1 ? "1 adult" : `${others} adults`);
  if (children > 0) parts.push(children === 1 ? "1 child" : `${children} children`);
  return parts.join(" + ");
}

/** "you", "other adult" (one) or "adult 2", "child 1". */
function personName(p: PersonPortion, people: PersonPortion[]): string {
  if (p.kind === "adult" && p.index === 1) return "you";
  if (p.kind === "adult") return people.filter((x) => x.kind === "adult").length === 2 ? "other adult" : `adult ${p.index}`;
  return people.filter((x) => x.kind === "child").length === 1 ? "child" : `child ${p.index}`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const about = (g: number) => `about ${Math.round(g / 10) * 10} g`;

/** One person's serving on one day: "about 430 g" or "Turkey 120 g cooked · Rice 150 g cooked". */
function personServing(meal: PlannedMeal, multiplier: number): string {
  const grams = mixedServingGrams(meal);
  if (grams != null) return about(grams * multiplier);
  return servingParts(meal, multiplier).join(", ");
}

const isYou = (p: PersonPortion) => p.kind === "adult" && p.index === 1;

/** "Size today" shrinks only your serving; everyone else keeps their normal amount. */
function personMultiplier(meal: PlannedMeal, p: PersonPortion): number {
  return !isYou(p) && meal.daySize ? p.multiplier / meal.daySize : p.multiplier;
}

function splitText(days: BatchDay[]): string {
  if (days.length === 1) {
    const d = days[0]!;
    return d.people
      .map((p) => `${isYou(p) ? "Your portion" : cap(personName(p, d.people))}: ${personServing(d.meal, personMultiplier(d.meal, p))}`)
      .join(" · ");
  }
  // Several days: one container per person per day, grouped when the amount is the same.
  const groups = new Map<string, { count: number; serving: string; who: string }>();
  for (const d of days) {
    for (const p of d.people) {
      const who = personName(p, d.people);
      const serving = personServing(d.meal, personMultiplier(d.meal, p));
      const key = `${who}::${serving}`;
      const g = groups.get(key);
      if (g) g.count += 1;
      else groups.set(key, { count: 1, serving, who });
    }
  }
  const total = [...groups.values()].reduce((a, g) => a + g.count, 0);
  const parts = [...groups.values()].map((g) =>
    /^about \d/.test(g.serving) ? `${g.count} at ${g.serving} (${g.who})` : `${g.count} for ${g.who}: ${g.serving}`,
  );
  const sep = [...groups.values()].every((g) => /^about \d/.test(g.serving)) ? ", " : "; ";
  return `Pack ${total} containers: ${parts.join(sep)}`;
}

/** What the prep section makes: servings, breakdown, batch amounts, the split, or a leftover note. */
export function batchPrepFor(input: BatchPrepInput): BatchPrep | null {
  if (isPackagedRecipe(input.meal.recipe)) return null;
  const days: BatchDay[] = batchMeals(input).map(({ dateKey, meal }) => {
    const h = dayHousehold(input, dateKey);
    return { dateKey, meal, people: h.people, householdMult: h.householdMult };
  });
  const cook = days[0]!;
  const cookCounts = dayHousehold(input, cook.dateKey).counts;
  const servings = days.reduce((a, d) => a + d.people.length, 0);
  const when = days.map((d) => mealWhen(d.meal.slot, d.dateKey, input.todayKey));
  const people = peopleText(cookCounts.adults, cookCounts.children);
  const breakdown =
    days.length > 1 ? `${people} · ${days.length} days (${when.join(", ")})` : `${people} · ${when[0]}`;
  const isLeftoverDay = days.length > 1 && !(cook.dateKey === input.dateKey && cook.meal.slot === input.meal.slot);
  const today = days.find((d) => d.dateKey === input.dateKey && d.meal.slot === input.meal.slot) ?? cook;
  return {
    days,
    cookDateKey: cook.dateKey,
    isLeftoverDay,
    servings,
    title: `Making ${servings} ${servings === 1 ? "serving" : "servings"}`,
    breakdown,
    lines: batchLines(days),
    split: splitText(days),
    leftoverText: isLeftoverDay
      ? `Leftovers from ${dayPossessive(cook.dateKey, input.todayKey)} batch. No cooking today.`
      : null,
    leftoverServing: isLeftoverDay ? splitText([today]) : null,
  };
}
