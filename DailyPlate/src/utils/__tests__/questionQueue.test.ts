import { describe, expect, it } from "vitest";
import type { Recipe } from "@/types";
import { recipeLibrary } from "@/recipes/recipeLibrary";
import { simplestView, startingDisplayPrefs } from "@/utils/displayPrefs";
import {
  applyChange,
  canAskOnOpen,
  enqueue,
  ingredientKeys,
  nextQuestions,
  recordAnswer,
  tasteQuestions,
  usageQuestions,
  type Question,
  type UsageEvent,
} from "@/utils/questionQueue";

const now = new Date("2026-11-23T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString();

const q = (id: string): Question => ({
  id,
  text: id,
  why: "test",
  source: "usage",
  change: { kind: "display", set: { cardMacros: true } },
  addedAt: now.toISOString(),
});

describe("asking", () => {
  it("asks on open only when no question was asked in the last 3 days", () => {
    expect(canAskOnOpen(null, now)).toBe(true);
    expect(canAskOnOpen(daysAgo(2.9), now)).toBe(false);
    expect(canAskOnOpen(daysAgo(3), now)).toBe(true);
  });

  it("one question at a time on open, two at most in a check-in", () => {
    const queue = [q("a"), q("b"), q("c")];
    expect(nextQuestions(queue, {}, now, 1).map((x) => x.id)).toEqual(["a"]);
    expect(nextQuestions(queue, {}, now, 2).map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("the same question is never queued twice", () => {
    expect(enqueue([q("a")], {}, q("a"), now)).toHaveLength(1);
  });
});

describe("answers", () => {
  it("No removes the question and keeps it away for at least 30 days", () => {
    const { queue, log } = recordAnswer([q("a")], {}, "a", "no", now);
    expect(queue).toHaveLength(0);
    expect(enqueue([], log, q("a"), new Date(now.getTime() + 29 * 86400000))).toHaveLength(0);
    expect(enqueue([], log, q("a"), new Date(now.getTime() + 31 * 86400000))).toHaveLength(1);
  });

  it("Not now keeps the question queued", () => {
    const { queue, log } = recordAnswer([q("a")], {}, "a", "not_now", now);
    expect(queue.map((x) => x.id)).toEqual(["a"]);
    expect(log.a!.answer).toBe("not_now");
  });

  it("Yes removes it for good", () => {
    const { log } = recordAnswer([q("a")], {}, "a", "yes", now);
    expect(enqueue([], log, q("a"), new Date(now.getTime() + 400 * 86400000))).toHaveLength(0);
  });
});

describe("sources", () => {
  const ev = (kind: UsageEvent["kind"], n: number, d = 1): UsageEvent[] =>
    Array.from({ length: n }, () => ({ kind, at: daysAgo(d) }));

  it("frequent details or Adjust → offer carbs, fat and fiber on cards", () => {
    const basic = startingDisplayPrefs("basic");
    expect(usageQuestions(ev("details", 5), basic, daysAgo(30), now).map((x) => x.id)).toEqual(["show-macros"]);
    expect(usageQuestions(ev("adjust", 3), basic, daysAgo(30), now).map((x) => x.id)).toEqual(["show-macros"]);
    expect(usageQuestions(ev("details", 4), basic, daysAgo(30), now)).toEqual([]);
    // Older than 14 days doesn't count.
    expect(usageQuestions(ev("details", 6, 20), basic, daysAgo(30), now)).toEqual([]);
  });

  it("rarely opening details → offer a simpler card", () => {
    const detailed = startingDisplayPrefs("detailed");
    const events = [{ kind: "cards" as const, at: daysAgo(2), n: 25 }];
    expect(usageQuestions(events, detailed, daysAgo(30), now).map((x) => x.id)).toEqual(["simpler-card"]);
    // Not in the first two weeks.
    expect(usageQuestions(events, detailed, daysAgo(5), now)).toEqual([]);
  });

  it("passing on 3 meals with the same ingredient → leave it out", () => {
    const mush = recipeLibrary.filter((r) => ingredientKeys(r).includes("mushroom"));
    expect(mush.length).toBeGreaterThan(0);
    // Three passes: different recipes or the same one passed on again.
    const passes = [mush[0]!, mush[1] ?? mush[0]!, mush[0]!].map((recipe: Recipe) => ({ recipe, at: daysAgo(3) }));
    const qs = tasteQuestions(passes, "", now);
    const m = qs.find((x) => x.id === "avoid:mushroom")!;
    expect(m.text).toBe("Leave mushrooms out of your plans?");
    expect(tasteQuestions(passes, "mushroom", now).some((x) => x.id === "avoid:mushroom")).toBe(false);
    expect(tasteQuestions(passes.slice(0, 2), "", now).some((x) => x.id === "avoid:mushroom")).toBe(false);
  });
});

describe("changes", () => {
  it("a Yes to an avoid question adds the ingredient to the avoid list", () => {
    const res = applyChange(
      { displayPrefs: startingDisplayPrefs("basic"), dislikedFoodCustom: "olives" },
      { kind: "avoid", ingredient: "mushroom" },
    );
    expect(res.before.dislikedFoodCustom).toBe("olives");
    expect(res.after.dislikedFoodCustom).toBe("olives, mushroom");
  });

  it("Simplest view turns every optional element off", () => {
    expect(Object.values(simplestView()).every((v) => v === false)).toBe(true);
  });

  it("existing users keep everything on; basic starts with fewer details", () => {
    const existing = startingDisplayPrefs("existing");
    const basic = startingDisplayPrefs("basic");
    expect(Object.values(existing).every(Boolean)).toBe(true);
    expect(basic.cardMacros).toBe(false);
    expect(basic.servingLine).toBe(true);
  });

});
