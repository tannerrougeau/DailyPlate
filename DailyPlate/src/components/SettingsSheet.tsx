import { useEffect, useState } from "react";
import { useOverlayBack } from "@/hooks/useOverlayBack";
import { X } from "lucide-react";
import { FeedbackCheckInButton } from "@/components/FeedbackCheckIn";
import { CheckInSheet } from "@/components/CheckInSheet";
import { HouseholdPicker } from "@/components/HouseholdPicker";
import { applyProfileToTargets, useAppStore } from "@/store/useAppStore";
import type { MacroSplitPreference, MealTimingPreference, UserProfile } from "@/types/profile";
import {
  clampAdults,
  clampChildren,
  householdPresetFromCounts,
  resolveHouseholdCounts,
} from "@/utils/household";
import { MinimumProteinSettings } from "@/components/MinimumProteinSettings";
import { proteinGramsFromPreset } from "@/utils/proteinMinimum";
import { MACRO_SPLIT_OPTIONS } from "@/utils/macroSplit";
import { MealTimingPreferenceSection } from "@/components/MealTimingPreferenceSection";
import { WeeklyMealPrepSection } from "@/components/WeeklyMealPrepSection";
import { MinimalPrepPreferenceSection } from "@/components/MinimalPrepPreferenceSection";
import { LowComplexityPreferenceSection } from "@/components/LowComplexityPreferenceSection";
import { CuisinePreferenceSection } from "@/components/CuisinePreferenceSection";
import type { MealSlotId } from "@/types";
import type { WeeklyMealPrepRepeatCount } from "@/types/profile";

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const userProfile = useAppStore((s) => s.userProfile);
  const setUserProfile = useAppStore((s) => s.setUserProfile);
  const setTargets = useAppStore((s) => s.setTargets);
  const authSession = useAppStore((s) => s.authSession);
  const logout = useAppStore((s) => s.logout);
  const syncAccountSnapshot = useAppStore((s) => s.syncAccountSnapshot);

  const [adults, setAdults] = useState(2);
  const [childrenCount, setChildrenCount] = useState(0);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const lastFeedbackSubmittedAt = useAppStore((s) => s.lastFeedbackSubmittedAt);
  const adaptiveTdeeEstimate = useAppStore((s) => s.adaptiveTdeeEstimate);
  const [prioritizeProtein, setPrioritizeProtein] = useState(false);
  const [minProteinGrams, setMinProteinGrams] = useState("");
  const [macroSplitPreference, setMacroSplitPreference] =
    useState<MacroSplitPreference>("balanced");
  const [mealTiming, setMealTiming] = useState<MealTimingPreference | null>(null);
  const [prioritizeMinimalPrep, setPrioritizeMinimalPrep] = useState(false);
  const [lowComplexityEnabled, setLowComplexityEnabled] = useState(false);
  const [preferredCuisines, setPreferredCuisines] = useState<string[]>([]);
  const [weeklyPrepEnabled, setWeeklyPrepEnabled] = useState(false);
  const [weeklyPrepSlot, setWeeklyPrepSlot] = useState<MealSlotId>("dinner");
  const [weeklyPrepRepeat, setWeeklyPrepRepeat] = useState<WeeklyMealPrepRepeatCount>(3);
  useOverlayBack(userProfile != null, onClose);

  useEffect(() => {
    if (!userProfile) return;
    const counts = resolveHouseholdCounts(userProfile);
    setAdults(counts.adults);
    setChildrenCount(counts.children);
    setPrioritizeProtein(userProfile.prioritizeMinProtein === true);
    setMinProteinGrams(
      userProfile.minimumProteinGrams != null
        ? String(userProfile.minimumProteinGrams)
        : String(proteinGramsFromPreset(userProfile.weightKg, 1.8)),
    );
    setMacroSplitPreference(userProfile.macroSplitPreference ?? "balanced");
    setMealTiming(userProfile.mealTiming ?? null);
    setPrioritizeMinimalPrep(userProfile.prioritizeMinimalPrep === true);
    setLowComplexityEnabled(userProfile.lowComplexityEnabled === true);
    setPreferredCuisines(userProfile.preferredCuisines ?? []);
    setWeeklyPrepEnabled(userProfile.weeklyMealPrepEnabled ?? false);
    setWeeklyPrepSlot(userProfile.weeklyMealPrepSlot ?? "dinner");
    setWeeklyPrepRepeat(userProfile.weeklyMealPrepRepeatCount ?? 3);
  }, [userProfile]);

  if (!userProfile) return null;

  const handleSave = () => {
    const nextAdults = clampAdults(adults);
    const nextChildren = clampChildren(childrenCount);
    const parsedProtein = Number(minProteinGrams);
    const next: UserProfile = {
      ...userProfile,
      householdAdults: nextAdults,
      householdChildren: nextChildren,
      householdPreset: householdPresetFromCounts(nextAdults, nextChildren),
      householdCustomCount: null,
      prioritizeMinProtein: prioritizeProtein,
      minimumProteinGrams:
        prioritizeProtein && Number.isFinite(parsedProtein) && parsedProtein > 0
          ? Math.round(parsedProtein)
          : null,
      macroSplitPreference,
      mealTiming,
      prioritizeMinimalPrep,
      lowComplexityEnabled,
      preferredCuisines,
      weeklyMealPrepEnabled: weeklyPrepEnabled,
      weeklyMealPrepSlot: weeklyPrepEnabled ? weeklyPrepSlot : null,
      weeklyMealPrepRepeatCount: weeklyPrepRepeat,
    };
    setUserProfile(next);
    setTargets(applyProfileToTargets(next));
    void syncAccountSnapshot();
    onClose();
  };

  return (
    <>
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close settings"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-labelledby="settings-title"
        className="relative z-[81] flex max-h-[90dvh] w-full max-w-lg flex-col overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="settings-title" className="text-xl font-bold text-slate-900">
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {authSession && (
          <section className="space-y-2 border-b border-slate-100 pb-5">
            <h3 className="text-base font-semibold text-slate-900">Account</h3>
            <p className="text-sm text-slate-600">Signed in as {authSession.email}</p>
            <button
              type="button"
              onClick={() => {
                void syncAccountSnapshot();
                logout();
                onClose();
              }}
              className="min-h-[48px] w-full rounded-2xl border-2 border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700"
            >
              Log out
            </button>
          </section>
        )}

        <MinimumProteinSettings
          profile={userProfile}
          enabled={prioritizeProtein}
          proteinGrams={minProteinGrams}
          onEnabledChange={setPrioritizeProtein}
          onProteinGramsChange={setMinProteinGrams}
          onApplyPreset={(grams) => setMinProteinGrams(String(grams))}
        />

        <section className="space-y-3 border-b border-slate-100 pb-5">
          <h3 className="text-base font-semibold text-slate-900">
            Preferred macro split
          </h3>
          <p className="text-sm text-slate-600">
            Protein target is always met first. Remaining calories are split between carbs and fat
            using this preference when possible.
          </p>
          <div className="flex flex-col gap-2">
            {MACRO_SPLIT_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setMacroSplitPreference(o.id)}
                className={`rounded-2xl border-2 px-4 py-3 text-left transition-colors ${
                  macroSplitPreference === o.id
                    ? "border-[#2563EB] bg-blue-50 text-blue-900"
                    : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                }`}
              >
                <span className="block text-sm font-semibold">{o.label}</span>
                <span className="mt-0.5 block text-xs font-normal text-slate-600">
                  {o.description}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4 border-b border-slate-100 pb-5">
          <MealTimingPreferenceSection value={mealTiming} onChange={setMealTiming} />
        </section>

        <section className="space-y-4 border-b border-slate-100 pb-5">
          <MinimalPrepPreferenceSection
            enabled={prioritizeMinimalPrep}
            onChange={setPrioritizeMinimalPrep}
          />
        </section>

        <section className="space-y-4 border-b border-slate-100 pb-5">
          <LowComplexityPreferenceSection
            enabled={lowComplexityEnabled}
            onChange={setLowComplexityEnabled}
          />
        </section>

        <section className="space-y-4 border-b border-slate-100 pb-5">
          <CuisinePreferenceSection selected={preferredCuisines} onChange={setPreferredCuisines} />
        </section>

        <section className="space-y-4 border-b border-slate-100 pb-5">
          <WeeklyMealPrepSection
            enabled={weeklyPrepEnabled}
            slot={weeklyPrepSlot}
            repeatCount={weeklyPrepRepeat}
            onEnabledChange={setWeeklyPrepEnabled}
            onSlotChange={setWeeklyPrepSlot}
            onRepeatCountChange={setWeeklyPrepRepeat}
          />
        </section>

        <section className="space-y-3 border-b border-slate-100 pb-5">
          <h3 className="text-base font-semibold text-slate-900">Check-in</h3>
          <p className="text-sm text-slate-600">
            Optional — open anytime to refine your calorie target, food preferences, and meal
            planning experience. All responses are saved to your profile.
          </p>
          {lastFeedbackSubmittedAt && (
            <p className="text-xs text-slate-500">
              Last check-in:{" "}
              {new Date(lastFeedbackSubmittedAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              {adaptiveTdeeEstimate != null &&
                ` · Personal TDEE ~${adaptiveTdeeEstimate.toLocaleString()} kcal`}
            </p>
          )}
          <FeedbackCheckInButton variant="card" onOpen={() => setFeedbackOpen(true)} />
        </section>

        <section className="space-y-3 pt-5">
          <h3 className="text-base font-semibold text-slate-900">Household size</h3>
          <HouseholdPicker
            adults={adults}
            childrenCount={childrenCount}
            onAdultsChange={setAdults}
            onChildrenChange={setChildrenCount}
            compact
          />
        </section>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[52px] flex-1 rounded-2xl border-2 border-slate-200 bg-white py-3 text-base font-semibold text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="min-h-[52px] flex-1 rounded-2xl bg-[#2563EB] py-3 text-base font-semibold text-white"
          >
            Save
          </button>
        </div>
      </div>
    </div>
    {feedbackOpen && <CheckInSheet onClose={() => setFeedbackOpen(false)} />}
    </>
  );
}
