import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { MicronutrientHit } from "@/utils/micronutrients";

export function MicronutrientDetails({ items }: { items: MicronutrientHit[] }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-[36px] w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left"
      >
        <span className="text-sm font-semibold text-slate-800">Micronutrients</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180 text-[#2563EB]" : ""}`}
          aria-hidden
        />
      </button>
      {open && (
        <ul className="mt-2 space-y-1 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
          {items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span>{item.label}</span>
              <span className="font-semibold tabular-nums text-slate-800">{item.amountLabel}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
