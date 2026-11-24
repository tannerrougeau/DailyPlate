import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { clearCorrections, countCorrections } from "@/utils/scan/corrections";

/** Settings → Scanning: "Help improve scanning" (off by default; everything stays on this device). */
export function ScanSettings() {
  const on = useAppStore((s) => s.scanCorrections);
  const setOn = useAppStore((s) => s.setScanCorrections);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    void countCorrections().then((n) => live && setCount(n));
    return () => {
      live = false;
    };
  }, [on]);

  return (
    <section className="space-y-2 border-b border-slate-100 pb-5">
      <h3 className="text-base font-semibold text-slate-900">Scanning</h3>
      <label className="flex items-start justify-between gap-3">
        <span>
          <span className="block text-sm font-semibold text-slate-800">Help improve scanning</span>
          <span className="block text-xs leading-relaxed text-slate-500">
            Saves scan photos and your corrections on this device only, to help improve scanning.
          </span>
        </span>
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 accent-[#2563EB]"
        />
      </label>
      {count != null && count > 0 && (
        <p className="text-xs text-slate-600">
          {count} saved ·{" "}
          <button
            type="button"
            onClick={() => void clearCorrections().then(() => setCount(0))}
            className="font-semibold text-[#2563EB]"
          >
            Delete saved scans
          </button>
        </p>
      )}
    </section>
  );
}
