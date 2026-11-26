import { PauseQuestionsLink } from "@/components/PauseQuestionsLink";
import type { Question, QuestionAnswer } from "@/utils/questionQueue";

/** One short question: Yes / Not now / No. Nothing changes without a Yes. */
export function QuestionCard({
  question,
  onAnswer,
  onPaused,
}: {
  question: Question;
  onAnswer: (answer: QuestionAnswer) => void;
  /** Called after the user pauses questions from this card. */
  onPaused?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm" role="group" aria-label="Quick question">
      <p className="text-sm font-semibold text-slate-900">{question.text}</p>
      <p className="mt-0.5 text-xs text-slate-500">{question.why}</p>
      <div className="mt-2.5 flex gap-2">
        <button
          type="button"
          onClick={() => onAnswer("yes")}
          className="min-h-[40px] rounded-xl bg-[#2563EB] px-4 text-sm font-semibold text-white"
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onAnswer("not_now")}
          className="min-h-[40px] rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={() => onAnswer("no")}
          className="min-h-[40px] rounded-xl px-3 text-sm font-semibold text-slate-500"
        >
          No
        </button>
      </div>
      <PauseQuestionsLink onPaused={onPaused} />
    </div>
  );
}
