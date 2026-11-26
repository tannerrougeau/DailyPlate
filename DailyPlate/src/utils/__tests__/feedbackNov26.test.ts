import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UserProfile } from "@/types/profile";
import { keepInPlace, restoreAnchor, scrollCorrection } from "@/utils/scrollAnchor";
import {
  TOPIC_ORDER,
  applyTopic,
  topicQuestions,
  topicsFor,
  unansweredTopics,
  type PersonalizeDraft,
} from "@/utils/personalizeTopics";
import { defaultRefineValues } from "@/components/ProfileRefineCards";
import { enqueue, questionsAllowed } from "@/utils/questionQueue";

const root = path.resolve(__dirname, "../..");

describe("Dropdowns open in place", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("the page doesn't anchor scrolling to content below a dropdown", () => {
    const css = readFileSync(path.join(root, "index.css"), "utf8");
    expect(css).toMatch(/html,\s*body\s*\{\s*overflow-anchor:\s*none;/);
  });

  it("scrollCorrection returns how far the header moved (ignoring sub-pixel noise)", () => {
    expect(scrollCorrection(200, 200)).toBe(0);
    expect(scrollCorrection(200, 200.4)).toBe(0);
    expect(scrollCorrection(200, 560)).toBe(360);
    expect(scrollCorrection(300, 120)).toBe(-180);
  });

  /** A header whose top moves from `before` to `after` when the toggle runs. */
  function fakeHeader(before: number, after: number, parent: HTMLElement | null = null) {
    let top = before;
    return {
      el: {
        isConnected: true,
        parentElement: parent,
        getBoundingClientRect: () => ({ top }) as DOMRect,
      } as unknown as HTMLElement,
      move: () => (top = after),
    };
  }

  it("on the page: scrolls the window so the header stays where it was", () => {
    const scrollBy = vi.fn();
    vi.stubGlobal("window", { scrollBy, getComputedStyle: () => ({ overflowY: "visible" }) });
    vi.stubGlobal("document", { body: {}, documentElement: {} });
    const h = fakeHeader(240, 600);
    h.move();
    restoreAnchor(h.el, 240);
    expect(scrollBy).toHaveBeenCalledWith(0, 360);
  });

  it("inside a scrolling sheet: scrolls the sheet instead of the page", () => {
    const sheet = { scrollTop: 50, scrollHeight: 2000, clientHeight: 700, parentElement: null } as unknown as HTMLElement;
    const scrollBy = vi.fn();
    vi.stubGlobal("window", { scrollBy, getComputedStyle: (n: unknown) => ({ overflowY: n === sheet ? "auto" : "visible" }) });
    vi.stubGlobal("document", { body: {}, documentElement: {} });
    const h = fakeHeader(100, 30, sheet);
    h.move();
    restoreAnchor(h.el, 100);
    expect(sheet.scrollTop).toBe(-20);
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("keepInPlace runs the toggle, then corrects on the next frame", () => {
    const scrollBy = vi.fn();
    let frame: (() => void) | null = null;
    vi.stubGlobal("window", {
      scrollBy,
      getComputedStyle: () => ({ overflowY: "visible" }),
      requestAnimationFrame: (cb: () => void) => ((frame = cb), 1),
    });
    vi.stubGlobal("document", { body: {}, documentElement: {} });
    const h = fakeHeader(300, 900);
    const toggle = vi.fn(h.move);
    keepInPlace(h.el, toggle);
    expect(toggle).toHaveBeenCalledOnce();
    expect(scrollBy).not.toHaveBeenCalled();
    frame!();
    expect(scrollBy).toHaveBeenCalledWith(0, 600);
  });

  it("every dropdown header in the app uses keepInPlace", () => {
    const files = [
      "components/CheckInSheet.tsx",
      "components/FoodSearchPanel.tsx",
      "components/MealCard.tsx",
      "components/MicronutrientDetails.tsx",
      "components/ProfileRefineCards.tsx",
      "components/RecipeDetailsBody.tsx",
      "components/ScanFoodsReview.tsx",
      "components/TodayMealRow.tsx",
      "screens/GroceryScreen.tsx",
      "screens/GuideScreen.tsx",
    ];
    for (const f of files) {
      const src = readFileSync(path.join(root, f), "utf8");
      // aria-expanded on menus (⋯) opens a sheet, not an inline dropdown.
      const inline = (src.match(/aria-expanded=\{(?!menuOpen)/g) ?? []).length;
      const anchored = (src.match(/keepInPlace\(e\.currentTarget/g) ?? []).length;
      expect(anchored, f).toBeGreaterThanOrEqual(inline);
    }
  });
});

describe("Item 41: Basic or Personalized", () => {
  it("Personalized asks the most plan-changing questions first, targets last", () => {
    expect(TOPIC_ORDER).toEqual([
      "sizes",
      "love",
      "mealSources",
      "cookingAmount",
      "cookingLimits",
      "budget",
      "cuisines",
      "rhythm",
      "household",
      "targets",
    ]);
    expect(topicsFor(1)).not.toContain("household");
    expect(topicsFor(3)).toContain("household");
    // Foods to avoid is asked of everyone in the main flow, not under Personalized.
    expect(TOPIC_ORDER as string[]).not.toContain("avoid");
  });

  it("skipped and unreached questions go to the queue; answered ones don't", () => {
    const asked = topicsFor(1);
    const left = unansweredTopics(asked, new Set(["sizes", "love"]));
    expect(left).toEqual(asked.filter((t) => t !== "sizes" && t !== "love"));
    const now = new Date("2026-11-26T12:00:00Z");
    let queue = topicQuestions(left, now).reduce((q, x) => enqueue(q, {}, x, now), [] as ReturnType<typeof topicQuestions>);
    expect(queue.map((q) => q.change)).toContainEqual({ kind: "askTopic", topic: "budget" });
    expect(queue.some((q) => q.id === "topic:sizes")).toBe(false);
    // Queued twice: still once.
    queue = topicQuestions(left, now).reduce((q, x) => enqueue(q, {}, x, now), queue);
    expect(queue).toHaveLength(left.length);
  });

  it("nothing is asked in Basic mode", () => {
    expect(questionsAllowed({ basicMode: true }, new Date())).toBe(false);
  });

  it("answering one question later changes only that part of the profile", () => {
    const profile = {
      age: 35, sex: "male", heightCm: 178, weightKg: 80, goal: "lose", mealsPerDay: "three",
      mealTiming: "light_breakfast", favoriteFoodChips: [], dislikedFoodChips: ["cilantro"],
      activityLevel: "moderate", budget: undefined, preferredCuisines: [],
    } as unknown as UserProfile;
    const draft: PersonalizeDraft = {
      refine: { ...defaultRefineValues(), favoriteChips: ["chicken"], dislikedChips: [] },
      fit: { budget: "tight" },
      mealSizes: { breakfast: "light", dinner: "large" },
      household: null,
    };
    const budget = applyTopic(profile, "budget", draft);
    expect(budget.budget).toBe("tight");
    expect(budget.favoriteFoodChips).toEqual([]);
    expect(budget.dislikedFoodChips).toEqual(["cilantro"]);
    const love = applyTopic(profile, "love", draft);
    expect(love.favoriteFoodChips).toEqual(["chicken"]);
    expect(love.dislikedFoodChips).toEqual(["cilantro"]);
    const sizes = applyTopic(profile, "sizes", draft);
    expect(sizes.mealSizes).toEqual({ breakfast: "light", dinner: "large" });
    expect(sizes.mealTiming).toBeNull();
  });
});
