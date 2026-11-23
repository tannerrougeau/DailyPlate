import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import type { PauseChoice } from "@/utils/questionQueue";

export const PAUSE_CHOICES: { id: PauseChoice; label: string }[] = [
  { id: "week", label: "1 week" },
  { id: "month", label: "1 month" },
  { id: "indefinite", label: "Until I resume" },
];

/** Small "Pause questions" link on question and suggestion cards. */
export function PauseQuestionsLink({ onPaused }: { onPaused?: () => void }) {
  const pauseQuestions = useAppStore((s) => s.pauseQuestions);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 text-xs font-semibold text-slate-500 underline">
        Pause questions
      </button>
    );
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs" role="group" aria-label="Pause questions for">
      <span className="text-slate-500">Pause for</span>
      {PAUSE_CHOICES.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => {
            pauseQuestions(c.id);
            onPaused?.();
          }}
          className="min-h-[32px] rounded-lg border border-slate-200 px-2.5 font-semibold text-slate-700"
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
