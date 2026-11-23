import type { Recipe } from "@/types";
import type { UserProfile } from "@/types/profile";
import type { CheckInEntry } from "@/types/tdeeFeedback";
import { logPlanPatterns, type PersonalizationSignals } from "@/utils/personalizationEngine";
import { checkInScale } from "@/utils/checkInScale";
import type { CheckpointState, DisplayPrefs, PlanSettings } from "@/utils/displayPrefs";
import { firstIngredientOption, ingredientRole } from "@/utils/ingredientNutrition";

export const ASK_SPACING_DAYS = 3;
export const NO_SNOOZE_DAYS = 30;
export const MAX_ON_OPEN = 1;
export const MAX_IN_CHECK_IN = 2;
const DAY_MS = 24 * 60 * 60 * 1000;

export type QuestionChange =
  | { kind: "display"; set: Partial<DisplayPrefs> }
  | { kind: "avoid"; ingredient: string }
  | { kind: "variety" }
  | { kind: "shorterBatches"; days: number }
  | { kind: "planSettings"; set: PlanSettings; what: string };

export type Question = {
  /** Stable id: the same question is never queued twice. */
  id: string;
  text: string;
  /** Saved with the checkpoint when answered Yes. */
  why: string;
  source: "usage" | "check-in" | "taste";
  change: QuestionChange;
  addedAt: string;
};

export type QuestionAnswer = "yes" | "not_now" | "no";
export type QuestionLogEntry = { lastAskedAt?: string; answer?: QuestionAnswer; snoozeUntil?: string };
export type QuestionLog = Record<string, QuestionLogEntry>;

export type UsageEvent = { kind: "details" | "adjust" | "cards"; at: string; n?: number };

const daysBetween = (a: string, b: Date) => (b.getTime() - new Date(a).getTime()) / DAY_MS;

/** On app open: only if no question was asked in the last 3 days. */
export function canAskOnOpen(lastAskedAt: string | null | undefined, now: Date): boolean {
  return !lastAskedAt || daysBetween(lastAskedAt, now) >= ASK_SPACING_DAYS;
}

function blocked(log: QuestionLog, id: string, now: Date): boolean {
  const entry = log[id];
  if (!entry) return false;
  if (entry.answer === "yes") return true;
  return entry.snoozeUntil != null && new Date(entry.snoozeUntil).getTime() > now.getTime();
}

/** Add a question unless it's already queued, was answered Yes, or was told No in the last 30 days. */
export function enqueue(queue: Question[], log: QuestionLog, q: Question, now: Date): Question[] {
  if (queue.some((x) => x.id === q.id) || blocked(log, q.id, now)) return queue;
  return [...queue, q];
}

/** Changes the plan (what gets generated) rather than only the display. */
export function isPlanChange(q: Question): boolean {
  return q.change.kind !== "display";
}

/**
 * Questions to show now, at most `max`. With `planFirst` (end of a check-in), plan-change questions
 * come before display ones; the rest stay queued.
 */
export function nextQuestions(
  queue: Question[],
  log: QuestionLog,
  now: Date,
  max: number,
  opts: { planFirst?: boolean } = {},
): Question[] {
  const open = queue.filter((q) => !blocked(log, q.id, now));
  const ordered = opts.planFirst
    ? [...open.filter(isPlanChange), ...open.filter((q) => !isPlanChange(q))]
    : open;
  return ordered.slice(0, max);
}

/** The two plan changes, shared by check-in and meal-log questions (same id = asked once). */
function minimalPrepChange(): QuestionChange {
  return { kind: "planSettings", set: { prioritizeMinimalPrep: true }, what: "Quick, minimal-prep meals first" };
}

function weeklyMealPrepChange(profile: UserProfile | null): QuestionChange {
  return {
    kind: "planSettings",
    set: {
      weeklyMealPrepEnabled: true,
      weeklyMealPrepSlot: profile?.weeklyMealPrepSlot ?? "dinner",
      weeklyMealPrepRepeatCount: profile?.weeklyMealPrepRepeatCount ?? 3,
    },
    what: "Weekly meal prep turned on",
  };
}

/**
 * Meal-log patterns that used to change settings automatically; now asked when Today opens
 * (normal 3-day schedule). Not asked when the setting is already on.
 */
