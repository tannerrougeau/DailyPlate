import type { HouseholdMember, PersonSize } from "@/types/profile";
import { defaultSizeForKind } from "@/utils/household";

const SIZES: { id: PersonSize; label: string }[] = [
  { id: "small", label: "S" },
  { id: "medium", label: "M" },
  { id: "large", label: "L" },
];

export function HouseholdMembersEditor({
  members,
  onChange,
}: {
  members: HouseholdMember[];
  onChange: (next: HouseholdMember[]) => void;
}) {
  if (members.length === 0) return null;

  function patch(index: number, partial: Partial<HouseholdMember>) {
    onChange(members.map((m, i) => (i === index ? { ...m, ...partial } : m)));
  }

  let adultN = 0;
  let childN = 0;

  return (
    <div className="space-y-2">
      <p className="text-sm leading-relaxed text-slate-600">
        Optional. Child plates default smaller than adult. Size adjusts grocery and prep amounts.
      </p>
      {members.map((member, index) => {
        if (member.kind === "adult") adultN += 1;
        else childN += 1;
        const label =
          member.kind === "adult" ? `Adult ${adultN}` : `Child ${childN}`;
        const size = member.size ?? defaultSizeForKind(member.kind);
        return (
          <div
            key={`${member.kind}-${index}`}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">{label}</p>
              <div className="flex gap-1" role="group" aria-label={`${label} size`}>
                {SIZES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => patch(index, { size: s.id })}
                    className={`h-8 min-w-[36px] rounded-lg border text-xs font-bold ${
                      size === s.id
                        ? "border-[#2563EB] bg-blue-50 text-blue-900"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={120}
                value={member.age ?? ""}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  patch(index, {
                    age: e.target.value.trim() === "" || !Number.isFinite(n) ? null : n,
                  });
                }}
                placeholder="Age"
                aria-label={`${label} age`}
                className="min-h-[40px] w-16 flex-1 rounded-xl border border-slate-200 px-2 text-sm text-slate-800 outline-none focus:border-[#2563EB]"
              />
              {member.kind === "adult" && (
                <select
                  value={member.sex ?? ""}
                  onChange={(e) =>
                    patch(index, {
                      sex: (e.target.value || null) as HouseholdMember["sex"],
                    })
                  }
                  aria-label={`${label} gender`}
                  className="min-h-[40px] flex-[1.4] rounded-xl border border-slate-200 bg-white px-2 text-sm text-slate-800 outline-none focus:border-[#2563EB]"
                >
                  <option value="">Gender</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="unspecified">Prefer not to say</option>
                </select>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
