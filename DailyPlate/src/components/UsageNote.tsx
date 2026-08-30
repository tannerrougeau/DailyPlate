export function UsageNote({
  text,
  onDismiss,
}: {
  text: string;
  onDismiss: () => void;
}) {
  return (
    <div className="mb-4 flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white px-3 py-2.5 text-sm text-slate-600 shadow-sm">
      <p className="flex-1 leading-relaxed">{text}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50"
      >
        Got it
      </button>
    </div>
  );
}
