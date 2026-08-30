import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Settings } from "lucide-react";

function formatLongDate(d: Date) {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function TodayHeader({
  viewDate,
  onPrevDay,
  onNextDay,
  onSettings,
  trailing,
}: {
  viewDate: Date;
  onPrevDay: () => void;
  onNextDay: () => void;
  onSettings?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <header className="mb-5 space-y-2 pt-2">
    <div className="grid grid-cols-[44px_1fr_88px] items-center gap-1">
      <button
        type="button"
        onClick={onPrevDay}
        className="flex h-11 w-11 items-center justify-center justify-self-start rounded-full text-slate-600 transition-colors hover:bg-slate-200/60 active:bg-slate-200"
        aria-label="Previous day"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <div className="min-w-0 text-center">
        <h1 className="truncate text-lg font-semibold text-slate-900">Today</h1>
        <p className="mt-0.5 truncate text-sm text-slate-500">{formatLongDate(viewDate)}</p>
      </div>
      <div className="flex items-center justify-end gap-0.5 justify-self-end">
        <button
          type="button"
          onClick={onNextDay}
          className="flex h-11 w-11 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-200/60 active:bg-slate-200"
          aria-label="Next day"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
        <button
          type="button"
          onClick={onSettings}
          className="flex h-11 w-11 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-200/60 active:bg-slate-200"
          aria-label="Settings"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>
    </div>
    {trailing && <div className="flex justify-center">{trailing}</div>}
    </header>
  );
}