export function logPlanQuestions(
  profile: UserProfile | null,
  signals: PersonalizationSignals,
  now: Date,
): Question[] {
  if (!profile) return [];
  const at = now.toISOString();
  const { skipsLongPrep, eatsBatchMeals } = logPlanPatterns(profile, signals);
  const out: Question[] = [];
  if (skipsLongPrep) {
    out.push({
      id: "plan:minimal-prep",
      text: "You've been skipping longer recipes. Want quicker, minimal-prep meals?",
      why: "Several longer recipes were skipped recently.",
      source: "usage",
      change: minimalPrepChange(),
      addedAt: at,
    });
  }
  if (eatsBatchMeals) {
    out.push({
      id: "plan:weekly-meal-prep",
      text: "You've been eating a lot of batch-friendly meals. Want to batch-cook one meal for a few days?",
      why: "You've eaten several batch-friendly meals recently.",
      source: "usage",
      change: weeklyMealPrepChange(profile),
      addedAt: at,
    });
  }
  return out;
}

/**
 * Plan changes a low (1–2 of 5) check-in answer used to make automatically. Now they're asked.
 */
export function checkInPlanQuestions(entry: CheckInEntry, profile: UserProfile | null, now: Date): Question[] {
  const at = now.toISOString();
  const out: Question[] = [];
  const protein = checkInScale(entry, "proteinAdherence");
  const ease = checkInScale(entry, "planEaseOfUse");
  const enjoyment = checkInScale(entry, "recipeEnjoyment");
  if (protein <= 2 && !profile?.prioritizeMinProtein) {
    out.push({
      id: "plan:protein-first",
      text: "Want plans to put protein first?",
      why: "Your check-in said hitting protein was hard.",
      source: "check-in",
      change: { kind: "planSettings", set: { prioritizeMinProtein: true }, what: "Plans put protein first" },
      addedAt: at,
    });
  }
  if (ease <= 2 && !profile?.weeklyMealPrepEnabled) {
    out.push({
      id: "plan:weekly-meal-prep",
      text: "Want to batch-cook one meal for a few days?",
      why: "Your check-in said following the plan felt hard.",
      source: "check-in",
      change: weeklyMealPrepChange(profile),
      addedAt: at,
    });
  }
  if (enjoyment <= 2 && ease <= 2 && !profile?.prioritizeMinimalPrep) {
    out.push({
      id: "plan:minimal-prep",
      text: "Want quicker, minimal-prep meals?",
      why: "Your check-in said meals weren't hitting the mark and the plan felt hard.",
      source: "check-in",
      change: minimalPrepChange(),
      addedAt: at,
    });
  }
  return out;
}

/** Record an answer. "No" blocks the question for 30 days; "Not now" keeps it queued. */
export function recordAnswer(
  queue: Question[],
  log: QuestionLog,
  id: string,
  answer: QuestionAnswer,
  now: Date,
): { queue: Question[]; log: QuestionLog } {
  const entry: QuestionLogEntry = { lastAskedAt: now.toISOString(), answer };
  if (answer === "no") entry.snoozeUntil = new Date(now.getTime() + NO_SNOOZE_DAYS * DAY_MS).toISOString();
  return {
    queue: answer === "not_now" ? queue : queue.filter((q) => q.id !== id),
    log: { ...log, [id]: entry },
  };
}

// ---------- Sources ----------

function recent(events: UsageEvent[], kind: UsageEvent["kind"], now: Date, days = 14): number {
  return events
    .filter((e) => e.kind === kind && daysBetween(e.at, now) <= days)
    .reduce((s, e) => s + (e.n ?? 1), 0);
}

const SHOW_MACROS: Question["change"] = { kind: "display", set: { cardMacros: true, cardFiber: true, progressMacros: true } };
const SIMPLER_CARD: Question["change"] = {
  kind: "display",
  set: { cardMacros: false, cardFiber: false, progressMacros: false },
};

