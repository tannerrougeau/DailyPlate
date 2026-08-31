import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ChefHat,
  ChevronDown,
  GripVertical,
  Heart,
  Lock,
  MoreHorizontal,
  ThumbsDown,
} from "lucide-react";
import { MealActionsMenu } from "@/components/MealActionsMenu";
import { ReplaceMealSheet } from "@/components/ReplaceMealSheet";
import { RecipeDetailsBody } from "@/components/RecipeDetailsBody";
import { RecipeImage } from "@/components/RecipeImage";
import { SwipeableRow } from "@/components/SwipeableRow";
import type { CarbVariationId, MealSlotId, MealTrackingEntry, PlannedMeal } from "@/types";
import { useAppStore } from "@/store/useAppStore";
import { isMealLocked } from "@/utils/mealLocks";
import { householdMultiplierFor } from "@/utils/household";
import { useOverlayBack } from "@/hooks/useOverlayBack";
import { MealMacroLine } from "@/components/MealMacroLine";
import {
  effectiveCarbVariationId,
  effectiveVariationId,
  mealDisplayName,
  recipeFiberGrams,
  resolveRecipeMacros,
} from "@/utils/recipeDisplay";
import { trackingBadgeClass, trackingLabel } from "@/utils/mealTracking";
import { isLowComplexityLeftover, isMealPrepBatchBadge } from "@/utils/mealPrepDisplay";

const slotLabel: Record<PlannedMeal["slot"], string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

function tagLine(recipe: PlannedMeal["recipe"]) {
  const extra = recipe.tags[0]?.replace(/_/g, " ") ?? "balanced";
  return `${recipe.cuisine} · ${extra}`;
}

