import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  Package,
  RotateCcw,
  X,
} from "lucide-react";
import { UsageNote } from "@/components/UsageNote";
import { RollingWeekCalendar } from "@/components/RollingWeekCalendar";
import { ClearDatesButton } from "@/components/ClearDatesButton";
import { useAppStore } from "@/store/useAppStore";
import { formatQty, groceriesFromMeals, groceryVolumeLabel, mergeGroceryLists, simplifyGroceryList } from "@/utils/grocery";
import {
  fromDateKey,
  isDateKeyOnOrAfter,
  toDateKey,
  weekDateKeys,
} from "@/utils/date";
import {
  countsFromOverride,
  formatHouseholdCookingLine,
  householdMultiplierFor,
} from "@/utils/household";
import { mealsForDateKey } from "@/utils/mealTracking";
import { mealDisplayName } from "@/utils/recipeDisplay";
import { useOverlayBack } from "@/hooks/useOverlayBack";
import { PantrySheet } from "@/components/PantrySheet";
import type { GroceryItem, IngredientCategory, PlannedMeal } from "@/types";

const CATEGORY_ORDER: IngredientCategory[] = [
  "Produce",
  "Protein",
  "Dairy",
  "Grains",
  "Pantry",
  "Spices",
];

function weekKeys(week: Date[]): string[] {
  return week.map((d) => toDateKey(d));
}

function formatSelectedDateRange(keys: string[]): string | null {
  if (keys.length === 0) return null;
  const sorted = [...keys].sort();
  const fmt = (key: string) =>
    fromDateKey(key).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (sorted.length === 1) return fmt(sorted[0]!);
  return `${fmt(sorted[0]!)} – ${fmt(sorted[sorted.length - 1]!)}`;
}

function sortByName(rows: GroceryItem[]): GroceryItem[] {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name));
}

