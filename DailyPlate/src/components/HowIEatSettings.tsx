import type { ReactNode } from "react";
import { useAppStore } from "@/store/useAppStore";
import type { UserProfile } from "@/types/profile";
import {
  BUDGET_OPTIONS,
  COOKING_AMOUNT_OPTIONS,
  COOKING_LIMIT_OPTIONS,
  MEAL_SOURCE_OPTIONS,
  MEAL_SOURCE_SLOTS,
  type FitAnswers,
} from "@/utils/fitYourLife";

export const choiceChip = (on: boolean) =>
  `min-h-[36px] rounded-xl border px-3 text-sm font-semibold ${
    on ? "border-[#2563EB] bg-blue-50 text-[#2563EB]" : "border-slate-200 text-slate-700"
  }`;

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-800">{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Settings → How I eat: the "fit your life" answers, all optional. Tapping a selected choice
 * clears it (back to the default). Applies right away; `onApplied` lets the sheet sync its form.
 */
export function HowIEatSettings({ onApplied }: { onApplied?: (profile: UserProfile) => void }) {
  const profile = useAppStore((s) => s.userProfile);
  const setFitAnswers = useAppStore((s) => s.setFitAnswers);
  if (!profile) return null;
  const apply = (answers: FitAnswers) => {
    const next = setFitAnswers(answers);
    if (next) onApplied?.(next);
  };
  const sources = profile.mealSources ?? {};
  const limits = profile.cookingLimits ?? [];
  return (
    <section className="space-y-4 border-b border-slate-100 pb-5">
      <div>
        <h3 className="text-base font-semibold text-slate-900">How I eat</h3>
        <p className="text-xs text-slate-500">Optional. Your plan works either way.</p>
      </div>
      {MEAL_SOURCE_SLOTS.map((slot) => (
        <Row key={slot} label={capitalize(slot)}>
          {MEAL_SOURCE_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={sources[slot] === o.id}
              className={choiceChip(sources[slot] === o.id)}
              onClick={() => apply({ mealSources: { ...sources, [slot]: sources[slot] === o.id ? undefined : o.id } })}
            >
              {o.id === "buy" ? "Buy" : o.label}
            </button>
          ))}
        </Row>
      ))}
      <Row label="How much cooking works for you?">
        {COOKING_AMOUNT_OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={profile.cookingAmount === o.id}
            className={choiceChip(profile.cookingAmount === o.id)}
            onClick={() => apply({ cookingAmount: profile.cookingAmount === o.id ? undefined : o.id })}
          >
            {o.label}
          </button>
        ))}
      </Row>
      <Row label="Food budget?">
        {BUDGET_OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={profile.budget === o.id}
            className={choiceChip(profile.budget === o.id)}
            onClick={() => apply({ budget: profile.budget === o.id ? undefined : o.id })}
          >
            {o.label}
          </button>
        ))}
      </Row>
      <Row label="Anything that limits cooking?">
        {COOKING_LIMIT_OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={limits.includes(o.id)}
            className={choiceChip(limits.includes(o.id))}
            onClick={() =>
              apply({ cookingLimits: limits.includes(o.id) ? limits.filter((l) => l !== o.id) : [...limits, o.id] })
            }
          >
            {o.label}
          </button>
        ))}
      </Row>
    </section>
  );
}
