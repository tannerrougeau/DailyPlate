import { useState } from "react";

export function ClearDatesButton({
  onClear,
  disabled = false,
  className = "",
}: {
  onClear: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const [flash, setFlash] = useState(false);

  function handleClick() {
    if (disabled || flash) return;
    setFlash(true);
    window.setTimeout(() => {
      onClear();
      setFlash(false);
    }, 220);
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      className={`rounded-full border-2 border-red-500 px-2.5 py-0.5 text-[11px] font-semibold transition-colors disabled:opacity-40 ${
        flash ? "bg-red-500 text-white" : "bg-white text-red-700"
      } ${className}`}
    >
      {flash ? "✓ Clear Dates" : "Clear Dates"}
    </button>
  );
}
