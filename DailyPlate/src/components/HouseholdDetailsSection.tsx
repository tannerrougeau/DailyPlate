import type { HouseholdMember } from "@/types/profile";
import { DISLIKED_FOOD_CHIPS } from "@/utils/chipMatching";
import {
  CHILD_AGE_BAND_OPTIONS,
  DEFAULT_CHILD_AGE_BAND,
  OTHER_ADULT_SIZE_OPTIONS,
  childAgeBandLabel,
  resolveChildAgeBand,
  resolveOtherAdultSize,
} from "@/utils/household";

function toggleChip(list: string[], id: string): string[] {
  if (id === "none") return ["none"];
  const next = list.filter((x) => x !== "none");
  return next.includes(id) ? next.filter((x) => x !== id) : [...next, id];
}

export function HouseholdDetailsSection({
  members,
  onMembersChange,
  avoidChips,
  avoidCustom,
  onAvoidChipsChange,
  onAvoidCustomChange,
}: {
  members: HouseholdMember[];
  onMembersChange: (next: HouseholdMember[]) => void;
  avoidChips: string[];
  avoidCustom: string;
  onAvoidChipsChange: (next: string[]) => void;
  onAvoidCustomChange: (next: string) => void;
}) {
  const otherAdults = members
    .map((m, index) => ({ m, index }))
    .filter(({ m }) => m.kind === "adult")
    .slice(1);
  const children = members
    .map((m, index) => ({ m, index }))
    .filter(({ m }) => m.kind === "child");

  function patch(index: number, partial: Partial<HouseholdMember>) {
    onMembersChange(members.map((m, i) => (i === index ? { ...m, ...partial } : m)));
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">
        Optional. Skip anything you’re unsure about — we’ll use sensible defaults.
      </p>

      {otherAdults.length > 0 && (
        <section className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-900">Other adults</h4>
          {otherAdults.map(({ m, index }, n) => (
            <div key={`adult-${index}`} className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Adult {n + 2}</p>
              <div className="flex flex-wrap gap-2">
                {OTHER_ADULT_SIZE_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => patch(index, { adultSize: o.id })}
                    className={`min-h-[44px] rounded-full border-2 px-3.5 text-sm font-semibold ${
                      resolveOtherAdultSize(m) === o.id
                        ? "border-[#2563EB] bg-blue-50 text-blue-900"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {o.label}
                    {o.id === "similar" && !m.adultSize ? " · Recommended" : ""}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {children.length > 0 && (
        <section className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-900">Children</h4>
          {children.map(({ m, index }, n) => (
            <div key={`child-${index}`} className="space-y-1.5">
              <p className="text-sm font-medium text-slate-700">Child {n + 1}</p>
              <div className="flex flex-wrap gap-2">
                {CHILD_AGE_BAND_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => patch(index, { childAgeBand: o.id })}
                    className={`min-h-[44px] rounded-full border-2 px-3.5 text-sm font-semibold ${
                      resolveChildAgeBand(m) === o.id
                        ? "border-[#2563EB] bg-blue-50 text-blue-900"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {m.childAgeBand == null && (
                <p className="text-xs text-slate-500">
                  Not set — using {childAgeBandLabel(DEFAULT_CHILD_AGE_BAND)}.
                </p>
              )}
            </div>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-900">
          Does anyone in the household avoid foods? (allergies or dislikes)
        </h4>
        <div className="flex flex-wrap gap-2">
          {DISLIKED_FOOD_CHIPS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onAvoidChipsChange(toggleChip(avoidChips, c.id))}
              className={`min-h-[44px] rounded-full border-2 px-3.5 text-sm font-semibold ${
                avoidChips.includes(c.id)
                  ? "border-rose-400 bg-rose-50 text-rose-900"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">
            Other household avoids
          </span>
          <input
            type="text"
            value={avoidCustom}
            onChange={(e) => onAvoidCustomChange(e.target.value)}
            placeholder="e.g. peanuts, shellfish"
            className="min-h-[48px] w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#2563EB]"
          />
        </label>
      </section>
    </div>
  );
}
