import { useEffect, useState } from "react";
import { reloadToNewVersion, UPDATE_AVAILABLE_EVENT } from "@/utils/swUpdate";

/** Shown only if a new version is installed but couldn't take over on its own. */
export function UpdateBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(true);
    window.addEventListener(UPDATE_AVAILABLE_EVENT, on);
    return () => window.removeEventListener(UPDATE_AVAILABLE_EVENT, on);
  }, []);
  if (!show) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-[130] flex justify-center px-4 pt-3 lg:pl-60">
      <div className="flex items-center gap-3 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-xl">
        <span>New version available.</span>
        <button type="button" onClick={() => void reloadToNewVersion()} className="font-bold text-emerald-300">
          Reload
        </button>
      </div>
    </div>
  );
}
