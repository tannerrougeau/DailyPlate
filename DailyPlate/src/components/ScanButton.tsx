import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { SCAN_PRIVACY_NOTE } from "@/utils/scan/scanFlow";
import { warmBarcodeReader } from "@/utils/scan/barcode";

/**
 * Scan: opens the rear camera directly ("Upload a photo" picks a file instead). The first scan on
 * this device shows a one-time note that photos go to the AI provider.
 */
export function ScanButton({ onPhoto }: { onPhoto: (file: File) => void }) {
  const noticeSeen = useAppStore((s) => s.scanNoticeSeen);
  const acknowledge = useAppStore((s) => s.acknowledgeScanNotice);
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<"camera" | "upload" | null>(null);

  function open(kind: "camera" | "upload") {
    warmBarcodeReader();
    if (!noticeSeen) {
      setPending(kind);
      return;
    }
    (kind === "camera" ? cameraRef : uploadRef).current?.click();
  }

  function picked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // the same photo can be picked again
    if (file) onPhoto(file);
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => open("camera")}
          className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[#2563EB] px-4 text-sm font-semibold text-[#2563EB]"
        >
          <Camera className="h-4 w-4" aria-hidden />
          Scan
        </button>
        <button type="button" onClick={() => open("upload")} className="text-xs font-semibold text-slate-500">
          Upload a photo
        </button>
      </div>
      <p className="mt-1 text-[11px] text-slate-400">A meal, a Nutrition Facts label or a barcode.</p>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={picked} />
      <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={picked} />

      {pending && (
        <div role="dialog" aria-label="About scanning" className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm leading-relaxed text-slate-700">{SCAN_PRIVACY_NOTE}</p>
          <button
            type="button"
            onClick={() => {
              acknowledge();
              const kind = pending;
              setPending(null);
              // Still inside the tap, so the camera or file picker is allowed to open.
              (kind === "camera" ? cameraRef : uploadRef).current?.click();
            }}
            className="mt-2 min-h-[40px] rounded-xl bg-[#2563EB] px-5 text-sm font-semibold text-white"
          >
            OK
          </button>
        </div>
      )}
    </div>
  );
}
