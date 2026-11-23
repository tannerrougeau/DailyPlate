import type { Recipe } from "@/types";
import type { UserProfile } from "@/types/profile";
import type { CheckInEntry } from "@/types/tdeeFeedback";
import { checkInScale } from "@/utils/checkInScale";
import type { CheckpointState, DisplayPrefs } from "@/utils/displayPrefs";
import { firstIngredientOption, ingredientRole } from "@/utils/ingredientNutrition";

export const ASK_SPACING_DAYS = 3;
export const NO_SNOOZE_DAYS = 30;
export const MAX_ON_OPEN = 1;
export const MAX_IN_CHECK_IN = 2;
const DAY_MS = 24 * 60 * 60 * 1000;

export type QuestionChange =
  | { kind: "display"; set: Partial<DisplayPrefs> }
  | { kind: "avoid"; ingredient: string }
  | { kind: "variety" };

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

/** Questions to show now, oldest first, at most `max`. */
export function nextQuestions(queue: Question[], log: QuestionLog, now: Date, max: number): Question[] {
  return queue.filter((q) => !blocked(log, q.id, now)).slice(0, max);
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

export function checkInQuestions(entry: CheckInEntry, prefs: DisplayPrefs, profile: UserProfile | null, now: Date): Question[] {
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
  current: { displayPrefs: DisplayPrefs; dislikedFoodCustom: string; ingredientVariety?: UserProfile["ingredientVariety"] },
  change: QuestionChange,
): { before: CheckpointState; after: CheckpointState; what: string } {
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
