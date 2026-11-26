import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { resolvePendingBarcodes } from "@/utils/scan/scanClient";

/**
 * Barcodes read while offline are looked up when the app starts online or the connection comes
 * back. Found products go to My foods; nothing is logged by itself.
 */
export function PendingBarcodeNotice() {
  const pending = useAppStore((s) => s.pendingBarcodes);
  const setPending = useAppStore((s) => s.setPendingBarcodes);
  const saveMyFood = useAppStore((s) => s.saveMyFood);
  const [found, setFound] = useState<string[]>([]);

  useEffect(() => {
    if (pending.length === 0) return;
    let running = false;
    const run = async () => {
      if (running || (typeof navigator !== "undefined" && navigator.onLine === false)) return;
      running = true;
      try {
        const codes = useAppStore.getState().pendingBarcodes;
        const r = await resolvePendingBarcodes(codes, { saveFood: saveMyFood });
        // Keep any code added meanwhile.
        const latest = useAppStore.getState().pendingBarcodes.filter((c) => !codes.includes(c));
        setPending([...r.stillPending, ...latest]);
        if (r.found.length > 0) setFound((f) => [...f, ...r.found]);
      } finally {
        running = false;
      }
    };
    void run();
    window.addEventListener("online", run);
    return () => window.removeEventListener("online", run);
  }, [pending.length, saveMyFood, setPending]);

  if (found.length === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-20 z-[80] mx-auto flex max-w-md items-start gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-lg">
      <p className="flex-1">
        {found.length === 1
          ? `Found ${found[0]} from your earlier scan. It's in My foods.`
          : `Found ${found.length} foods from your earlier scans. They're in My foods.`}
      </p>
      <button
        type="button"
        onClick={() => setFound([])}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