export function MealCard({
  meal,
  dateKey,
  onMealPrep,
  draggable = false,
  isDragOver = false,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  trackingEntry,
  onTrackTap,
  onAddNote,
  dayMeals,
  inlineDetailsDropdown = false,
  showEatenSkip = false,
  onEaten,
  onSkip,
}: {
  meal: PlannedMeal;
  dateKey?: string;
  onMealPrep?: (recipe: PlannedMeal["recipe"]) => void;
  draggable?: boolean;
  isDragOver?: boolean;
  onDragStart?: (event: React.DragEvent) => void;
  onDragOver?: (event: React.DragEvent) => void;
  onDragLeave?: (event: React.DragEvent) => void;
  onDrop?: (event: React.DragEvent) => void;
  onDragEnd?: (event: React.DragEvent) => void;
  trackingEntry?: MealTrackingEntry;
  onTrackTap?: () => void;
  onAddNote?: () => void;
  dayMeals?: PlannedMeal[];
  inlineDetailsDropdown?: boolean;
  showEatenSkip?: boolean;
  onEaten?: () => void;
  onSkip?: () => void;
}) {
  const { recipe, scale, slot } = meal;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [variationId, setVariationId] = useState(() => effectiveVariationId(meal));
  const [carbVariationId, setCarbVariationId] = useState<CarbVariationId>(() =>
    effectiveCarbVariationId(meal),
  );

  useEffect(() => {
    setVariationId(effectiveVariationId(meal));
    setCarbVariationId(effectiveCarbVariationId(meal));
  }, [meal.selectedVariationId, meal.selectedCarbVariationId, meal.recipe.id]);

  useOverlayBack(detailsOpen, () => setDetailsOpen(false));

  const favoriteIds = useAppStore((s) => s.favoriteIds);
  const dislikedIds = useAppStore((s) => s.dislikedIds);
  const userProfile = useAppStore((s) => s.userProfile);
  const targets = useAppStore((s) => s.targets);
  const todayDateKey = useAppStore((s) => s.todayDateKey);
  const lockedDays = useAppStore((s) => s.lockedDays);
  const lockedMeals = useAppStore((s) => s.lockedMeals);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const toggleDislike = useAppStore((s) => s.toggleDislike);
  const toggleMealLock = useAppStore((s) => s.toggleMealLock);
  const regenerateSlot = useAppStore((s) => s.regenerateSlot);
  const replaceMealSlot = useAppStore((s) => s.replaceMealSlot);
  const removeMealSlot = useAppStore((s) => s.removeMealSlot);
  const setMealVariation = useAppStore((s) => s.setMealVariation);
  const setMealCarbVariation = useAppStore((s) => s.setMealCarbVariation);

  const effectiveDateKey = dateKey ?? todayDateKey;
  const dayLocked = lockedDays.includes(effectiveDateKey);
  const mealLocked = isMealLocked(lockedMeals, effectiveDateKey, slot);
  const actionsDisabled = mealLocked || dayLocked;
  const canDrag = draggable && !actionsDisabled;

  const excludeRecipeIds = useMemo(
    () => new Set((dayMeals ?? []).filter((m) => m.slot !== slot).map((m) => m.recipe.id)),
    [dayMeals, slot],
  );

  const householdMult = householdMultiplierFor(userProfile);

  const displayVariationId = effectiveVariationId(meal);
  const displayCarbId = effectiveCarbVariationId(meal);
  const macros = resolveRecipeMacros(recipe, displayVariationId, displayCarbId);
  const fav = favoriteIds.includes(recipe.id);
  const dislike = dislikedIds.includes(recipe.id);
  const kcal = Math.round(macros.calories * scale);
  const p = Math.round(macros.protein * scale);
  const c = Math.round(macros.carbs * scale);
  const f = Math.round(macros.fat * scale);
  const fiber = Math.round(recipeFiberGrams(recipe, displayVariationId, displayCarbId) * scale);

  function handleVariationChange(nextVariationId: string) {
    setVariationId(nextVariationId);
    setMealVariation(effectiveDateKey, slot, nextVariationId);
  }

  function handleCarbVariationChange(nextCarbId: CarbVariationId) {
    setCarbVariationId(nextCarbId);
    setMealCarbVariation(effectiveDateKey, slot, nextCarbId);
  }

  function handleRemove() {
    if (actionsDisabled) return;
    removeMealSlot(effectiveDateKey, slot);
  }

  const mainContent = (
    <>
      <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden bg-slate-100 sm:h-[96px] sm:w-[96px]">
        <RecipeImage recipe={recipe} fill priority />
      </div>
      <MealCardMainContent
        meal={meal}
        recipe={recipe}
        slot={slot}
        mealLocked={mealLocked}
        kcal={kcal}
        p={p}
        c={c}
        f={f}
        fiber={fiber}
        trackingEntry={trackingEntry}
        showEatenSkip={showEatenSkip}
        onEaten={onEaten}
        onSkip={onSkip}
      />
    </>
  );

  const swipeableMain = onTrackTap && !showEatenSkip ? (
    <button
      type="button"
      onClick={onTrackTap}
      className="flex min-w-0 flex-1 gap-0 text-left"
      aria-label={`Log ${mealDisplayName(meal)}`}
    >
      {mainContent}
    </button>
  ) : (
    <div className="flex min-w-0 flex-1 gap-0">{mainContent}</div>
  );

  const actionButtons = (
    <div className="relative z-10 flex shrink-0 flex-col items-center gap-0 px-1 py-2.5">
      <QuickAction
        label={fav ? "Remove from favorites" : "Favorite"}
        onClick={() => toggleFavorite(recipe.id)}
        active={fav}
        activeClass="text-red-500"
      >
        <Heart className={`h-[18px] w-[18px] ${fav ? "fill-current" : ""}`} />
      </QuickAction>
      <QuickAction
        label={dislike ? "Remove dislike" : "Dislike"}
        onClick={() => toggleDislike(recipe.id)}
        active={dislike}
        activeClass="text-slate-700"
      >
        <ThumbsDown className={`h-[18px] w-[18px] ${dislike ? "fill-current" : ""}`} />
      </QuickAction>
      <button
        type="button"
        aria-label="More actions"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-600"
      >
        <MoreHorizontal className="h-[18px] w-[18px]" />
      </button>
    </div>
  );

  const cardBody = (
    <div className="flex gap-0 rounded-2xl">
      {canDrag && (
        <button
          type="button"
          aria-label="Drag to reorder meal"
          draggable
          onDragStart={(event) => {
            event.stopPropagation();
            onDragStart?.(event);
          }}
          onDragEnd={onDragEnd}
          className="relative z-10 flex w-6 shrink-0 cursor-grab items-center justify-center border-r border-slate-100 bg-slate-50/80 text-slate-400 active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      {actionsDisabled ? (
        <>
          {swipeableMain}
          {actionButtons}
        </>
      ) : (
        <>
          <SwipeableRow
            disabled={actionsDisabled}
            onSwipeLeft={() => regenerateSlot(slot, dateKey)}
            onSwipeRight={() => regenerateSlot(slot, dateKey)}
            leftLabel="New meal"
            rightLabel="Swap"
            roundedClassName="min-w-0 flex-1 rounded-none"
          >
            {swipeableMain}
          </SwipeableRow>
          {actionButtons}
        </>
      )}
    </div>
  );

  return (
    <>
      <article
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`rounded-2xl border bg-white shadow-sm transition-all duration-300 ${
          isDragOver ? "border-primary ring-2 ring-primary/20" : ""
        } ${
          trackingEntry
            ? "border-emerald-200/80 ring-1 ring-emerald-100"
            : mealLocked
              ? "border-amber-300/90 ring-1 ring-amber-200/80"
              : onTrackTap
                ? "border-slate-200/80 hover:border-primary/30 hover:shadow-md"
                : "border-slate-200/80"
        }`}
      >
        {cardBody}

        {inlineDetailsDropdown && (
          <button
            type="button"
            aria-expanded={detailsOpen}
            aria-controls={`meal-details-${slot}`}
            onClick={() => setDetailsOpen((open) => !open)}
            className="flex min-h-[44px] w-full items-center justify-between border-t border-slate-100 px-4 py-2.5 text-left text-sm font-semibold text-primary transition-colors hover:bg-slate-50/80"
          >
            <span>Recipe/Prep details</span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-primary transition-transform duration-200 ${
                detailsOpen ? "rotate-180" : ""
              }`}
              aria-hidden
            />
          </button>
        )}

        {detailsOpen && (
          <div
            id={`meal-details-${slot}`}
            className="border-t border-slate-100 px-4 py-3"
          >
            <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
              <p className="leading-relaxed">
                Prep {recipe.prepMinutes} min · Cook {recipe.cookMinutes} min
              </p>
              <RecipeDetailsBody
                recipe={recipe}
                variationId={variationId}
                onVariationChange={handleVariationChange}
                carbVariationId={carbVariationId}
                onCarbVariationChange={handleCarbVariationChange}
                mealScale={scale}
                householdMult={householdMult}
                userProfile={userProfile}
                targets={targets}
                meal={{
                  ...meal,
                  selectedVariationId: variationId,
                  selectedCarbVariationId: carbVariationId,
                }}
              />
            </div>
          </div>
        )}
      </article>

      {menuOpen &&
        createPortal(
          <MealActionsMenu
            meal={meal}
            dateKey={effectiveDateKey}
            favorite={fav}
            mealLocked={mealLocked}
            dayLocked={dayLocked}
            actionsDisabled={actionsDisabled}
            onClose={() => setMenuOpen(false)}
            onReplace={() => setReplaceOpen(true)}
            onRegenerate={() => regenerateSlot(slot, dateKey)}
            onRemove={handleRemove}
            onAddNote={onAddNote ?? onTrackTap}
            onToggleFavorite={() => toggleFavorite(recipe.id)}
            onToggleLock={() => toggleMealLock(effectiveDateKey, slot)}
            onMealPrep={onMealPrep ? () => onMealPrep(recipe) : undefined}
            onDetails={
              inlineDetailsDropdown ? undefined : () => setDetailsOpen(true)
            }
          />,
          document.body,
        )}

      {replaceOpen &&
        createPortal(
          <ReplaceMealSheet
            meal={meal}
            dateKey={effectiveDateKey}
            excludeRecipeIds={excludeRecipeIds}
            onClose={() => setReplaceOpen(false)}
            onSelect={(recipeId) => replaceMealSlot(effectiveDateKey, slot, recipeId)}
          />,
          document.body,
        )}
    </>
  );
}

function MealCardMainContent({
  meal,
  recipe,
  slot,
  mealLocked,
  kcal,
  p,
  c,
  f,
  fiber,
  trackingEntry,
  showEatenSkip,
  onEaten,
  onSkip,
}: {
  meal: PlannedMeal;
  recipe: PlannedMeal["recipe"];
  slot: PlannedMeal["slot"];
  mealLocked: boolean;
  kcal: number;
  p: number;
  c: number;
  f: number;
  fiber: number;
  trackingEntry?: MealTrackingEntry;
  showEatenSkip?: boolean;
  onEaten?: () => void;
  onSkip?: () => void;
}) {
  return (
    <div className="min-w-0 flex-1 px-3 py-3">
      <p className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {slotLabel[slot]}
        {mealLocked && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-amber-900">
            <Lock className="h-2.5 w-2.5" aria-hidden />
            Locked
          </span>
        )}
        {isLowComplexityLeftover(meal) && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-amber-900">
            Leftover
          </span>
        )}
        {isMealPrepBatchBadge(meal) && meal.mealPrep && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-violet-900">
            <ChefHat className="h-2.5 w-2.5" aria-hidden />
            Prep {meal.mealPrep.portionIndex}/{meal.mealPrep.portionsCooked}
          </span>
        )}
        {trackingEntry && !showEatenSkip && (
          <span
            className={`inline-flex max-w-full items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal ring-1 ${trackingBadgeClass(trackingEntry.status)}`}
          >
            {trackingLabel(trackingEntry)}
          </span>
        )}
      </p>
      <h3
        className={`mt-1 line-clamp-2 break-words text-[15px] font-bold leading-snug [overflow-wrap:anywhere] transition-colors duration-300 ${
          trackingEntry?.status === "skipped" ? "text-slate-400 line-through" : "text-slate-900"
        }`}
      >
        {mealDisplayName(meal)}
      </h3>
      <p className="mt-0.5 line-clamp-1 text-xs capitalize text-slate-400">{tagLine(recipe)}</p>
      <div className="mt-2">
        <MealMacroLine kcal={kcal} protein={p} carbs={c} fat={f} fiber={fiber} compact />
      </div>
      {showEatenSkip && (
        <div className="mt-2.5 flex gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEaten?.();
            }}
            className={`min-h-[36px] flex-1 rounded-lg border text-xs font-semibold ${
              trackingEntry?.status === "all"
                ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            Eaten
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSkip?.();
            }}
            className={`min-h-[36px] flex-1 rounded-lg border text-xs font-semibold ${
              trackingEntry?.status === "skipped"
                ? "border-slate-400 bg-slate-100 text-slate-700"
                : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            Skip
          </button>
        </div>
      )}
    </div>
  );
}

function QuickAction({
  children,
  label,
  onClick,
  active,
  activeClass = "text-primary",
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  activeClass?: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-slate-50 ${
        active ? activeClass : "text-slate-400"
      }`}
    >
      {children}
    </button>
  );
}

export type MealDragPayload = {
  dateKey: string;
  slot: MealSlotId;
};

export function parseMealDragPayload(data: string): MealDragPayload | null {
  try {
    const parsed = JSON.parse(data) as MealDragPayload;
    if (parsed.dateKey && parsed.slot) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

export function mealDragPayload(dateKey: string, slot: MealSlotId): string {
  return JSON.stringify({ dateKey, slot });
}
