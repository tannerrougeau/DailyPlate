import type { ReactNode } from "react";
import {
  ArrowLeftRight,
  ChefHat,
  Heart,
  Lock,
  MessageSquarePlus,
  Shuffle,
  Trash2,
  Utensils,
  X,
} from "lucide-react";
import type { PlannedMeal } from "@/types";
import { mealDisplayName } from "@/utils/recipeDisplay";
import { useOverlayBack } from "@/hooks/useOverlayBack";

type MealActionsMenuProps = {
  meal: PlannedMeal;
  dateKey: string;
  favorite: boolean;
  mealLocked: boolean;
  dayLocked: boolean;
  actionsDisabled: boolean;
  onClose: () => void;
  onReplace: () => void;
  onRegenerate: () => void;
  onRemove: () => void;
  onAddNote?: () => void;
  onToggleFavorite: () => void;
  onToggleLock: () => void;
  onMealPrep?: () => void;
  onDetails?: () => void;
};

export function MealActionsMenu({
  meal,
  favorite,
  mealLocked,
  dayLocked,
  actionsDisabled,
  onClose,
  onReplace,
  onRegenerate,
  onRemove,
  onAddNote,
  onToggleFavorite,
  onToggleLock,
  onMealPrep,
  onDetails,
}: MealActionsMenuProps) {
  useOverlayBack(true, onClose);
  function run(action: () => void) {
    action();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[88] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close menu"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-labelledby="meal-actions-title"
        className="relative z-[89] w-full max-w-lg rounded-t-3xl border border-slate-200 bg-white p-2 shadow-2xl sm:rounded-3xl sm:p-3"
      >
        <div className="flex items-start justify-between gap-3 px-3 pb-2 pt-2">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Meal actions
            </p>
            <h2 id="meal-actions-title" className="mt-0.5 truncate text-base font-bold text-slate-900">
              {mealDisplayName(meal)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-1">
          <MenuAction
            icon={<ArrowLeftRight className="h-5 w-5" />}
            label="Replace meal"
            hint="Pick a recipe from your library"
            disabled={actionsDisabled}
            onClick={() => run(onReplace)}
          />
          <MenuAction
            icon={<Shuffle className="h-5 w-5" />}
            label="Regenerate meal"
            hint="New random pick for this slot"
            disabled={actionsDisabled}
            onClick={() => run(onRegenerate)}
          />
          <MenuAction
            icon={<Trash2 className="h-5 w-5" />}
            label="Remove meal"
            hint="Remove from today and your plan"
            disabled={actionsDisabled}
            destructive
            onClick={() => run(onRemove)}
          />
          {onAddNote && (
            <MenuAction
              icon={<MessageSquarePlus className="h-5 w-5" />}
              label="Add note"
              hint="Log what you ate or add a note"
              onClick={() => run(onAddNote)}
            />
          )}
          <MenuAction
            icon={<Heart className={`h-5 w-5 ${favorite ? "fill-current text-red-500" : ""}`} />}
            label={favorite ? "Remove favorite" : "Favorite"}
            hint="Save to your favorites"
            onClick={() => run(onToggleFavorite)}
          />

          <div className="my-2 border-t border-slate-100" />

          <MenuAction
            icon={<Lock className="h-5 w-5" />}
            label={mealLocked ? "Unlock meal" : "Lock meal"}
            hint={mealLocked ? "Allow edits again" : "Keep when regenerating"}
            disabled={dayLocked}
            onClick={() => run(onToggleLock)}
          />
          {onMealPrep && (
            <MenuAction
              icon={<ChefHat className="h-5 w-5" />}
              label="Meal prep"
              hint="Batch cook this recipe"
              disabled={actionsDisabled}
              onClick={() => run(onMealPrep)}
            />
          )}
          {onDetails && (
            <MenuAction
              icon={<Utensils className="h-5 w-5" />}
              label="Recipe/Prep details"
              hint="Ingredients, macros, and variations"
              onClick={() => run(onDetails)}
            />
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full rounded-2xl py-3 text-center text-sm font-semibold text-slate-500 hover:bg-slate-50"
        >
          Cancel
        </button>
      </section>
    </div>
  );
}

function MenuAction({
  icon,
  label,
  hint,
  onClick,
  disabled,
  destructive,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors disabled:opacity-40 ${
        destructive ? "hover:bg-red-50" : "hover:bg-slate-50"
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          destructive ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block text-sm font-semibold ${destructive ? "text-red-700" : "text-slate-900"}`}
        >
          {label}
        </span>
        <span className="block truncate text-xs text-slate-400">{hint}</span>
      </span>
    </button>
  );
}
