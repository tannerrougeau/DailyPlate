import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import type { FoodItem } from "@/utils/foodTypes";
import {
  manualFood,
  OFFLINE_MESSAGE,
  SEARCH_FAILED_MESSAGE,
  searchFoods,
  type FoodSearchOutcome,
} from "@/utils/foodSearch";
import { recentSnacks } from "@/utils/snackItems";
import { keepInPlace } from "@/utils/scrollAnchor";

/**
 * Find a food by name: saved and recent foods first, then USDA and Open Food Facts (searched only
 * on submit), with manual entry from a label always available.
 */
export function FoodSearchPanel({
  onPick,
  initialQuery,
  startWithManual,
}: {
  onPick: (food: FoodItem) => void;
  /** Search this right away (scan suggestions, "Search instead"). */
  initialQuery?: string;
  /** Open "Enter from a label" right away. */
  startWithManual?: boolean;
}) {
  const myFoods = useAppStore((s) => s.myFoods);
  const snackLogs = useAppStore((s) => s.snackLogs);
  const [query, setQuery] = useState(initialQuery ?? "");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<FoodSearchOutcome | null>(null);
  const [manualOpen, setManualOpen] = useState(Boolean(startWithManual));

  async function submit(q = query) {
    if (!q.trim()) return;
    setBusy(true);
    try {
      setOutcome(await searchFoods(q, { myFoods, recent: recentSnacks(snackLogs, 20) }));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (initialQuery?.trim()) void submit(initialQuery);
    // Run once for the query the panel opened with.
  }, []);

  const usda = outcome?.remote.filter((f) => f.source === "usda") ?? [];
  const off = outcome?.remote.filter((f) => f.source === "off") ?? [];
  const nothing =
    outcome && outcome.local.length === 0 && outcome.remote.length === 0 && !outcome.offline && !outcome.failed;

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="flex items-center gap-2"
      >
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3">
          <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a food, e.g. turkey hoagie"
            aria-label="Search a food by name"
            className="min-h-[44px] w-full bg-transparent text-sm outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !query.trim()}
          className="min-h-[44px] shrink-0 rounded-xl bg-[#2563EB] px-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? "Searching…" : "Search"}
        </button>
      </form>

      {outcome?.offline && <p className="mt-2 text-xs text-amber-800">{OFFLINE_MESSAGE}</p>}
      {outcome?.failed && <p className="mt-2 text-xs text-amber-800">{SEARCH_FAILED_MESSAGE}</p>}
      {nothing && <p className="mt-2 text-xs text-slate-500">No matches. Try other words, or enter it from the label.</p>}

      <FoodGroup title="My foods" foods={outcome?.local ?? []} onPick={onPick} />
      <FoodGroup title="USDA FoodData Central" foods={usda} onPick={onPick} />
      <FoodGroup title="Open Food Facts" foods={off} onPick={onPick} credit="Data: Open Food Facts" />

      <button
        type="button"
        onClick={(e) => keepInPlace(e.currentTarget, () => setManualOpen((o) => !o))}
        className="mt-3 text-xs font-semibold text-[#2563EB]"
        aria-expanded={manualOpen}
      >
        {manualOpen ? "Hide label entry" : "Enter from a label"}
      </button>
      {manualOpen && <ManualEntry onPick={onPick} />}
    </div>
  );
}

function FoodGroup({
  title,
  foods,
  onPick,
  credit,
}: {
  title: string;
  foods: FoodItem[];
  onPick: (food: FoodItem) => void;
  credit?: string;
}) {
  if (foods.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <ul className="mt-1 divide-y divide-slate-100">
        {foods.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => onPick(f)}
              className="flex min-h-[52px] w-full flex-col justify-center px-1 py-1.5 text-left hover:bg-slate-50"
            >
              <span className="truncate text-sm font-semibold text-slate-900">
                {f.name}
                {f.brand ? <span className="font-normal text-slate-500"> · {f.brand}</span> : null}
              </span>
              <span className="text-xs tabular-nums text-slate-500">
                {f.servingLabel} · {f.calories} kcal · {Math.round(f.protein)}g protein
              </span>
            </button>
          </li>
        ))}
      </ul>
      {credit && <p className="mt-1 px-1 text-[11px] text-slate-400">{credit}</p>}
    </div>
  );
}

function ManualEntry({ onPick }: { onPick: (food: FoodItem) => void }) {
  const [name, setName] = useState("");
  const [serving, setServing] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const ok = name.trim() !== "" && Number(kcal) > 0 && protein.trim() !== "" && Number(protein) >= 0;
  const field = "mt-0.5 min-h-[44px] w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#2563EB]";
  return (
    <div className="mt-2 rounded-2xl border border-slate-200 p-3">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className={field} />
      <input
        value={serving}
        onChange={(e) => setServing(e.target.value)}
        placeholder="Serving size, e.g. 1 container (150 g)"
        className={`${field} mt-2`}
      />
      <div className="mt-2 grid grid-cols-2 gap-2">
        {(
          [
            ["Calories", kcal, setKcal],
            ["Protein (g)", protein, setProtein],
            ["Carbs (g, optional)", carbs, setCarbs],
            ["Fat (g, optional)", fat, setFat],
          ] as const
        ).map(([label, value, set]) => (
          <label key={label} className="block">
            <span className="text-[11px] font-medium text-slate-500">{label}</span>
            <input type="number" min={0} inputMode="numeric" value={value} onChange={(e) => set(e.target.value)} className={field} />
          </label>
        ))}
      </div>
      <button
        type="button"
        disabled={!ok}
        onClick={() =>
          onPick(
            manualFood({
              name,
              servingLabel: serving,
              calories: Number(kcal),
              protein: Number(protein),
              carbs: carbs.trim() ? Number(carbs) : undefined,
              fat: fat.trim() ? Number(fat) : undefined,
            }),
          )
        }
        className="mt-2 min-h-[44px] w-full rounded-xl bg-[#2563EB] text-sm font-semibold text-white disabled:opacity-40"
      >
        Use this food
      </button>
    </div>
  );
}
