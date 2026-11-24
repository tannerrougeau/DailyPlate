import { useEffect, useRef, useState } from "react";
import { AdjustServingsSheet } from "@/components/AdjustServingsSheet";
import { FoodPickConfirm } from "@/components/FoodPickConfirm";
import { FoodSearchPanel } from "@/components/FoodSearchPanel";
import { ScanButton } from "@/components/ScanButton";
import { ScanFoodsReview } from "@/components/ScanFoodsReview";
import { ScanLabelReview } from "@/components/ScanLabelReview";
import type { ScanContext, ScanResult } from "@/server/scan/types";
import { useAppStore } from "@/store/useAppStore";
import type { DailyTargets, MealSlotId, MealTrackingEntry, PlannedMeal } from "@/types";
import type { FoodItem } from "@/utils/foodTypes";
import { foodLogFromFood, foodToSnackItem, SEARCH_FAILED_MESSAGE } from "@/utils/foodSearch";
import { formatServings, foodLogForServings } from "@/utils/mealTracking";
import { mealIngredients, mixedServingGrams } from "@/utils/mealPortions";
import { snackLogEntry } from "@/utils/snackItems";
import { readBarcode } from "@/utils/scan/barcode";
import { newCorrection, saveCorrection } from "@/utils/scan/corrections";
import { resizeForScan, type ScanPhoto } from "@/utils/scan/image";
import { lookupBarcode, scanPhoto } from "@/utils/scan/scanClient";
import {
  MULTIPLE_LABELS_MESSAGE,
  SCAN_FAILED_MESSAGE,
  SCAN_OFFLINE_MESSAGE,
  SCAN_PAUSED_MESSAGE,
  SCAN_TOO_LARGE_MESSAGE,
  scanView,
  STILL_WORKING_AFTER_MS,
  type ScanFinal,
  type ScanView,
} from "@/utils/scan/scanFlow";

type Screen =
  | { kind: "working"; step: "reading" | "barcode" | "scanning" }
  | { kind: "view"; view: ScanView }
  | { kind: "barcodeFood"; code: string; food: FoodItem }
  | { kind: "barcodeWaiting"; code: string }
  | { kind: "message"; text: string; suggestions?: string[] }
  | { kind: "search"; query?: string }
  | { kind: "searchPicked"; food: FoodItem; query?: string }
  | { kind: "manual" };

const OPTIONS = [0.5, 1, 1.5, 2];

/**
 * The scan flow, shown inside the snack or meal-log sheet in place of search:
 * photo → on-device barcode (lookup, no AI) → otherwise the AI scan → confirm → log.
 * Numbers come from the planned recipe, USDA / Open Food Facts or the label; never from the AI.
 */
