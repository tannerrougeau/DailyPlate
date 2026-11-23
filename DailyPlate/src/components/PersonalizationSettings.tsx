import { useAppStore } from "@/store/useAppStore";
import { PAUSE_CHOICES } from "@/components/PauseQuestionsLink";
import { isPaused, pauseLabel } from "@/utils/questionQueue";

export const BASIC_MODE_COPY =
  "Straightforward plans sized to your targets. No questions or suggestions. Your likes, dislikes and swaps still count.";

/** Settings → Personalization: Basic mode and pausing questions. Changes apply right away. */
export function PersonalizationSettings() {
  const profile = useAppStore((s) => s.userProfile);
  const setBasicMode = useAppStore((s) => s.setBasicMode);
  const pauseQuestions = useAppStore((s) => s.pauseQuestions);
  const resumeQuestions = useAppStore((s) => s.resumeQuestions);
  if (!profile) return null;
  const basic = Boolean(profile.basicMode);
  const paused = isPaused(profile.questionsPausedUntil, new Date());
  return (
    <section className="space-y-3 border-b border-slate-100 pb-5">
      <h3 className="text-base font-semibold text-slate-900">Personalization</h3>
      <label className="flex items-start justify-between gap-3">
        <span>
          <span className="block text-sm font-semibold text-slate-800">Basic mode</span>
          <span className="block text-xs leading-relaxed text-slate-500">{BASIC_MODE_COPY}</span>
        </span>
        <input
          type="checkbox"
          checked={basic}
          onChange={(e) => setBasicMode(e.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 accent-[#2563EB]"
        />
      </label>
      {!basic && (
        <div>
          <p className="text-sm font-semibold text-slate-800">Pause questions</p>
          {paused ? (
            <p className="mt-1 text-sm text-slate-600">
              {pauseLabel(profile.questionsPausedUntil)} ·{" "}
              <button type="button" onClick={resumeQuestions} className="font-semibold text-[#2563EB]">
                Resume
              </button>
            </p>
          ) : (
            <div className="mt-1.5 flex flex-wrap gap-2">
              {PAUSE_CHOICES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pauseQuestions(c.id)}
                  className="min-h-[36px] rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700"
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
          <p className="mt-1.5 text-xs text-slate-500">Questions are always optional. Skip or pause them anytime.</p>
        </div>
      )}
    </section>
  );
}
