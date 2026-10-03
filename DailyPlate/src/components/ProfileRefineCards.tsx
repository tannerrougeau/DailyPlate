import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { FoodPreferenceSection } from "@/components/FoodPreferenceSection";
import { CuisinePreferenceSection } from "@/components/CuisinePreferenceSection";
import { CookingShoppingSection } from "@/components/CookingShoppingSection";
import { HouseholdDetailsSection } from "@/components/HouseholdDetailsSection";
import { MinimumProteinSettings } from "@/components/MinimumProteinSettings";
import {
  defaultPlanningPrefsValue,
  type PlanningPrefsValue,
} from "@/components/PlanningPrefsSection";
import {
  PROTEIN_SOURCE_PREF_OPTIONS,
  deriveCookingFlags,
} from "@/utils/planningPrefs";
import {
  goalLinkedProteinGrams,
  isCustomProteinOverride,
  migrateProteinPreference,
} from "@/utils/proteinMinimum";
import { MACRO_SPLIT_OPTIONS } from "@/utils/macroSplit";
import type {
  HouseholdMember,
  MacroSplitPreference,
  MainGoal,
  ProteinPreference,
  UserProfile,
} from "@/types/profile";
import {
  householdCardSummary,
  resolveHouseholdCounts,
  resolveHouseholdMembers,
} from "@/utils/household";
import {
  FAVORITE_FOOD_CHIPS,
  DISLIKED_FOOD_CHIPS,
} from "@/utils/chipMatching";

export type RefineCardValues = {
  favoriteChips: string[];
  dislikedChips: string[];
  favoriteCustom: string;
  dislikedCustom: string;
  preferredCuisines: string[];
  planningPrefs: PlanningPrefsValue;
  knownTdeeInput: string;
  macroSplitPreference: MacroSplitPreference;
  minProteinGrams: string;
};

export type HouseholdCardValue = {
  adults: number;
  children: number;
  members: HouseholdMember[];
  avoidChips: string[];
  avoidCustom: string;
};

export function householdCardValueFromProfile(profile: UserProfile): HouseholdCardValue {
  const { adults, children } = resolveHouseholdCounts(profile);
  return {
    adults,
    children,
    members: resolveHouseholdMembers(profile),
    avoidChips: profile.householdFoodAvoidChips ?? [],
    avoidCustom: profile.householdFoodAvoidCustom ?? "",
  };
}

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function foodSummary(v: RefineCardValues): string {
  const likes = v.favoriteChips
    .filter((id) => id !== "none")
    .map((id) => FAVORITE_FOOD_CHIPS.find((c) => c.id === id)?.label ?? id);
  const avoids = [
    ...v.dislikedChips
      .filter((id) => id !== "none")
      .map((id) => DISLIKED_FOOD_CHIPS.find((c) => c.id === id)?.label ?? id),
    ...v.planningPrefs.avoidedProteinSources.map(
      (id) => PROTEIN_SOURCE_PREF_OPTIONS.find((o) => o.id === id)?.label ?? id,
    ),
    ...v.planningPrefs.foodsToAvoid.split(",").map((s) => s.trim()).filter(Boolean),
  ];
  const parts: string[] = [];
  if (likes.length) parts.push(likes.slice(0, 3).join(", "));
  if (avoids.length) parts.push(`avoid ${avoids.slice(0, 2).join(", ")}`);
  if (v.preferredCuisines.length) parts.push(v.preferredCuisines.slice(0, 2).join(", "));
  return parts.length > 0 ? parts.join(" · ") : "No food prefs yet";
}

function cookingSummary(v: RefineCardValues): string {
  const p = v.planningPrefs;
  const prep = p.maxPrepMinutes == null ? "no prep cap" : `${p.maxPrepMinutes} min prep`;
  return `${p.shoppingTripsPerWeek} shop · ${p.cookingEventsPerWeek} cooks · ${p.maxLeftoverStreakDays} leftover days · ${prep}`;
}

