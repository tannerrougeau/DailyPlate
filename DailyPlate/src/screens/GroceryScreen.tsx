import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  Package,
  RotateCcw,
  ShoppingBag,
} from "lucide-react";
import { UsageNote } from "@/components/UsageNote";
import { useAppStore } from "@/store/useAppStore";
import { groceriesFromMeals, formatQty } from "@/utils/grocery";
import { monthGridDates, toDateKey, weekDateKeys, isDateKeyBefore, isDateKeyOnOrAfter } from "@/utils/date";
import { formatHouseholdCookingLine, householdPortionMultiplier } from "@/utils/household";
import { mealsForDateKey } from "@/utils/mealTracking";
import type { GroceryItem, IngredientCategory } from "@/types";

const CATEGORY_ORDER: IngredientCategory[] = [
  "Produce",
  "Protein",
  "Dairy",
  "Grains",
  "Pantry",
  "Spices",
];

function chunkWeeks(dates: Date[]): Date[][] {
  const weeks: Date[][] = [];
  for (let i = 0; i < dates.length; i += 7) {
    weeks.push(dates.slice(i, i + 7));
  }
  return weeks;
}

function weekLabel(week: Date[]): string {
  const start = week[0]!;
  const end = week[6]!;
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (start.getMonth() === end.getMonth()) {
    return `${fmt(start)} – ${end.getDate()}`;
  }
  return `${fmt(start)} – ${fmt(end)}`;
}

