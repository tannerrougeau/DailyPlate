/**
 * Keeping a dropdown's header where it was when it opens or closes. Without this, content
 * inserted above the browser's scroll anchor (often the sticky bottom bar) pushes the page down,
 * so a dropdown seems to jump to the bottom instead of opening in place.
 */

/** How far to scroll so the header returns to where it was (positive = scroll down). */
export function scrollCorrection(beforeTop: number, afterTop: number): number {
  const d = afterTop - beforeTop;
  return Math.abs(d) < 1 ? 0 : d;
}

type ScrollBox = { scrollTop: number; scrollHeight: number; clientHeight: number };

/** Nearest ancestor that scrolls on its own (a sheet), or null for the page itself. */
export function scrollParent(el: HTMLElement | null): (HTMLElement & ScrollBox) | null {
  let node = el?.parentElement ?? null;
  while (node && node !== document.body && node !== document.documentElement) {
    const style = window.getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return null;
}

/** Scroll the header's container so the header sits at `beforeTop` again. */
export function restoreAnchor(el: HTMLElement, beforeTop: number): void {
  const d = scrollCorrection(beforeTop, el.getBoundingClientRect().top);
  if (d === 0) return;
  const box = scrollParent(el);
  if (box) box.scrollTop += d;
  else window.scrollBy(0, d);
}

/**
 * Run a dropdown toggle, then (after React renders it, before the next paint) scroll the header
 * back to where it was. Use as `onClick={(e) => keepInPlace(e.currentTarget, () => setOpen(!open))}`.
 */
export function keepInPlace(el: HTMLElement, toggle: () => void): void {
  const before = el.getBoundingClientRect().top;
  toggle();
  window.requestAnimationFrame(() => {
    if (el.isConnected) restoreAnchor(el, before);
  });
}