function targetsSummary(v: RefineCardValues, derivedProteinGrams: number): string {
  const split = MACRO_SPLIT_OPTIONS.find((o) => o.id === v.macroSplitPreference)?.label ?? "Balanced";
  const custom = Number(v.minProteinGrams);
  const protein =
    v.minProteinGrams.trim() !== "" && Number.isFinite(custom) && custom > 0
      ? `${Math.round(custom)}g custom protein`
      : `${derivedProteinGrams}g protein`;
  const tdee = v.knownTdeeInput.trim() !== "" ? `TDEE ${v.knownTdeeInput}` : "formula TDEE";
  return `${split} · ${protein} · ${tdee}`;
}

function CollapseCard({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">{summary}</p>
        </div>
        <ChevronDown
          className={`mt-0.5 h-4 w-4 shrink-0 text-slate-400 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open && <div className="space-y-5 border-t border-slate-100 px-4 py-4">{children}</div>}
    </section>
  );
}

export function ProfileRefineCards({
  value,
  onChange,
  weightKg,
  heightCm,
  goal,
  preference,
  derivedProteinGrams,
  household,
  onHouseholdChange,
}: {
  value: RefineCardValues;
  onChange: (next: RefineCardValues) => void;
  weightKg: number;
  heightCm: number;
  goal: MainGoal | null;
  preference: ProteinPreference;
  derivedProteinGrams: number;
  household?: HouseholdCardValue | null;
  onHouseholdChange?: (next: HouseholdCardValue) => void;
}) {
  const [open, setOpen] = useState<"food" | "cooking" | "targets" | "household" | null>(null);
  const showHousehold =
    household != null &&
    onHouseholdChange != null &&
    household.adults + household.children > 1;

  function patch(partial: Partial<RefineCardValues>) {
    onChange({ ...value, ...partial });
  }

  function patchPlanning(partial: Partial<PlanningPrefsValue>) {
    patch({ planningPrefs: { ...value.planningPrefs, ...partial } });
  }

  return (
    <div className="space-y-3">
      <CollapseCard
        title="Food"
        summary={foodSummary(value)}
        open={open === "food"}
        onToggle={() => setOpen((c) => (c === "food" ? null : "food"))}
      >
        <FoodPreferenceSection
          favoriteChips={value.favoriteChips}
          dislikedChips={value.dislikedChips}
          favoriteCustom={value.favoriteCustom}
          dislikedCustom={value.dislikedCustom}
          onFavoriteChipsChange={(favoriteChips) => patch({ favoriteChips })}
          onDislikedChipsChange={(dislikedChips) => patch({ dislikedChips })}
          onFavoriteCustomChange={(favoriteCustom) => patch({ favoriteCustom })}
          onDislikedCustomChange={(dislikedCustom) => patch({ dislikedCustom })}
        />
        <CuisinePreferenceSection
          selected={value.preferredCuisines}
          onChange={(preferredCuisines) => patch({ preferredCuisines })}
        />
        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-900">Protein sources to avoid</h3>
          <div className="flex flex-wrap gap-2">
            {PROTEIN_SOURCE_PREF_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() =>
                  patchPlanning({
                    avoidedProteinSources: toggleId(value.planningPrefs.avoidedProteinSources, o.id),
                  })
                }
                className={`min-h-[44px] rounded-full border-2 px-3.5 text-sm font-semibold ${
                  value.planningPrefs.avoidedProteinSources.includes(o.id)
                    ? "border-rose-400 bg-rose-50 text-rose-900"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">
              Other foods to avoid
            </span>
            <input
              type="text"
              value={value.planningPrefs.foodsToAvoid}
              onChange={(e) => patchPlanning({ foodsToAvoid: e.target.value })}
              placeholder="e.g. mushrooms, olives, pork"
              className="min-h-[48px] w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#2563EB]"
            />
          </label>
        </section>
      </CollapseCard>

      <CollapseCard
        title="Cooking & shopping"
        summary={cookingSummary(value)}
        open={open === "cooking"}
        onToggle={() => setOpen((c) => (c === "cooking" ? null : "cooking"))}
      >
        <CookingShoppingSection
          value={value.planningPrefs}
          onChange={(planningPrefs) => patch({ planningPrefs })}
          hideTitle
        />
      </CollapseCard>

      <CollapseCard
        title="Targets"
        summary={targetsSummary(value, derivedProteinGrams)}
        open={open === "targets"}
        onToggle={() => setOpen((c) => (c === "targets" ? null : "targets"))}
      >
        <section className="space-y-2">
          <h3 className="text-base font-semibold text-slate-900">Known maintenance TDEE</h3>
          <p className="text-xs text-slate-500">Optional. Leave blank to use our estimate.</p>
          <div className="relative">
            <input
              type="number"
              inputMode="numeric"
              value={value.knownTdeeInput}
              onChange={(e) => patch({ knownTdeeInput: e.target.value })}
              placeholder="e.g. 2400"
              className="min-h-[48px] w-full rounded-2xl border-2 border-slate-200 bg-white px-4 pr-16 text-base font-semibold text-slate-900 outline-none focus:border-[#2563EB]"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
              kcal
            </span>
          </div>
        </section>
        <section className="space-y-2">
          <h3 className="text-base font-semibold text-slate-900">Macro split</h3>
          <div className="flex flex-col gap-2">
            {MACRO_SPLIT_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => patch({ macroSplitPreference: o.id })}
                className={`rounded-2xl border-2 px-4 py-3 text-left ${
                  value.macroSplitPreference === o.id
                    ? "border-[#2563EB] bg-blue-50 text-blue-900"
                    : "border-slate-200 bg-white text-slate-800"
                }`}
              >
                <span className="block text-sm font-semibold">
                  {o.label}
                  {o.id === "balanced" ? " · Recommended" : ""}
                </span>
                <span className="mt-0.5 block text-xs text-slate-600">{o.description}</span>
              </button>
            ))}
          </div>
        </section>
        <MinimumProteinSettings
          derivedGrams={derivedProteinGrams}
          weightKg={weightKg}
          heightCm={heightCm}
          goal={goal}
          preference={preference}
          proteinGrams={value.minProteinGrams}
          onProteinGramsChange={(minProteinGrams) => patch({ minProteinGrams })}
        />
      </CollapseCard>

      {showHousehold && household && onHouseholdChange && (
        <CollapseCard
          title="Household"
          summary={householdCardSummary(
            {
              householdAdults: household.adults,
              householdChildren: household.children,
              householdMembers: household.members,
            },
            { avoidChips: household.avoidChips, avoidCustom: household.avoidCustom },
          )}
          open={open === "household"}
          onToggle={() => setOpen((c) => (c === "household" ? null : "household"))}
        >
          <HouseholdDetailsSection
            members={household.members}
            onMembersChange={(members) => onHouseholdChange({ ...household, members })}
            avoidChips={household.avoidChips}
            avoidCustom={household.avoidCustom}
            onAvoidChipsChange={(avoidChips) => onHouseholdChange({ ...household, avoidChips })}
            onAvoidCustomChange={(avoidCustom) => onHouseholdChange({ ...household, avoidCustom })}
          />
        </CollapseCard>
      )}
    </div>
  );
}

