import { useState } from "react";
import { X } from "lucide-react";
import type { MealTrackingEntry, MealTrackingStatus, PlannedMeal } from "@/types";
import { mealDisplayName } from "@/utils/recipeDisplay";
import { useOverlayBack } from "@/hooks/useOverlayBack";

const QUICK_OPTIONS: { status: MealTrackingStatus; label: string; hint: string }[] = [
  { status: "all", label: "Ate All", hint: "Full meal logged" },
  { status: "half", label: "Ate Half", hint: "50% of macros" },
  { status: "skipped", label: "Skipped", hint: "Not eaten" },
];

export function MealTrackingSheet({
  meal,
  existing,
  onClose,
  onSave,
  onClear,
}: {
  meal: PlannedMeal;
  existing?: MealTrackingEntry;
  onClose: () => void;
  onSave: (entry: MealTrackingEntry) => void;
  onClear: () => void;
}) {
  useOverlayBack(true, onClose);
  const [note, setNote] = useState(existing?.note ?? "");
  const [showNote, setShowNote] = useState(existing?.status === "custom");

  function saveQuick(status: MealTrackingStatus) {
    onSave({ status, loggedAt: new Date().toISOString() });
    onClose();
  }

  function saveCustom() {
    const trimmed = note.trim();
    if (!trimmed) return;
    onSave({
      status: "custom",
      note: trimmed.slice(0, 120),
      loggedAt: new Date().toISOString(),
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-labelledby="meal-tracking-title"
        className="relative z-[86] w-full max-w-lg rounded-t-3xl border border-slate-200 bg-white p-4 shadow-2xl sm:rounded-3xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Log meal
            </p>
            <h2 id="meal-tracking-title" className="mt-0.5 text-lg font-bold text-slate-900">
              {mealDisplayName(meal)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {QUICK_OPTIONS.map((opt) => (
            <button
              key={opt.status}
              type="button"
              onClick={() => saveQuick(opt.status)}
              className={`flex min-h-[72px] flex-col items-center justify-center rounded-2xl border-2 px-2 py-3 text-center transition-all active:scale-[0.98] ${
                existing?.status === opt.status
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span className="text-sm font-bold">{opt.label}</span>
              <span className="mt-1 text-[10px] font-medium text-slate-400">{opt.hint}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
          {!showNote ? (
            <button
              type="button"
              onClick={() => setShowNote(true)}
              className="w-full text-left text-sm font-semibold text-slate-600 hover:text-slate-900"
            >
              + Add a short note
            </button>
          ) : (
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Short note
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. ate out, smaller portion…"
                maxLength={120}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                autoFocus
              />
              <button
                type="button"
                disabled={!note.trim()}
                onClick={saveCustom}
                className="min-h-[40px] w-full rounded-xl bg-primary text-sm font-semibold text-white disabled:opacity-40"
              >
                Save note
              </button>
            </div>
          )}
        </div>

        {existing && (
          <button
            type="button"
            onClick={() => {
              onClear();
              onClose();
            }}
            className="mt-3 w-full py-2 text-center text-sm font-medium text-slate-400 hover:text-slate-600"
          >
            Clear log
          </button>
        )}
      </section>
    </div>
  );
}
