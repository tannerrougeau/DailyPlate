import { useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, Settings, RefreshCw, X } from "lucide-react";
import { useOverlayBack } from "@/hooks/useOverlayBack";

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
  onRegenerate,
}: {
  viewDate: Date;
  householdChip: string;
  onHousehold: () => void;
  onSettings: () => void;
  onRegenerate: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

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
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-200/60 active:bg-slate-200"
          aria-label="More"
          aria-expanded={menuOpen}
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>

      {menuOpen &&
        createPortal(
          <TodayOverflowMenu
            onClose={() => setMenuOpen(false)}
            onSettings={() => {
              setMenuOpen(false);
              onSettings();
            }}
            onRegenerate={() => {
              setMenuOpen(false);
              onRegenerate();
            }}
          />,
          document.body,
        )}
    </header>
  );
}

function TodayOverflowMenu({
  onClose,
  onSettings,
  onRegenerate,
}: {
  onClose: () => void;
  onSettings: () => void;
  onRegenerate: () => void;
}) {
  useOverlayBack(true, onClose);
  return (
    <div className="fixed inset-0 z-[88] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close menu"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-labelledby="today-overflow-title"
        className="relative z-[89] w-full max-w-lg rounded-t-3xl border border-slate-200 bg-white p-2 shadow-2xl sm:rounded-3xl sm:p-3"
      >
        <div className="flex items-start justify-between gap-3 px-3 pb-1 pt-2">
          <h2 id="today-overflow-title" className="text-base font-bold text-slate-900">
            Today
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <button
          type="button"
          onClick={onSettings}
          className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-3 text-left hover:bg-slate-50"
        >
          <Settings className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-900">Settings</span>
        </button>
        <button
          type="button"
          onClick={onRegenerate}
          className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-3 text-left hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-900">Regenerate Today</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-1 w-full rounded-2xl py-3 text-center text-sm font-semibold text-slate-500 hover:bg-slate-50"
        >
          Cancel
        </button>
      </section>
    </div>
  );
}
