import { useAppStore } from "@/store/useAppStore";
import { resolveDisplayPrefs, type DisplayPrefs } from "@/utils/displayPrefs";

/** The user's display switches (missing ones default to on, so nothing disappears for older saves). */
export function useDisplayPrefs(): DisplayPrefs {
  const stored = useAppStore((s) => s.displayPrefs);
  return resolveDisplayPrefs(stored);
}