export function ScanPanel({
  file,
  dateKey,
  slot,
  mode,
  plannedMeal,
  target,
  forLabel,
  onLog,
  onDone,
}: {
  file: File;
  dateKey: string;
  slot: MealSlotId;
  /** "snack" logs a snack entry; "meal" logs the meal slot. */
  mode: "snack" | "meal";
  /** Sent as context so the model can say whether the photo is the planned meal. */
  plannedMeal: PlannedMeal | null;
  target: Pick<DailyTargets, "calories" | "protein"> | null;
  forLabel: string;
  onLog: (entry: MealTrackingEntry) => void;
  /** Back to the sheet without logging. */
  onDone: () => void;
}) {
  const saveMyFood = useAppStore((s) => s.saveMyFood);
  const addPendingBarcode = useAppStore((s) => s.addPendingBarcode);
  const corrections = useAppStore((s) => s.scanCorrections);
  // A retake (several labels in one photo) replaces the photo in place.
  const [photoFile, setPhotoFile] = useState(file);
  const [screen, setScreen] = useState<Screen>({ kind: "working", step: "reading" });
  const [stillWorking, setStillWorking] = useState(false);
  const [adjustPlanned, setAdjustPlanned] = useState(false);
  const photoRef = useRef<ScanPhoto | null>(null);
  const aiRef = useRef<{ result: ScanResult; meta: { provider: string; model: string; ms: number } } | null>(null);
  const pathRef = useRef<"barcode" | "ai">("ai");
  const finishedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const waitingCodeRef = useRef<string | null>(null);

  const context: ScanContext = {
    slot: slot as ScanContext["slot"],
    plannedMeal: plannedMeal
      ? { name: plannedMeal.recipe.name, ingredients: mealIngredients(plannedMeal).map((i) => i.name) }
      : undefined,
  };

  function record(final: ScanFinal) {
    if (!corrections || !photoRef.current) return;
    void saveCorrection(
      newCorrection({
        slot,
        plannedMealName: plannedMeal?.recipe.name ?? null,
        photo: photoRef.current.blob,
        path: pathRef.current,
        aiResult: aiRef.current?.result ?? null,
        aiMeta: aiRef.current?.meta ?? null,
        final,
      }),
    ).catch(() => undefined);
  }

  function finish(entry: MealTrackingEntry, final: ScanFinal) {
    finishedRef.current = true;
    record(final);
    onLog(entry);
  }

  function logFood(food: FoodItem, servings: number, final: ScanFinal) {
    const entry =
      mode === "snack"
        ? snackLogEntry(dateKey, foodToSnackItem(food), servings, "scan")
        : foodLogFromFood(dateKey, slot, food, servings, "scan");
    finish(entry, final);
  }

  function cancel() {
    abortRef.current?.abort();
    if (!finishedRef.current) {
      finishedRef.current = true;
      record({ kind: "cancelled" });
    }
    onDone();
  }

  function retake(next: File) {
    record({ kind: "cancelled" });
    aiRef.current = null;
    pathRef.current = "ai";
    finishedRef.current = false;
    setScreen({ kind: "working", step: "reading" });
    setPhotoFile(next);
  }

  async function runBarcode(code: string) {
    setScreen({ kind: "working", step: "barcode" });
    const r = await lookupBarcode(code);
    if (r.kind === "found") setScreen({ kind: "barcodeFood", code, food: r.foods[0]! });
    else if (r.kind === "offline") {
      waitingCodeRef.current = code;
      setScreen({ kind: "barcodeWaiting", code });
    } else if (r.kind === "not_found") {
      setScreen({ kind: "message", text: `Barcode ${code} isn't in USDA or Open Food Facts. Search or enter it from the label.` });
    } else setScreen({ kind: "message", text: SEARCH_FAILED_MESSAGE });
  }

  // The flow runs once per photo.
  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    abortRef.current = controller;
    void (async () => {
      let photo: ScanPhoto;
      try {
        photo = await resizeForScan(photoFile);
      } catch {
        if (live) setScreen({ kind: "message", text: "Couldn't read that photo. Try another, or search instead." });
        return;
      }
      photoRef.current = photo;
      const code = await readBarcode(photo.blob);
      if (!live) return;
      if (code) {
        pathRef.current = "barcode";
        await runBarcode(code);
        return;
      }
      setScreen({ kind: "working", step: "scanning" });
      const timer = window.setTimeout(() => live && setStillWorking(true), STILL_WORKING_AFTER_MS);
      const outcome = await scanPhoto({ base64: photo.base64 }, context, { signal: controller.signal });
      window.clearTimeout(timer);
      if (!live) return;
      setStillWorking(false);
      if (!outcome.ok) {
        if (outcome.reason === "cancelled") return;
        const text =
          outcome.reason === "offline"
            ? SCAN_OFFLINE_MESSAGE
            : outcome.reason === "limit"
              ? SCAN_PAUSED_MESSAGE
              : outcome.reason === "too_large"
                ? SCAN_TOO_LARGE_MESSAGE
                : SCAN_FAILED_MESSAGE;
        setScreen({ kind: "message", text });
        return;
      }
      aiRef.current = { result: outcome.result, meta: outcome.meta };
      const view = scanView(outcome.result, { hasPlannedMeal: Boolean(plannedMeal) });
      if (view.kind === "barcode") await runBarcode(view.code);
      else setScreen({ kind: "view", view });
    })();
    return () => {
      live = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoFile]);

  // A barcode read offline: look it up when the connection is back, or keep it for later.
  useEffect(() => {
    if (screen.kind !== "barcodeWaiting") return;
    const code = screen.code;
    const retry = () => {
      waitingCodeRef.current = null;
      void runBarcode(code);
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);
  useEffect(
    () => () => {
      if (waitingCodeRef.current) addPendingBarcode(waitingCodeRef.current);
    },
    [addPendingBarcode],
  );

  const fallbacks = (suggestions: string[] = []) => (
    <div className="mt-3 flex flex-wrap gap-2">
      {suggestions.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => setScreen({ kind: "search", query: s })}
          className="min-h-[40px] rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800"
        >
          {s}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setScreen({ kind: "search" })}
        className="min-h-[40px] rounded-xl border border-slate-200 px-3 text-sm font-semibold text-[#2563EB]"
      >
        Search instead
      </button>
      <button
        type="button"
        onClick={() => setScreen({ kind: "manual" })}
        className="min-h-[40px] rounded-xl border border-slate-200 px-3 text-sm font-semibold text-[#2563EB]"
      >
        Enter from a label
      </button>
    </div>
  );

  const header = (
    <div className="mb-2 flex items-center justify-between">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Scan</p>
      <button type="button" onClick={cancel} className="min-h-[36px] px-2 text-sm font-semibold text-slate-500">
        {screen.kind === "working" ? "Cancel" : "Close"}
      </button>
    </div>
  );

  let body: React.ReactNode = null;
  if (screen.kind === "working") {
    body = (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700" aria-live="polite">
        <p className="font-semibold">
          {screen.step === "reading" ? "Reading the photo…" : screen.step === "barcode" ? "Looking up the barcode…" : "Identifying…"}
        </p>
        {stillWorking && (
          <p className="mt-1">
            Still working…{" "}
            <button type="button" onClick={cancel} className="font-semibold text-[#2563EB]">
              Cancel
            </button>
          </p>
        )}
      </div>
    );
  } else if (screen.kind === "message") {
    body = (
      <div className="rounded-2xl border border-slate-200 p-3">
        <p className="text-sm leading-relaxed text-slate-700">{screen.text}</p>
        {fallbacks(screen.suggestions)}
      </div>
    );
  } else if (screen.kind === "barcodeWaiting") {
    body = (
      <div className="rounded-2xl border border-slate-200 p-3" aria-live="polite">
        <p className="text-sm leading-relaxed text-slate-700">
          Barcode {screen.code} read. {SCAN_OFFLINE_MESSAGE}
        </p>
        {fallbacks()}
      </div>
    );
  } else if (screen.kind === "barcodeFood") {
    const { code, food } = screen;
    body = (
      <FoodPickConfirm
        food={food}
        target={target}
        forLabel={forLabel}
        onBack={() => setScreen({ kind: "search" })}
        onLog={(servings, sized) => {
          saveMyFood(sized);
          logFood(sized, servings, { kind: "barcode", code, matchId: food.id });
        }}
      />
    );
  } else if (screen.kind === "search") {
    body = (
      <FoodSearchPanel
        key={screen.query ?? "search"}
        initialQuery={screen.query}
        onPick={(food) => setScreen({ kind: "searchPicked", food, query: screen.query })}
      />
    );
  } else if (screen.kind === "searchPicked") {
    const { food, query } = screen;
    body = (
      <FoodPickConfirm
        food={food}
        target={target}
        forLabel={forLabel}
        onBack={() => setScreen({ kind: "search", query })}
        onLog={(servings, sized) => {
          saveMyFood(sized);
          logFood(sized, servings, { kind: "search", query, matchId: food.id });
        }}
      />
    );
  } else if (screen.kind === "manual") {
    body = (
      <FoodSearchPanel
        startWithManual
        onPick={(food) => {
          saveMyFood(food);
          logFood(food, 1, { kind: "manual" });
        }}
      />
    );
  } else if (screen.view.kind === "planned" && plannedMeal) {
    const meal = plannedMeal;
    const logPlanned = (servings: number) =>
      finish(foodLogForServings(dateKey, meal, servings), { kind: "planned", recipeId: meal.recipe.id, servings });
    body = (
      <div className="rounded-2xl border border-slate-200 p-3">
        <p className="text-sm font-semibold text-slate-900">Looks like your {meal.recipe.name}. Log it?</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => logPlanned(s)}
              className="min-h-[48px] rounded-xl border border-slate-200 text-sm font-semibold text-slate-800"
              aria-label={`Log ${formatServings(s)}`}
            >
              {s === 0.5 ? "½" : s === 1.5 ? "1½" : s}
            </button>
          ))}
        </div>
        <p className="mt-1 text-center text-xs text-slate-400">servings</p>
        <div className="mt-2 flex gap-3">
          {mixedServingGrams(meal) != null && (
            <button type="button" onClick={() => setAdjustPlanned(true)} className="text-sm font-semibold text-[#2563EB]">
              Grams
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const result = aiRef.current?.result;
              const view = result ? scanView(result, { hasPlannedMeal: true, skipPlanned: true }) : null;
              setScreen(view ? { kind: "view", view } : { kind: "search" });
            }}
            className="text-sm font-semibold text-slate-500"
          >
            Not it
          </button>
        </div>
        {adjustPlanned && (
          <AdjustServingsSheet
            title={meal.recipe.name}
            servingGrams={mixedServingGrams(meal)}
            onChoose={logPlanned}
            onClose={() => setAdjustPlanned(false)}
          />
        )}
      </div>
    );
  } else if (screen.view.kind === "foods") {
    body = (
      <ScanFoodsReview
        items={screen.view.items}
        unsure={screen.view.unsure}
        target={target}
        forLabel={forLabel}
        onSearchInstead={() => setScreen({ kind: "search" })}
        onLog={(combined, parts, servings, unsureChoices) => {
          for (const p of parts) saveMyFood(p.food);
          logFood(combined, servings, {
            kind: "foods",
            servings,
            items: parts.map((p) => ({ aiName: p.aiName, matchId: p.food.id, matchName: p.food.name, grams: p.food.servingGrams ?? null })),
            unsure: unsureChoices,
          });
        }}
      />
    );
  } else if (screen.view.kind === "label") {
    body = (
      <ScanLabelReview
        label={screen.view.label}
        dateKey={dateKey}
        target={target}
        forLabel={forLabel}
        onLog={(food, servings, values) => {
          saveMyFood(food);
          logFood(food, servings, { kind: "label", values, servings });
        }}
      />
    );
  } else if (screen.view.kind === "multipleLabels") {
    body = (
      <div className="rounded-2xl border border-slate-200 p-3">
        <p className="text-sm leading-relaxed text-slate-700">{MULTIPLE_LABELS_MESSAGE}</p>
        <div className="mt-3">
          <ScanButton onPhoto={retake} />
        </div>
        <button
          type="button"
          onClick={() => setScreen({ kind: "manual" })}
          className="mt-2 min-h-[40px] text-sm font-semibold text-[#2563EB]"
        >
          Enter from a label
        </button>
      </div>
    );
  } else {
    const suggestions = screen.view.kind === "uncertain" ? screen.view.suggestions : [];
    body = (
      <div className="rounded-2xl border border-slate-200 p-3">
        <p className="text-sm leading-relaxed text-slate-700">
          {suggestions.length > 0 ? "Not sure what this is. Is it one of these?" : "Not sure what this is."}
        </p>
        {fallbacks(suggestions)}
      </div>
    );
  }

  return (
    <div>
      {header}
      {body}
    </div>
  );
}