export function usageQuestions(
  events: UsageEvent[],
  prefs: DisplayPrefs,
  onboardedAt: string | null | undefined,
  now: Date,
): Question[] {
  const at = now.toISOString();
  const out: Question[] = [];
  const details = recent(events, "details", now);
  const adjust = recent(events, "adjust", now);
  const cards = recent(events, "cards", now);
  if (!prefs.cardMacros && (details >= 5 || adjust >= 3)) {
    out.push({
      id: "show-macros",
      text: "Want carbs, fat and fiber shown on your meal cards?",
      why: "You often open nutrition details or adjust servings.",
      source: "usage",
      change: SHOW_MACROS,
      addedAt: at,
    });
  }
  const settled = !onboardedAt || daysBetween(onboardedAt, now) >= 14;
  if (prefs.cardMacros && settled && cards >= 20 && details <= 1) {
    out.push({
      id: "simpler-card",
      text: "Want a simpler meal card?",
      why: "You rarely open nutrition details.",
      source: "usage",
      change: SIMPLER_CARD,
      addedAt: at,
    });
  }
  return out;
}

/** Batches longer than 2 days in the plan (weekly meal prep or planned leftovers). */
export function usesLongBatches(profile: UserProfile | null): boolean {
  if (!profile) return false;
  const prep = profile.weeklyMealPrepEnabled === true && (profile.weeklyMealPrepRepeatCount ?? 3) > 2;
  const leftovers = profile.lowComplexityEnabled === true && (profile.maxLeftoverStreakDays ?? 2) > 2;
  return prep || leftovers;
}

export function checkInQuestions(
  entry: CheckInEntry,
  prefs: DisplayPrefs,
  profile: UserProfile | null,
  now: Date,
  /** The plan has batches longer than 2 days (passed separately so plans with batches in progress count). */
  hasLongBatches = usesLongBatches(profile),
): Question[] {
  const at = now.toISOString();
  const out: Question[] = [];
  if (checkInScale(entry, "planEaseOfUse") <= 2 && prefs.cardMacros) {
    out.push({
      id: "simpler-card",
      text: "Want a simpler meal card?",
      why: "Your check-in said the plan felt hard to use.",
      source: "check-in",
      change: SIMPLER_CARD,
      addedAt: at,
    });
  }
  if (checkInScale(entry, "mealVarietySatisfaction") <= 2 && profile?.ingredientVariety !== "varied") {
    out.push({
      id: "more-variety",
      text: "Want more variety in your plans?",
      why: "Your check-in said meals felt repetitive.",
      source: "check-in",
      change: { kind: "variety" },
      addedAt: at,
    });
  }
  // Batches are never shortened automatically; ask instead.
  if (checkInScale(entry, "mealVarietySatisfaction") <= 2 && hasLongBatches) {
    out.push({
      id: "shorter-batches",
      text: "Want shorter batches? (e.g., 2 days instead of 4)",
      why: "Your check-in said meals felt repetitive, and your plan uses batch cooking.",
      source: "check-in",
      change: { kind: "shorterBatches", days: 2 },
      addedAt: at,
    });
  }
  return out;
}

const STAPLES = /\b(oil|butter|salt|pepper|water|ice|broth|vinegar|sauce|seasoning|spice|sugar|honey|garlic|lemon|lime)\b/i;

/** Main ingredient words of a recipe: protein, vegetable and fat items, minus staples, singular. */
export function ingredientKeys(recipe: Pick<Recipe, "ingredients">): string[] {
  const keys = new Set<string>();
  for (const ing of recipe.ingredients) {
    const role = ingredientRole(ing);
    if (role === "flavor" || role === "carb" || STAPLES.test(ing.name)) continue;
    const word = firstIngredientOption(ing.name)
      .replace(/\([^)]*\)/g, " ")
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !/^(fresh|sliced|diced|chopped|lean|ground|plain|low|fat|shredded|cooked|raw|large|medium|small|baby|optional|cherry|red|green|yellow|crumbled|halved|pitted|steamed)$/.test(w))
      .pop();
    if (word) keys.add(word.replace(/(oes)$/, "o").replace(/(ies)$/, "y").replace(/s$/, ""));
  }
  return [...keys];
}

/**
 * Passing on 3 meals that share an ingredient within 30 days → "Leave mushrooms out of your plans?"
 * `passes` are skipped or swapped-away meals with the date they were passed on.
 */
