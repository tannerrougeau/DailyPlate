import { useDisplayPrefs } from "@/hooks/useDisplayPrefs";
import { useAppStore } from "@/store/useAppStore";
import { DISPLAY_ELEMENTS } from "@/utils/displayPrefs";

/** One switch per optional display element, plus Display history with Restore and Simplest view. */
export function DisplaySettings() {
  const display = useDisplayPrefs();
  const setDisplayPref = useAppStore((s) => s.setDisplayPref);
  const applySimplestView = useAppStore((s) => s.applySimplestView);
  const restoreCheckpoint = useAppStore((s) => s.restoreCheckpoint);
  const checkpoints = useAppStore((s) => s.checkpoints);

  return (
    <>
      <section className="space-y-3 border-b border-slate-100 pb-5" aria-labelledby="display-settings-title">
        <h3 id="display-settings-title" className="text-base font-semibold text-slate-900">
          Display
        </h3>
        <p className="text-sm text-slate-600">
          Choose what shows up. Marking meals eaten, swapping, regenerating and the grocery list are always available.
        </p>
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
          {DISPLAY_ELEMENTS.map((el) => (
            <li key={el.id}>
              <label className="flex min-h-[48px] items-center justify-between gap-3 px-3 text-sm text-slate-800">
                <span>{el.label}</span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={display[el.id]}
                  onChange={(e) => setDisplayPref(el.id, e.target.checked)}
                  className="h-5 w-5 shrink-0 accent-[#2563EB]"
                />
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 border-b border-slate-100 pb-5" aria-labelledby="display-history-title">
        <div className="flex items-center justify-between gap-2">
          <h3 id="display-history-title" className="text-base font-semibold text-slate-900">
            Display history
          </h3>
          <button
            type="button"
            onClick={() => applySimplestView()}
            className="min-h-[36px] rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700"
          >
            Simplest view
          </button>
        </div>
        {checkpoints.length === 0 ? (
          <p className="text-sm text-slate-500">No changes yet. Each change you make or accept is saved here.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
            {checkpoints.map((cp) => (
              <li key={cp.id} className="flex items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900">{cp.what}</span>
                  <span className="block text-xs text-slate-500">
                    {new Date(cp.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {cp.why}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => restoreCheckpoint(cp.id)}
                  className="shrink-0 text-sm font-semibold text-[#2563EB]"
                  aria-label={`Restore how things were before: ${cp.what}`}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