function weekKeys(week: Date[]): string[] {
  return week.map((d) => toDateKey(d));
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
  const groceryNoteDismissed = useAppStore((s) => s.dismissedUsageNotes.grocery);
  const dismissUsageNote = useAppStore((s) => s.dismissUsageNote);
  const selectedDateKeys = useAppStore((s) => s.grocerySelectedDateKeys);
  const toggleGroceryDateSelected = useAppStore((s) => s.toggleGroceryDateSelected);
  const setGrocerySelectedDateKeys = useAppStore((s) => s.setGrocerySelectedDateKeys);
  const togglePurchased = useAppStore((s) => s.toggleGroceryItemChecked);
  const toggleOwned = useAppStore((s) => s.toggleGroceryItemOwned);
  const clearGroceryAll = useAppStore((s) => s.clearGroceryAll);
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [pantrySectionOpen, setPantrySectionOpen] = useState(false);
  const [purchasedSectionOpen, setPurchasedSectionOpen] = useState(true);
  const initialMonthDefaultApplied = useRef(false);
  const prevOwnedCount = useRef(0);
  const prevPurchasedCount = useRef(0);

  const gridDates = useMemo(() => monthGridDates(anchorDate), [anchorDate]);
  const calendarWeeks = useMemo(() => chunkWeeks(gridDates), [gridDates]);
  const monthLabel = anchorDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const currentMonth = anchorDate.getMonth();

  useEffect(() => {
    const pruned = selectedDateKeys.filter((key) => isDateKeyOnOrAfter(key, todayDateKey));
    if (pruned.length !== selectedDateKeys.length) {
      setGrocerySelectedDateKeys(pruned);
    }
  }, [todayDateKey, selectedDateKeys, setGrocerySelectedDateKeys]);

  useEffect(() => {
    if (initialMonthDefaultApplied.current) return;
    if (selectedDateKeys.length > 0) {
      initialMonthDefaultApplied.current = true;
      return;
    }
    const defaults = gridDates
      .filter((d) => d.getMonth() === currentMonth)
      .map((d) => toDateKey(d))
      .filter((key) => isDateKeyOnOrAfter(key, todayDateKey));
    setGrocerySelectedDateKeys(defaults);
    initialMonthDefaultApplied.current = true;
  }, [currentMonth, gridDates, selectedDateKeys.length, setGrocerySelectedDateKeys, todayDateKey]);

  const selectedDateSet = useMemo(() => new Set(selectedDateKeys), [selectedDateKeys]);

  const householdMult = useMemo(
    () =>
      householdPortionMultiplier(userProfile?.householdPreset, userProfile?.householdCustomCount),
    [userProfile?.householdCustomCount, userProfile?.householdPreset],
  );

  const groceryDateKeys = useMemo(
    () => selectedDateKeys.filter((key) => isDateKeyOnOrAfter(key, todayDateKey)),
    [selectedDateKeys, todayDateKey],
  );

  const items = useMemo(() => {
    const meals = groceryDateKeys.flatMap((key) =>
      mealsForDateKey(key, dailyPlans, plannedMeals, todayDateKey),
    );
    return groceriesFromMeals(
      meals,
      householdMult,
      userProfile?.prioritizeMinProtein === true,
    );
  }, [
    dailyPlans,
    plannedMeals,
    todayDateKey,
    groceryDateKeys,
    householdMult,
    userProfile?.prioritizeMinProtein,
  ]);

  const purchasedSet = useMemo(() => new Set(purchasedKeys), [purchasedKeys]);
  const ownedSet = useMemo(() => new Set(ownedKeys), [ownedKeys]);

  const shoppingItems = useMemo(
    () => items.filter((item) => !ownedSet.has(item.key)),
    [items, ownedSet],
  );
  const pantryItems = useMemo(
    () => sortByName(items.filter((item) => ownedSet.has(item.key))),
    [items, ownedSet],
  );

  const toBuyItems = useMemo(
    () => shoppingItems.filter((item) => !purchasedSet.has(item.key)),
    [shoppingItems, purchasedSet],
  );
  const purchasedItems = useMemo(
    () => sortByName(shoppingItems.filter((item) => purchasedSet.has(item.key))),
    [shoppingItems, purchasedSet],
  );

  const toBuyGrouped = useMemo(() => {
    const grouped = toBuyItems.reduce<Record<string, GroceryItem[]>>((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category]!.push(item);
      return acc;
    }, {});
    for (const category of Object.keys(grouped)) {
      grouped[category] = sortByName(grouped[category]!);
    }
    return grouped;
  }, [toBuyItems]);

  const sortedCategories = useMemo(() => {
    const present = Object.keys(toBuyGrouped);
    return [
      ...CATEGORY_ORDER.filter((c) => present.includes(c)),
      ...present.filter((c) => !CATEGORY_ORDER.includes(c as IngredientCategory)).sort(),
    ];
  }, [toBuyGrouped]);

  const shoppingTotal = shoppingItems.length;
  const purchasedCount = purchasedItems.length;
  const progressPct = shoppingTotal > 0 ? (purchasedCount / shoppingTotal) * 100 : 0;

  useEffect(() => {
    if (pantryItems.length > prevOwnedCount.current) {
      setPantrySectionOpen(true);
    }
    prevOwnedCount.current = pantryItems.length;
  }, [pantryItems.length]);

  useEffect(() => {
    if (purchasedItems.length > prevPurchasedCount.current) {
      setPurchasedSectionOpen(true);
    }
    prevPurchasedCount.current = purchasedItems.length;
  }, [purchasedItems.length]);

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

  const hasSelection =
    selectedDateKeys.length > 0 || purchasedKeys.length > 0 || ownedKeys.length > 0;

  return (
    <div className="mx-auto max-w-lg px-4 pb-32 pt-4">
      <h1 className="mb-2 text-2xl font-bold tracking-tight text-slate-900">Grocery List</h1>
      {!groceryNoteDismissed && (
        <UsageNote
          text="Check items as you shop — they move to Purchased but stay on the list. Use Pantry for staples you already have at home."
          onDismiss={() => dismissUsageNote("grocery")}
        />
      )}
      <p className="mb-4 text-sm text-slate-500">
        Built from your meal plan. Quantities update as plans change.
      </p>
      {userProfile && (
        <p className="mb-4 card-surface px-4 py-2.5 text-center text-sm font-medium text-slate-700">
          {formatHouseholdCookingLine(userProfile)}
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
          onClick={clearGroceryAll}
          disabled={!hasSelection}
          className="min-h-[40px] rounded-full border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 disabled:opacity-40"
        >
          Clear all
        </button>
      </div>

      <section className="section-gap card-surface p-3">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setAnchorDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            className="text-sm text-slate-500"
          >
            Previous
          </button>
          <h2 className="text-sm font-semibold text-slate-900">{monthLabel}</h2>
          <button
            type="button"
            onClick={() => setAnchorDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            className="text-sm text-slate-500"
          >
            Next
          </button>
        </div>
        <p className="mb-2 text-center text-xs font-medium text-slate-500">
          Check a week or individual days to include in your list
        </p>
        <div className="mb-2 grid grid-cols-7 text-center text-[10px] font-medium uppercase text-slate-400">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="space-y-2">
          {calendarWeeks.map((week, weekIndex) => {
            const keys = weekKeys(week);
            const eligibleKeys = keys.filter((key) => isDateKeyOnOrAfter(key, todayDateKey));
            const weekSelected =
              eligibleKeys.length > 0 && eligibleKeys.every((k) => selectedDateSet.has(k));
            const weekPartial =
              !weekSelected && eligibleKeys.some((k) => selectedDateSet.has(k));
            return (
              <div
                key={weekIndex}
                className={`rounded-xl transition-all ${
                  weekSelected
                    ? "bg-blue-50 ring-2 ring-primary/50 shadow-sm"
                    : weekPartial
                      ? "bg-blue-50/40 ring-1 ring-primary/25"
                      : "border border-dashed border-slate-200 bg-slate-50/50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleWeek(week)}
                  disabled={eligibleKeys.length === 0}
                  className={`mb-1 flex min-h-[40px] w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    eligibleKeys.length === 0
                      ? "cursor-not-allowed opacity-50"
                      : weekSelected || weekPartial
                        ? "bg-primary/10"
                        : "hover:bg-white/80"
                  }`}
                  aria-pressed={weekSelected}
                  aria-label={`Toggle week ${weekLabel(week)}`}
                >
                  <span
                    className={`text-xs font-semibold ${
                      weekSelected || weekPartial ? "text-primary" : "text-slate-700"
                    }`}
                  >
                    Week · {weekLabel(week)}
                  </span>
                  <span
                    className={`mt-0.5 h-4 w-4 shrink-0 rounded border ${
                      weekSelected
                        ? "border-primary bg-primary"
                        : weekPartial
                          ? "border-primary bg-primary/40"
                          : "border-slate-300 bg-white"
                    }`}
                  />
                </button>
                <div className="grid grid-cols-7 gap-1 px-0.5 pb-1">
                  {week.map((date) => {
                    const key = toDateKey(date);
                    const isPast = isDateKeyBefore(key, todayDateKey);
                    const selected = !isPast && selectedDateSet.has(key);
                    const inMonth = date.getMonth() === currentMonth;
                    const hasMeals = (dailyPlans[key] ?? []).length > 0;
                    return (
                      <button
                        type="button"
                        key={key}
                        disabled={isPast}
                        onClick={() => {
                          if (!isPast) toggleGroceryDateSelected(key);
                        }}
                        className={`relative min-h-[52px] rounded-lg border px-1 py-1 text-left ${
                          isPast
                            ? "cursor-not-allowed border-slate-100 bg-slate-50 opacity-50"
                            : selected
                              ? "border-primary bg-blue-50 ring-1 ring-primary/40"
                              : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                        aria-pressed={selected}
                        aria-label={`Toggle ${date.toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span
                            className={`text-xs font-semibold ${inMonth ? "text-slate-800" : "text-slate-300"}`}
                          >
                            {date.getDate()}
                          </span>
                          <span
                            className={`mt-0.5 h-3.5 w-3.5 rounded border ${
                              selected
                                ? "border-primary bg-primary"
                                : "border-slate-300 bg-white"
                            }`}
                          />
                        </div>
                        {hasMeals && (
                          <span className="absolute bottom-1.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {items.length === 0 ? (
        <div className="card-surface p-6 text-sm text-slate-500">
          No grocery items for the selected days. Choose more days or generate plans for those
          dates.
        </div>
      ) : toBuyItems.length === 0 && purchasedItems.length === 0 && pantryItems.length > 0 ? (
        <div className="card-surface px-4 py-5 text-center text-sm text-slate-500">
          Everything is in your pantry — expand below to add items back to your shopping list.
        </div>
      ) : (
        <div className="space-y-4">
          {shoppingTotal > 0 && (
            <div className="card-surface px-4 py-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">Shopping progress</p>
                <p className="text-sm tabular-nums text-slate-500">
                  {purchasedCount} / {shoppingTotal} purchased
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

          {toBuyItems.length === 0 && purchasedItems.length > 0 ? (
            <div className="card-surface px-4 py-5 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
                <Check className="h-5 w-5 text-emerald-600" aria-hidden />
              </div>
              <p className="text-sm font-semibold text-slate-800">All items purchased</p>
              <p className="mt-1 text-xs text-slate-500">
                Uncheck anything below if you need to grab it after all.
              </p>
            </div>
          ) : (
            sortedCategories.map((category) => {
              const rows = toBuyGrouped[category] ?? [];
              if (rows.length === 0) return null;
              return (
                <section key={category} className="card-surface p-4">
                  <div className="mb-3 flex items-baseline justify-between gap-2">
                    <h2 className="text-base font-semibold text-slate-900">{category}</h2>
                    <span className="text-xs tabular-nums text-slate-400">
                      {rows.length} to buy
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {rows.map((item) => (
                      <li key={item.key}>
                        <GroceryItemRow
                          item={item}
                          checked={false}
                          onToggleChecked={() => togglePurchased(item.key)}
                          onMoveToPantry={() => toggleOwned(item.key)}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })
          )}

          {purchasedItems.length > 0 && (
            <CollapsibleGrocerySection
              title="Purchased"
              subtitle={`${purchasedItems.length} item${purchasedItems.length === 1 ? "" : "s"} checked off this trip`}
              icon={<ShoppingBag className="h-4 w-4 text-emerald-600" aria-hidden />}
              iconWrapClassName="bg-emerald-50"
              open={purchasedSectionOpen}
              onToggleOpen={() => setPurchasedSectionOpen((o) => !o)}
              tone="purchased"
            >
              <ul className="space-y-2">
                {purchasedItems.map((item) => (
                  <li key={item.key}>
                    <GroceryItemRow
                      item={item}
                      checked
                      onToggleChecked={() => togglePurchased(item.key)}
                      onMoveToPantry={() => toggleOwned(item.key)}
                    />
                  </li>
                ))}
              </ul>
            </CollapsibleGrocerySection>
          )}

          {pantryItems.length > 0 && (
            <CollapsibleGrocerySection
              title="Pantry"
              subtitle={`${pantryItems.length} item${pantryItems.length === 1 ? "" : "s"} already owned at home`}
              icon={<Package className="h-4 w-4 text-amber-700" aria-hidden />}
              iconWrapClassName="bg-amber-50"
              open={pantrySectionOpen}
              onToggleOpen={() => setPantrySectionOpen((o) => !o)}
              tone="pantry"
            >
              <ul className="space-y-2">
                {pantryItems.map((item) => (
                  <li key={item.key}>
                    <PantryItemRow
                      item={item}
                      onRestore={() => toggleOwned(item.key)}
                    />
                  </li>
                ))}
              </ul>
            </CollapsibleGrocerySection>
          )}
        </div>
      )}
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
  onToggleChecked,
  onMoveToPantry,
}: {
  item: GroceryItem;
  checked: boolean;
  onToggleChecked: () => void;
  onMoveToPantry: () => void;
}) {
  return (
    <div
      className={`group flex items-center gap-2 rounded-xl border transition-all duration-300 ease-out ${
        checked
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
          <span className={`font-medium tabular-nums ${checked ? "" : "text-slate-900"}`}>
            {formatQty(item.quantity)}
          </span>{" "}
          <span className="text-slate-500">{item.unit}</span> {item.name}
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
        Pantry
      </button>
    </div>
  );
}

function PantryItemRow({
  item,
  onRestore,
}: {
  item: GroceryItem;
  onRestore: () => void;
}) {
  return (
    <div className="flex min-h-[48px] items-center gap-3 rounded-xl border border-amber-100/80 bg-amber-50/40 px-3 py-2 opacity-80">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100/80">
        <Package className="h-3.5 w-3.5 text-amber-700" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-sm text-slate-500 line-through decoration-slate-300">
        <span className="font-medium tabular-nums">{formatQty(item.quantity)}</span>{" "}
        {item.unit} {item.name}
      </span>
      <button
        type="button"
        onClick={onRestore}
        className="flex shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-primary ring-1 ring-slate-200 transition-colors hover:bg-primary/5"
      >
        <RotateCcw className="h-3 w-3" aria-hidden />
        Add to list
      </button>
    </div>
  );
}
