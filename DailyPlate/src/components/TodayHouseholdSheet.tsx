import { useState } from "react";
import { X } from "lucide-react";
import { HouseholdPicker } from "@/components/HouseholdPicker";
import { useOverlayBack } from "@/hooks/useOverlayBack";
import {
  clampAdults,
  clampChildren,
  resolveHouseholdCounts,
  type HouseholdDayCounts,
} from "@/utils/household";
import type { HouseholdProfileFields } from "@/utils/household";

export function TodayHouseholdSheet({
  profile,
  current,
  onSave,
  onReset,
  onClose,
}: {
  profile: HouseholdProfileFields | null;
  current: HouseholdDayCounts;
  onSave: (counts: HouseholdDayCounts) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  useOverlayBack(true, onClose);
  const usual = resolveHouseholdCounts(profile);
  const [adults, setAdults] = useState(current.adults);
  const [childrenCount, setChildrenCount] = useState(current.children);

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-labelledby="today-household-title"
        className="relative z-[86] w-full max-w-lg rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:rounded-3xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="today-household-title" className="text-lg font-bold text-slate-900">
              Cooking for today
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              Changes people count for today only. Does not change your usual household in
              onboarding or Settings.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <HouseholdPicker
          adults={adults}
          childrenCount={childrenCount}
          onAdultsChange={setAdults}
          onChildrenChange={setChildrenCount}
          compact
        />
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              onSave({
                adults: clampAdults(adults),
                children: clampChildren(childrenCount),
              });
              onClose();
            }}
            className="min-h-[48px] w-full rounded-2xl bg-[#2563EB] text-base font-semibold text-white"
          >
            Use for today
          </button>
          <button
            type="button"
            onClick={() => {
              onReset();
              onClose();
            }}
            className="min-h-[44px] w-full rounded-2xl border border-slate-200 text-sm font-semibold text-slate-700"
          >
            Reset to usual ({usual.adults} adult{usual.adults === 1 ? "" : "s"}
            {usual.children > 0
              ? `, ${usual.children} child${usual.children === 1 ? "" : "ren"}`
              : ""}
            )
          </button>
        </div>
      </section>
    </div>
  );
}