export function parseKnownTdee(input: string): number | null {
  const n = Number(input);
  if (input.trim() === "" || !Number.isFinite(n)) return null;
  if (n < 1200 || n > 6000) return null;
  return Math.round(n);
}

export function defaultRefineValues(): RefineCardValues {
  return {
    favoriteChips: [],
    dislikedChips: [],
    favoriteCustom: "",
    dislikedCustom: "",
    preferredCuisines: [],
    planningPrefs: defaultPlanningPrefsValue(),
    knownTdeeInput: "",
    macroSplitPreference: "balanced",
    minProteinGrams: "",
  };
}

export function refineValuesFromProfile(profile: UserProfile): RefineCardValues {
  const preference = migrateProteinPreference(profile.proteinPreference);
  const input = {
    goal: profile.goal,
    preference,
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
  };
  return {
    favoriteChips: profile.favoriteFoodChips ?? [],
    dislikedChips: profile.dislikedFoodChips ?? [],
    favoriteCustom: profile.favoriteFoodCustom ?? "",
    dislikedCustom: profile.dislikedFoodCustom ?? "",
    preferredCuisines: profile.preferredCuisines ?? [],
    planningPrefs: {
      ...defaultPlanningPrefsValue(),
      shoppingTripsPerWeek: profile.shoppingTripsPerWeek ?? defaultPlanningPrefsValue().shoppingTripsPerWeek,
      cookingEventsPerWeek: profile.cookingEventsPerWeek ?? defaultPlanningPrefsValue().cookingEventsPerWeek,
      maxLeftoverStreakDays: profile.maxLeftoverStreakDays ?? defaultPlanningPrefsValue().maxLeftoverStreakDays,
      ingredientVariety: profile.ingredientVariety ?? defaultPlanningPrefsValue().ingredientVariety,
      maxPrepMinutes:
        profile.maxPrepMinutes === undefined
          ? defaultPlanningPrefsValue().maxPrepMinutes
          : profile.maxPrepMinutes,
      weeklyMealPrepSlot: profile.weeklyMealPrepSlot ?? defaultPlanningPrefsValue().weeklyMealPrepSlot,
      snackStyle: profile.snackStyle ?? defaultPlanningPrefsValue().snackStyle,
      preferredProteinSources: profile.preferredProteinSources ?? [],
      avoidedProteinSources: profile.avoidedProteinSources ?? [],
      foodsToAvoid: "",
      kitchenEquipment: profile.kitchenEquipment ?? [...defaultPlanningPrefsValue().kitchenEquipment],
    },
    knownTdeeInput: profile.knownTdeeKcal != null ? String(profile.knownTdeeKcal) : "",
    macroSplitPreference: profile.macroSplitPreference ?? "balanced",
    minProteinGrams: isCustomProteinOverride(profile.minimumProteinGrams, input)
      ? String(profile.minimumProteinGrams)
      : "",
  };
}

