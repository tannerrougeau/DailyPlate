import {
  HOUSEHOLD_ADULTS_MAX,
  HOUSEHOLD_ADULTS_MIN,
  HOUSEHOLD_CHILDREN_MAX,
  HOUSEHOLD_CHILDREN_MIN,
} from "@/utils/household";

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-sm font-semibold text-slate-800">{label}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Decrease ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-lg font-semibold text-slate-700 disabled:opacity-30"
        >
          −
        </button>
        <span className="w-6 text-center text-lg font-bold tabular-nums text-slate-900">{value}</span>
        <button
          type="button"
          aria-label={`Increase ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-lg font-semibold text-slate-700 disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function HouseholdPicker({
  adults,
  childrenCount,
  onAdultsChange,
  onChildrenChange,
  compact = false,
}: {
  adults: number;
  childrenCount: number;
  onAdultsChange: (n: number) => void;
  onChildrenChange: (n: number) => void;
  compact?: boolean;
}) {
  return (
    <div className="space-y-3">
      {!compact && (
        <p className="text-sm leading-relaxed text-slate-600">
          We scale grocery, servings, and prep for the household. Adult plates are full servings;
          child plates default smaller. Your calorie target stays yours.
        </p>
      )}
      <Stepper
        label="Adults"
        value={adults}
        min={HOUSEHOLD_ADULTS_MIN}
        max={HOUSEHOLD_ADULTS_MAX}
        onChange={onAdultsChange}
      />
      <Stepper
        label="Children"
        value={childrenCount}
        min={HOUSEHOLD_CHILDREN_MIN}
        max={HOUSEHOLD_CHILDREN_MAX}
        onChange={onChildrenChange}
      />
      {compact && (
        <p className="text-xs text-slate-500">
          Child plates start smaller than the adult serving.
        </p>
      )}
    </div>
  );
}
