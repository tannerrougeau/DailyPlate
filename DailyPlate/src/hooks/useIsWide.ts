import { useEffect, useState } from "react";

/** Tailwind's lg breakpoint (1024 px). */
const WIDE_QUERY = "(min-width: 1024px)";

/** True on wide screens, where panels show inline instead of as overlays. */
export function useIsWide(): boolean {
  const [wide, setWide] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(WIDE_QUERY).matches
      : false,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(WIDE_QUERY);
    const onChange = () => setWide(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return wide;
}
