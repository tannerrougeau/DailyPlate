import { useEffect, useRef } from "react";

type CloseFn = () => void;

const stack: CloseFn[] = [];
let listenerBound = false;
let ignorePop = 0;

function onPopState() {
  if (ignorePop > 0) {
    ignorePop -= 1;
    return;
  }
  const close = stack.pop();
  close?.();
}

function ensureListener() {
  if (listenerBound) return;
  listenerBound = true;
  window.addEventListener("popstate", onPopState);
}

/**
 * Push a history entry while an overlay / expanded view is open so Android /
 * browser Back closes it instead of leaving the app.
 */
export function useOverlayBack(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    ensureListener();
    let closedByPop = false;
    const close: CloseFn = () => {
      closedByPop = true;
      onCloseRef.current();
    };
    stack.push(close);
    history.pushState({ ...(history.state ?? {}), dpOverlay: true }, "");

    return () => {
      const idx = stack.lastIndexOf(close);
      if (idx >= 0) stack.splice(idx, 1);
      if (!closedByPop) {
        ignorePop += 1;
        history.back();
      }
    };
  }, [open]);
}
