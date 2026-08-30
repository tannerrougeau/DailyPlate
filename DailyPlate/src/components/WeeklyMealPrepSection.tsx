import type { MealSlotId } from "@/types";
import type { WeeklyMealPrepRepeatCount } from "@/types/profile";

const REPEAT_OPTIONS: { id: WeeklyMealPrepRepeatCount; label: string }[] = [
  { id: 2, label: "2 days" },
  { id: 3, label: "3 days" },
  { id: 4, label: "4 days" },
];

type WeeklyMealPrepSectionProps = {
  enabled: boolean;
  slot: MealSlotId | null;
  repeatCount: WeeklyMealPrepRepeatCount;
  onEnabledChange: (enabled: boolean) => void;
  onSlotChange: (slot: MealSlotId) => void;
  onRepeatCountChange: (count: WeeklyMealPrepRepeatCount) => void;
};

export function WeeklyMealPrepSection({
  enabled,
  slot,
  repeatCount,
  onEnabledChange,
  onSlotChange,
  onRepeatCountChange,
}: WeeklyMealPrepSectionProps) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <h3 className="text-lg font-semibold text-slate-900">Weekly meal prep</h3>
      <p className="text-sm text-slate-600">
        When you generate a week or month, repeat one lunch or dinner recipe across several days
        (great for batch cooking).
      </p>
      <button
        type="button"
        onClick={() => onEnabledChange(!enabled)}
        className={`min-h-[52px] w-full rounded-2xl border-2 px-4 text-left text-sm font-semibold ${
          enabled
            ? "border-[#2563EB] bg-blue-50 text-blue-900"
            : "border-slate-200 bg-white text-slate-800"
        }`}
      >
        {enabled ? "Weekly prep enabled" : "Enable weekly meal prep"}
      </button>
      {enabled && (
        <>
          <p className="text-xs font-medium text-slate-500">Which meal to batch?</p>
          <div className="flex gap-2">
            {(["lunch", "dinner"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSlotChange(s)}
                className={`min-h-[48px] flex-1 rounded-2xl border-2 text-sm font-semibold capitalize ${
                  slot === s
                    ? "border-[#2563EB] bg-blue-50 text-blue-900"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <p className="text-xs font-medium text-slate-500">Repeat how many days per week?</p>
          <div className="flex gap-2">
            {REPEAT_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => onRepeatCountChange(o.id)}
                className={`min-h-[48px] flex-1 rounded-2xl border-2 text-sm font-semibold ${
                  repeatCount === o.id
                    ? "border-[#2563EB] bg-blue-50 text-blue-900"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
