import { Settings } from "lucide-react";

function formatLongDate(d: Date) {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function TodayHeader({
  viewDate,
  householdChip,
  onHousehold,
  onSettings,
}: {
  viewDate: Date;
  householdChip: string;
  onHousehold: () => void;
  onSettings: () => void;
}) {
  return (
    <header className="mb-3 pt-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-slate-500">{formatLongDate(viewDate)}</p>
          <button
            type="button"
            onClick={onHousehold}
            className="mt-1 inline-flex max-w-full items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm hover:border-slate-300 hover:text-slate-900"
          >
            <span className="truncate">{householdChip}</span>
          </button>
        </div>
        {/* Regenerate today now sits under the meals; Settings is the only thing left up here. */}
        <button
          type="button"
          onClick={onSettings}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-200/60 active:bg-slate-200"
          aria-label="Settings"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