export function tasteQuestions(
  passes: { recipe: Pick<Recipe, "ingredients">; at: string }[],
  existingAvoid: string,
  now: Date,
): Question[] {
  const counts = new Map<string, number>();
  for (const p of passes) {
    if (daysBetween(p.at, now) > 30) continue;
    for (const key of ingredientKeys(p.recipe)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const avoid = existingAvoid.toLowerCase();
  const at = now.toISOString();
  return [...counts.entries()]
    .filter(([key, n]) => n >= 3 && !avoid.includes(key))
    .map(([key]) => ({
      id: `avoid:${key}`,
      text: `Leave ${pluralize(key)} out of your plans?`,
      why: `You passed on 3 meals with ${pluralize(key)}.`,
      source: "taste" as const,
      change: { kind: "avoid" as const, ingredient: key },
      addedAt: at,
    }));
}

function pluralize(word: string): string {
  if (/(fish|feta|tofu|rice|cheese|beef|pork|salmon|tuna|shrimp|yogurt|spinach|broccoli|chicken|turkey|ham)$/.test(word)) return word;
  if (/o$/.test(word)) return `${word}es`;
  if (/y$/.test(word)) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
}

// ---------- Applying changes ----------

function appendToken(existing: string | undefined, token: string): string {
  const tokens = (existing ?? "")
    .split(/[,;\n]+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length >= 2);
  return tokens.includes(token) ? tokens.join(", ") : [...tokens, token].join(", ");
}

/** The state before and after applying a change; only the affected fields are captured. */
export function applyChange(
  current: {
    displayPrefs: DisplayPrefs;
    dislikedFoodCustom: string;
    ingredientVariety?: UserProfile["ingredientVariety"];
    weeklyMealPrepRepeatCount?: UserProfile["weeklyMealPrepRepeatCount"];
    maxLeftoverStreakDays?: number;
    planSettings?: PlanSettings;
  },
  change: QuestionChange,
): { before: CheckpointState; after: CheckpointState; what: string } {
  if (change.kind === "planSettings") {
    const was = current.planSettings ?? {};
    const before: PlanSettings = {};
    for (const key of Object.keys(change.set) as (keyof PlanSettings)[]) {
      (before as Record<string, unknown>)[key] = was[key] ?? defaultPlanSetting(key);
    }
    return { before: { planSettings: before }, after: { planSettings: { ...change.set } }, what: change.what };
  }
  if (change.kind === "shorterBatches") {
    return {
      before: {
        weeklyMealPrepRepeatCount: current.weeklyMealPrepRepeatCount ?? 3,
        maxLeftoverStreakDays: current.maxLeftoverStreakDays ?? 2,
      },
      after: {
        weeklyMealPrepRepeatCount: Math.max(2, Math.min(current.weeklyMealPrepRepeatCount ?? 3, change.days)) as 2 | 3 | 4,
        maxLeftoverStreakDays: Math.min(current.maxLeftoverStreakDays ?? 2, change.days),
      },
      what: `Shorter batches (${change.days} days)`,
    };
  }
  if (change.kind === "display") {
    const next = { ...current.displayPrefs, ...change.set };
    const turnedOn = Object.values(change.set).some(Boolean);
    return {
      before: { displayPrefs: current.displayPrefs },
      after: { displayPrefs: next },
      what: turnedOn ? "Showed carbs, fat and fiber on meal cards" : "Simpler meal cards",
    };
  }
  if (change.kind === "avoid") {
    return {
      before: { dislikedFoodCustom: current.dislikedFoodCustom },
      after: { dislikedFoodCustom: appendToken(current.dislikedFoodCustom, change.ingredient) },
      what: `Left ${pluralize(change.ingredient)} out of plans`,
    };
  }
  return {
    before: { ingredientVariety: current.ingredientVariety ?? "minimal" },
    after: { ingredientVariety: "varied" },
    what: "More variety in plans",
  };
}

/** Value a plan setting has when it was never set, so Restore can put it back exactly. */
function defaultPlanSetting(key: keyof PlanSettings): PlanSettings[keyof PlanSettings] {
  switch (key) {
    case "weeklyMealPrepSlot":
      return "dinner";
    case "weeklyMealPrepRepeatCount":
      return 3;
    default:
      return false;
  }
}
