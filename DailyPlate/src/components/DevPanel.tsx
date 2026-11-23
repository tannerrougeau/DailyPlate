import { useState } from "react";
import { X } from "lucide-react";
import { useOverlayBack } from "@/hooks/useOverlayBack";
import { useAppStore } from "@/store/useAppStore";
import { BUILD_INFO } from "@/utils/buildInfo";

/** Clear the service worker and its caches, then reload so the newest build loads. */
async function forceAppUpdate() {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
    await Promise.all(regs.map((r) => r.update().catch(() => undefined)));
    await Promise.all(regs.map((r) => r.unregister()));
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } finally {
    window.location.reload();
  }
}

/** Hidden testing panel: opened by tapping the version in Settings 5 times. */
export function DevPanel({ onClose }: { onClose: () => void }) {
  useOverlayBack(true, onClose);
  const queue = useAppStore((s) => s.questionQueue);
  const log = useAppStore((s) => s.questionLog);
  const lastAsked = useAppStore((s) => s.lastQuestionAskedAt);
  const devShowNextQuestion = useAppStore((s) => s.devShowNextQuestion);
  const devResetQuestionTimers = useAppStore((s) => s.devResetQuestionTimers);
  const refreshQuestions = useAppStore((s) => s.refreshQuestions);
  const [note, setNote] = useState<string | null>(null);

  const button = "min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 text-left text-sm font-semibold text-slate-800";

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <section
        role="dialog"
        aria-labelledby="dev-panel-title"
        className="relative z-[121] max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-slate-300 bg-slate-50 p-4 shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-center justify-between">
          <h2 id="dev-panel-title" className="text-lg font-bold text-slate-900">
            Dev panel
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl bg-white p-3 text-xs">
          <dt className="text-slate-500">Version</dt>
          <dd className="font-mono">{BUILD_INFO.version}</dd>
          <dt className="text-slate-500">Commit</dt>
          <dd className="font-mono">{BUILD_INFO.commit}</dd>
          <dt className="text-slate-500">Built</dt>
          <dd className="font-mono">{BUILD_INFO.date ? new Date(BUILD_INFO.date).toLocaleString() : "—"}</dd>
          <dt className="text-slate-500">Last question</dt>
          <dd className="font-mono">{lastAsked ? new Date(lastAsked).toLocaleString() : "never"}</dd>
        </dl>

        <div className="mt-3 space-y-2">
          <button
            type="button"
            className={button}
            onClick={() => {
              const id = devShowNextQuestion();
              setNote(id ? `Showing "${id}" on Today. Close Settings to see it.` : "The queue is empty.");
            }}
          >
            Show the next queued question now
          </button>
          <button
            type="button"
            className={button}
            onClick={() => {
              devResetQuestionTimers();
              refreshQuestions();
              setNote("Question timers reset: 3-day spacing and all snoozes cleared.");
            }}
          >
            Reset question timers
          </button>
          <button type="button" className={button} onClick={() => void forceAppUpdate()}>
            Force an app update
          </button>
        </div>
        {note && <p className="mt-2 text-xs text-slate-600">{note}</p>}

        <h3 className="mt-4 text-sm font-semibold text-slate-900">Queue ({queue.length})</h3>
        {queue.length === 0 ? (
          <p className="text-xs text-slate-500">Empty.</p>
        ) : (
          <ol className="mt-1 space-y-1 text-xs">
            {queue.map((q) => (
              <li key={q.id} className="rounded-lg bg-white p-2">
                <span className="font-mono text-slate-500">{q.id}</span> · {q.source}
                <br />
                {q.text}
              </li>
            ))}
          </ol>
        )}

        <h3 className="mt-4 text-sm font-semibold text-slate-900">Answers</h3>
        {Object.keys(log).length === 0 ? (
          <p className="text-xs text-slate-500">None yet.</p>
        ) : (
          <ul className="mt-1 space-y-1 text-xs">
            {Object.entries(log).map(([id, e]) => (
              <li key={id} className="rounded-lg bg-white p-2 font-mono">
                {id}: {e.answer ?? "—"}
                {e.snoozeUntil ? ` · snoozed until ${new Date(e.snoozeUntil).toLocaleDateString()}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