export function GroceryScreen() {
  const dailyPlans = useAppStore((s) => s.dailyPlans);
  const plannedMeals = useAppStore((s) => s.plannedMeals);
  const todayDateKey = useAppStore((s) => s.todayDateKey);
  const userProfile = useAppStore((s) => s.userProfile);
  const purchasedKeys = useAppStore((s) => s.groceryCheckedKeys);
  const ownedKeys = useAppStore((s) => s.groceryOwnedKeys);
  const todayHouseholdOverride = useAppStore((s) => s.todayHouseholdOverride);
  const groceryNoteDismissed = useAppStore((s) => s.dismissedUsageNotes.grocery);
  const dismissUsageNote = useAppStore((s) => s.dismissUsageNote);
  const selectedDateKeys = useAppStore((s) => s.grocerySelectedDateKeys);
  const toggleGroceryDateSelected = useAppStore((s) => s.toggleGroceryDateSelected);
  const setGrocerySelectedDateKeys = useAppStore((s) => s.setGrocerySelectedDateKeys);
  const togglePurchased = useAppStore((s) => s.toggleGroceryItemChecked);
  const toggleOwned = useAppStore((s) => s.toggleGroceryItemOwned);
  const pantryCheckedKeys = useAppStore((s) => s.pantryCheckedKeys);
  const togglePantryChecked = useAppStore((s) => s.togglePantryItemChecked);
  const [pantrySheetOpen, setPantrySheetOpen] = useState(false);
  const [pantrySectionOpen, setPantrySectionOpen] = useState(true);
  const [peekDateKey, setPeekDateKey] = useState<string | null>(null);
  const [extraFutureWeeks, setExtraFutureWeeks] = useState(0);
  const initialWeekDefaultApplied = useRef(false);
  const prevOwnedCount = useRef(0);

  useEffect(() => {
    const pruned = selectedDateKeys.filter((key) => isDateKeyOnOrAfter(key, todayDateKey));
    if (pruned.length !== selectedDateKeys.length) {
      setGrocerySelectedDateKeys(pruned);
    }
  }, [todayDateKey, selectedDateKeys, setGrocerySelectedDateKeys]);

  useEffect(() => {
    if (initialWeekDefaultApplied.current) return;
    if (selectedDateKeys.length > 0) {
      initialWeekDefaultApplied.current = true;
      return;
    }
    setGrocerySelectedDateKeys(
      weekDateKeys(new Date()).filter((key) => isDateKeyOnOrAfter(key, todayDateKey)),
    );
    initialWeekDefaultApplied.current = true;
  }, [selectedDateKeys.length, setGrocerySelectedDateKeys, todayDateKey]);

  const selectedDateSet = useMemo(() => new Set(selectedDateKeys), [selectedDateKeys]);

  const todayCountsOverride = countsFromOverride(todayHouseholdOverride, todayDateKey);
  const profileMult = useMemo(
    () => householdMultiplierFor(userProfile),
    [userProfile],
  );
  const todayMult = useMemo(
    () => householdMultiplierFor(userProfile, todayCountsOverride),
    [userProfile, todayCountsOverride],
  );

  const groceryDateKeys = useMemo(
    () => selectedDateKeys.filter((key) => isDateKeyOnOrAfter(key, todayDateKey)),
    [selectedDateKeys, todayDateKey],
  );

  const items = useMemo(() => {
    const lists = groceryDateKeys.map((key) => {
      const meals = mealsForDateKey(key, dailyPlans, plannedMeals, todayDateKey);
      const mult = key === todayDateKey ? todayMult : profileMult;
      return groceriesFromMeals(meals, mult, userProfile?.prioritizeMinProtein === true);
    });
    return simplifyGroceryList(mergeGroceryLists(lists));
  }, [
    dailyPlans,
    plannedMeals,
    todayDateKey,
    groceryDateKeys,
    profileMult,
    todayMult,
    userProfile?.prioritizeMinProtein,
  ]);

  const purchasedSet = useMemo(() => new Set(purchasedKeys), [purchasedKeys]);
  const ownedSet = useMemo(() => new Set(ownedKeys), [ownedKeys]);
  const pantryCheckedSet = useMemo(() => new Set(pantryCheckedKeys), [pantryCheckedKeys]);

  const pantryItems = useMemo(
    () => sortByName(items.filter((item) => ownedSet.has(item.key))),
    [items, ownedSet],
  );

  const groupedItems = useMemo(() => {
    const grouped = items.reduce<Record<string, GroceryItem[]>>((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category]!.push(item);
      return acc;
    }, {});
    for (const category of Object.keys(grouped)) {
      grouped[category] = sortByName(grouped[category]!);
    }
    return grouped;
  }, [items]);

  const sortedCategories = useMemo(() => {
    const present = Object.keys(groupedItems);
    return [
      ...CATEGORY_ORDER.filter((c) => present.includes(c)),
      ...present.filter((c) => !CATEGORY_ORDER.includes(c as IngredientCategory)).sort(),
    ];
  }, [groupedItems]);

  const shoppingTotal = items.length;
  const checkedCount = items.filter(
    (item) => purchasedSet.has(item.key) || ownedSet.has(item.key),
  ).length;
  const progressPct = shoppingTotal > 0 ? (checkedCount / shoppingTotal) * 100 : 0;

  useEffect(() => {
    if (pantryItems.length > prevOwnedCount.current) {
      setPantrySectionOpen(true);
    }
    prevOwnedCount.current = pantryItems.length;
  }, [pantryItems.length]);

  function toggleWeek(week: Date[]) {
    const keys = weekKeys(week).filter((key) => isDateKeyOnOrAfter(key, todayDateKey));
    if (keys.length === 0) return;
    const allSelected = keys.every((k) => selectedDateSet.has(k));
    if (allSelected) {
      setGrocerySelectedDateKeys(selectedDateKeys.filter((k) => !keys.includes(k)));
    } else {
      const next = new Set(selectedDateKeys);
      keys.forEach((k) => next.add(k));
      setGrocerySelectedDateKeys([...next]);
    }
  }

  function selectThisWeek() {
    setGrocerySelectedDateKeys(
      weekDateKeys(new Date()).filter((key) => isDateKeyOnOrAfter(key, todayDateKey)),
    );
  }

  const selectedRangeLabel = formatSelectedDateRange(selectedDateKeys);

  return (
    <div className="mx-auto max-w-lg px-4 pb-32 pt-4">
      <h1 className="mb-2 text-2xl font-bold tracking-tight text-slate-900">Grocery List</h1>
      {!groceryNoteDismissed && (
        <UsageNote
          text="Check items as you shop — they stay on the list. Pantry is always one tap away."
          onDismiss={() => dismissUsageNote("grocery")}
        />
      )}
      <p className="mb-4 text-sm text-slate-500">
        Built from your meal plan. Quantities update as plans change.
      </p>
      {userProfile && (
        <p className="mb-4 card-surface px-4 py-2.5 text-center text-sm font-medium text-slate-700">
          {formatHouseholdCookingLine(userProfile, todayCountsOverride)}
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={selectThisWeek}
          className="min-h-[44px] rounded-full border-2 border-primary bg-primary/5 px-4 text-sm font-semibold text-primary shadow-sm"
        >
          Select this week
        </button>
        <button
          type="button"
          onClick={() => setPantrySheetOpen(true)}
          className="min-h-[44px] rounded-full border-2 border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-900"
        >
          View Pantry
        </button>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-slate-500">
        Update pantry if this isn’t accurate.
      </p>

      <RollingWeekCalendar
        todayDateKey={todayDateKey}
        selectedDateKeys={selectedDateSet}
        showChecks
        onWeekClick={toggleWeek}
        onViewDay={(key) => setPeekDateKey(key)}
        onToggleHighlight={(key) => toggleGroceryDateSelected(key)}
        extraFutureWeeks={extraFutureWeeks}
        onLoadMoreDates={() => setExtraFutureWeeks((n) => n + 4)}
        dayHasMeals={(key) =>
          mealsForDateKey(key, dailyPlans, plannedMeals, todayDateKey).length > 0
        }
        caption={
          selectedRangeLabel ? (
            <div className="mb-2 flex items-center justify-center gap-2">
              <p className="text-xs font-medium text-slate-600">{selectedRangeLabel}</p>
              <ClearDatesButton onClear={() => setGrocerySelectedDateKeys([])} />
            </div>
          ) : null
        }
      />

      {items.length === 0 ? (
        <div className="card-surface p-6 text-sm text-slate-500">
          No grocery items for the selected days. Choose more days or generate plans for those
          dates.
        </div>
      ) : (
        <div className="space-y-4">
          {shoppingTotal > 0 && (
            <div className="card-surface px-4 py-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">Shopping progress</p>
                <p className="text-sm tabular-nums text-slate-500">
                  {checkedCount} / {shoppingTotal} checked
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-success transition-all duration-500 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {checkedCount === shoppingTotal && shoppingTotal > 0 && (
            <div className="card-surface px-4 py-5 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
                <Check className="h-5 w-5 text-emerald-600" aria-hidden />
              </div>
              <p className="text-sm font-semibold text-slate-800">All items checked</p>
              <p className="mt-1 text-xs text-slate-500">
                Checked items stay on the list until you generate a new plan.
              </p>
            </div>
          )}

          {sortedCategories.map((category) => {
            const rows = groupedItems[category] ?? [];
            if (rows.length === 0) return null;
            return (
              <section key={category} className="card-surface p-4">
                <div className="mb-3 flex items-baseline justify-between gap-2">
                  <h2 className="text-base font-semibold text-slate-900">{category}</h2>
                  <span className="text-xs tabular-nums text-slate-400">{rows.length}</span>
                </div>
                <ul className="space-y-2">
                  {rows.map((item) => (
                    <li key={item.key}>
                      <GroceryItemRow
                        item={item}
                        checked={purchasedSet.has(item.key) || ownedSet.has(item.key)}
                        inPantry={ownedSet.has(item.key)}
                        onToggleChecked={() => {
                          const owned = ownedSet.has(item.key);
                          const purchased = purchasedSet.has(item.key);
                          if (purchased || owned) {
                            if (purchased) togglePurchased(item.key);
                            if (owned) toggleOwned(item.key);
                          } else {
                            togglePurchased(item.key);
                          }
                        }}
                        onMoveToPantry={() => toggleOwned(item.key)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          <CollapsibleGrocerySection
            title="Pantry"
            subtitle={
              ownedKeys.length === 0
                ? "Always available — mark items you already have"
                : `${ownedKeys.length} item${ownedKeys.length === 1 ? "" : "s"} at home`
            }
            icon={<Package className="h-4 w-4 text-amber-700" aria-hidden />}
            iconWrapClassName="bg-amber-50"
            open={pantrySectionOpen}
            onToggleOpen={() => setPantrySectionOpen((o) => !o)}
            tone="pantry"
          >
            {ownedKeys.length === 0 ? (
              <p className="text-sm text-slate-500">
                Nothing saved yet. Use Pantry on any grocery row, or open the pantry sheet.
              </p>
            ) : (
              <ul className="space-y-2">
                {(pantryItems.length > 0 ? pantryItems : ownedKeys.map((key) => ({
                  key,
                  name: key.split("::")[1] ?? key,
                  quantity: 0,
                  unit: key.split("::")[2] ?? "",
                  category: "Pantry" as IngredientCategory,
                }))).map((item) => (
                  <li key={item.key}>
                    <PantryItemRow
                      item={item}
                      checked={pantryCheckedSet.has(item.key)}
                      onToggleChecked={() => togglePantryChecked(item.key)}
                      onRestore={() => toggleOwned(item.key)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </CollapsibleGrocerySection>
        </div>
      )}

      {peekDateKey && (
        <GroceryDayMealsSheet
          dateKey={peekDateKey}
          meals={mealsForDateKey(peekDateKey, dailyPlans, plannedMeals, todayDateKey)}
          included={selectedDateSet.has(peekDateKey)}
          onClose={() => setPeekDateKey(null)}
        />
      )}
      {pantrySheetOpen && (
        <PantrySheet
          items={items}
          ownedKeys={ownedKeys}
          checkedKeys={pantryCheckedKeys}
          onToggleChecked={togglePantryChecked}
          onRemoveFromPantry={toggleOwned}
          onClose={() => setPantrySheetOpen(false)}
        />
      )}
    </div>
  );
}

function slotTitle(slot: PlannedMeal["slot"]): string {
  return slot === "snack" ? "Snack" : slot.charAt(0).toUpperCase() + slot.slice(1);
}

function GroceryDayMealsSheet({
  dateKey,
  meals,
  included,
  onClose,
}: {
  dateKey: string;
  meals: PlannedMeal[];
  included: boolean;
  onClose: () => void;
}) {
  useOverlayBack(true, onClose);
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close meal preview"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />
      <section className="relative z-[81] max-h-[80dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-4 shadow-2xl sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">
            {fromDateKey(dateKey).toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          {included
            ? "This day is included in your grocery list."
            : "This day is not highlighted for shopping."}
        </p>
        {meals.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
            No meals on this day.
          </p>
        ) : (
          <ul className="space-y-2">
            {meals.map((meal) => (
              <li
                key={meal.slot}
                className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {slotTitle(meal.slot)}
                </p>
                <p className="text-sm font-semibold text-slate-900">{mealDisplayName(meal)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CollapsibleGrocerySection({
  title,
  subtitle,
  icon,
  iconWrapClassName,
  open,
  onToggleOpen,
  tone,
  children,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  iconWrapClassName: string;
  open: boolean;
  onToggleOpen: () => void;
  tone: "purchased" | "pantry";
  children: ReactNode;
}) {
  const borderTone =
    tone === "purchased" ? "border-emerald-100" : "border-amber-100";
  const headerTone =
    tone === "purchased" ? "hover:bg-emerald-50/40" : "hover:bg-amber-50/40";

  return (
    <section className={`card-surface overflow-hidden border ${borderTone}`}>
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors ${headerTone}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconWrapClassName}`}
          >
            {icon}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">{title}</p>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          {open && (
            <div className="border-t border-slate-100 px-4 pb-4 pt-3">{children}</div>
          )}
        </div>
      </div>
    </section>
  );
}

function GroceryCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 active:scale-90 ${
        checked
          ? "border-emerald-500 bg-emerald-500 shadow-sm shadow-emerald-200"
          : "border-slate-300 bg-white hover:border-emerald-400 hover:bg-emerald-50/50"
      }`}
    >
      <Check
        className={`h-4 w-4 text-white transition-all duration-200 ${
          checked ? "scale-100 opacity-100" : "scale-50 opacity-0"
        }`}
        strokeWidth={3}
        aria-hidden
      />
    </button>
  );
}

function GroceryItemRow({
  item,
  checked,
  inPantry,
  onToggleChecked,
  onMoveToPantry,
}: {
  item: GroceryItem;
  checked: boolean;
  inPantry: boolean;
  onToggleChecked: () => void;
  onMoveToPantry: () => void;
}) {
  return (
    <div
      className={`group flex items-center gap-2 rounded-xl border transition-all duration-300 ease-out ${
        inPantry
          ? "border-amber-100 bg-amber-50/40"
          : checked
            ? "border-emerald-100/80 bg-emerald-50/50"
            : "border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm"
      }`}
    >
      <div
        className={`flex min-h-[48px] min-w-0 flex-1 items-center gap-3 px-3 py-2 ${
          checked ? "opacity-75" : ""
        }`}
      >
        <GroceryCheckbox
          checked={checked}
          onChange={onToggleChecked}
          label={checked ? `Mark ${item.name} as not purchased` : `Mark ${item.name} as purchased`}
        />
        <button
          type="button"
          onClick={onToggleChecked}
          className={`min-w-0 flex-1 text-left text-sm leading-snug transition-all duration-300 ${
            checked
              ? "text-slate-400 line-through decoration-slate-300"
              : "text-slate-800"
          }`}
        >
          <span className={checked ? "text-slate-400" : "font-medium text-slate-900"}>
            {item.name}
          </span>
          <span className="mt-0.5 block text-xs tabular-nums text-slate-500">
            {groceryVolumeLabel(item)}
          </span>
        </button>
      </div>
      <button
        type="button"
        onClick={onMoveToPantry}
        title="Move to pantry"
        aria-label={`Move ${item.name} to pantry`}
        className="mr-2 flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-400 opacity-80 transition-all hover:bg-amber-50 hover:text-amber-800 group-hover:opacity-100"
      >
        <Package className="h-3.5 w-3.5" aria-hidden />
        {inPantry ? "In pantry" : "Pantry"}
      </button>
    </div>
  );
}

function PantryItemRow({
  item,
  checked,
  onToggleChecked,
  onRestore,
}: {
  item: GroceryItem;
  checked: boolean;
  onToggleChecked: () => void;
  onRestore: () => void;
}) {
  return (
    <div
      className={`flex min-h-[48px] items-center gap-3 rounded-xl border px-3 py-2 ${
        checked ? "border-amber-100 bg-amber-50/60" : "border-amber-100/80 bg-amber-50/40"
      }`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={`Mark ${item.name} ${checked ? "unchecked" : "checked"} in pantry`}
        onClick={onToggleChecked}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
          checked ? "border-amber-600 bg-amber-600 text-white" : "border-amber-300 bg-white"
        }`}
      >
        {checked ? "✓" : ""}
      </button>
      <span
        className={`min-w-0 flex-1 text-sm ${checked ? "text-slate-500" : "text-slate-700"}`}
      >
        {item.quantity > 0 && (
          <span className="font-medium tabular-nums">{formatQty(item.quantity)} </span>
        )}
        {item.unit} {item.name}
      </span>
      <button
        type="button"
        onClick={onRestore}
        className="flex shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-primary ring-1 ring-slate-200 transition-colors hover:bg-primary/5"
      >
        <RotateCcw className="h-3 w-3" aria-hidden />
        Remove
      </button>
    </div>
  );
}