export function profilePatchFromRefine(
  value: RefineCardValues,
  input: {
    weightKg: number;
    heightCm: number;
    goal: MainGoal;
    proteinPreference: ProteinPreference;
  },
): Partial<UserProfile> {
  const parsedProtein = Number(value.minProteinGrams);
  const hasCustomProtein =
    value.minProteinGrams.trim() !== "" && Number.isFinite(parsedProtein) && parsedProtein > 0;
  return {
    favoriteFoodChips: value.favoriteChips,
    dislikedFoodChips: value.dislikedChips,
    favoriteFoodCustom: value.favoriteCustom.trim(),
    dislikedFoodCustom: [value.dislikedCustom, value.planningPrefs.foodsToAvoid]
      .flatMap((s) => s.split(","))
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .join(", "),
    preferredCuisines: value.preferredCuisines,
    ...deriveCookingFlags(value.planningPrefs),
    shoppingTripsPerWeek: value.planningPrefs.shoppingTripsPerWeek,
    cookingEventsPerWeek: value.planningPrefs.cookingEventsPerWeek,
    maxLeftoverStreakDays: value.planningPrefs.maxLeftoverStreakDays,
    ingredientVariety: value.planningPrefs.ingredientVariety,
    maxPrepMinutes: value.planningPrefs.maxPrepMinutes,
    snackStyle: value.planningPrefs.snackStyle,
    preferredProteinSources: value.planningPrefs.preferredProteinSources,
    avoidedProteinSources: value.planningPrefs.avoidedProteinSources,
    kitchenEquipment: value.planningPrefs.kitchenEquipment,
    knownTdeeKcal: parseKnownTdee(value.knownTdeeInput),
    macroSplitPreference: value.macroSplitPreference,
    prioritizeMinProtein: true,
    minimumProteinGrams: hasCustomProtein
      ? Math.round(parsedProtein)
      : goalLinkedProteinGrams({
          goal: input.goal,
          preference: input.proteinPreference,
          weightKg: input.weightKg,
          heightCm: input.heightCm,
        }),
  };
}
