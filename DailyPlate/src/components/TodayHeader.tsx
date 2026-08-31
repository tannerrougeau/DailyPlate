import type { ReactNode } from "react";
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
  onSettings,
  trailing,
}: {
  viewDate: Date;
  onSettings?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <header className="mb-5 space-y-2 pt-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-slate-900">Today</h1>
          <p className="mt-0.5 truncate text-sm text-slate-500">{formatLongDate(viewDate)}</p>
        </div>
        <button
          type="button"
          onClick={onSettings}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-200/60 active:bg-slate-200"
          aria-label="Settings"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>
      {trailing && <div className="flex justify-center">{trailing}</div>}
    </header>
  );
}
