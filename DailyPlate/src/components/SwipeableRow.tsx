import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { RefreshCw, Shuffle } from "lucide-react";

const SWIPE_THRESHOLD = 72;
const MAX_OFFSET = 96;

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("button, a, input, textarea, select, label"));
}

type SwipeableRowProps = {
  children: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  disabled?: boolean;
  leftLabel?: string;
  rightLabel?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  leftActionClassName?: string;
  rightActionClassName?: string;
  roundedClassName?: string;
};

export function SwipeableRow({
  children,
  onSwipeLeft,
  onSwipeRight,
  disabled = false,
  leftLabel = "Regenerate",
  rightLabel = "Swap",
  leftIcon = <RefreshCw className="ml-1.5 h-4 w-4" />,
  rightIcon = <Shuffle className="mr-1.5 h-4 w-4" />,
  leftActionClassName = "bg-red-500/90",
  rightActionClassName = "bg-emerald-500/90",
  roundedClassName = "rounded-2xl",
}: SwipeableRowProps) {
  const [offset, setOffset] = useState(0);
  const draggingRef = useRef(false);
  const offsetRef = useRef(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const axisLocked = useRef<"x" | "y" | null>(null);

  const reset = useCallback(() => {
    draggingRef.current = false;
    offsetRef.current = 0;
    axisLocked.current = null;
    setOffset(0);
  }, []);

  const handlePointerDown = (event: ReactPointerEvent) => {
    if (disabled || event.button !== 0 || isInteractiveTarget(event.target)) return;
    startX.current = event.clientX;
    startY.current = event.clientY;
    axisLocked.current = null;
    draggingRef.current = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent) => {
    if (!draggingRef.current || disabled) return;
    if (isInteractiveTarget(event.target)) {
      reset();
      return;
    }
    const dx = event.clientX - startX.current;
    const dy = event.clientY - startY.current;

    if (!axisLocked.current) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      axisLocked.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (axisLocked.current === "y") {
        reset();
        return;
      }
    }

    const clamped = dx > 0 ? Math.min(MAX_OFFSET, dx) : Math.max(-MAX_OFFSET, dx);
    offsetRef.current = clamped;
    setOffset(clamped);
  };

  const handlePointerUp = (event: ReactPointerEvent) => {
    if (!draggingRef.current) return;
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }

    const currentOffset = offsetRef.current;
    if (currentOffset <= -SWIPE_THRESHOLD && onSwipeLeft) {
      onSwipeLeft();
    } else if (currentOffset >= SWIPE_THRESHOLD && onSwipeRight) {
      onSwipeRight();
    }
    reset();
  };

  return (
    <div className={`relative overflow-hidden ${roundedClassName}`}>
      <div
        className="pointer-events-none absolute inset-0 flex items-stretch justify-between"
        aria-hidden
      >
        {onSwipeRight && (
          <div
            className={`flex min-w-[88px] items-center justify-start px-4 text-xs font-semibold text-white transition-opacity ${rightActionClassName} ${
              offset > 20 ? "opacity-100" : "opacity-0"
            }`}
          >
            {rightIcon}
            {rightLabel}
          </div>
        )}
        {onSwipeLeft && (
          <div
            className={`ml-auto flex min-w-[88px] items-center justify-end px-4 text-xs font-semibold text-white transition-opacity ${leftActionClassName} ${
              offset < -20 ? "opacity-100" : "opacity-0"
            }`}
          >
            {leftLabel}
            {leftIcon}
          </div>
        )}
      </div>
      <div
        className={`relative touch-pan-y ${offset !== 0 ? "transition-none" : "transition-transform duration-200 ease-out"}`}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={reset}
        onLostPointerCapture={reset}
      >
        {children}
      </div>
    </div>
  );
}
