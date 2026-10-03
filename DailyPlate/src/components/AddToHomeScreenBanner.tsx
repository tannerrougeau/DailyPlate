import { useEffect, useState } from "react";
import { Share, Smartphone, X } from "lucide-react";

const STORAGE_KEY = "dailyplate-a2hs-dismissed";

function isInstalledPwa(): boolean {
  if (typeof window === "undefined") return false;
  const standalone = window.matchMedia("(display-mode: standalone)").matches
    || window.matchMedia("(display-mode: fullscreen)").matches
    || window.matchMedia("(display-mode: minimal-ui)").matches;
  const iosStandalone = "standalone" in window.navigator && (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone || Boolean(iosStandalone);
}

export function AddToHomeScreenBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isInstalledPwa()) return;
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      /* ignore */
    }
    setVisible(true);
  }, []);

  if (!visible) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  return (
    <div className="border-b border-sky-200 bg-sky-50 px-4 py-3">
      <div className="mx-auto flex max-w-lg items-start gap-3">
        <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-sky-950">Add DailyPlate to your Home Screen</p>
          <p className="mt-1 text-xs leading-relaxed text-sky-900">
            <span className="font-semibold">Android:</span> Chrome → ⋮ → Install app
          </p>
          <p className="mt-0.5 flex items-start gap-1 text-xs leading-relaxed text-sky-900">
            <Share className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              <span className="font-semibold">iPhone:</span> Safari → Share → Add to Home Screen
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sky-800 hover:bg-sky-100"
          aria-label="Dismiss add to home screen tip"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
