import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { ScanItem } from "@/server/scan/types";
import { useAppStore } from "@/store/useAppStore";
import type { DailyTargets } from "@/types";
import type { FoodItem, FoodPortion } from "@/utils/foodTypes";
import { applyPortion, fetchPortions, fitLine, proteinTopUp, SEARCH_FAILED_MESSAGE, searchFoods } from "@/utils/foodSearch";
import { recentSnacks } from "@/utils/snackItems";
import { combineFoods, itemQuery, pickMatch, portionLabel, sizeFood } from "@/utils/scan/scanFlow";

type Row = {
  key: string;
  item: ScanItem;
  /** null while searching. */
  results: FoodItem[] | null;
  failed: boolean;
  match: FoodItem | null;
  portions: FoodPortion[];
  /** "ai" (the scan's estimate), a USDA portion index, or "grams". */
  choice: string;
  grams: string;
  changing: boolean;
};

const AI = "ai";
const GRAMS = "grams";

/** The food as logged for a row: never the AI's calories, always the match's values at a weight. */
function sizedFor(row: Row): FoodItem | null {
  const m = row.match;
  if (!m) return null;
  if (row.choice === AI) return sizeFood(m, row.item.portion.grams, portionLabel(row.item.portion)) ?? (m.generic ? null : m);
  if (row.choice === GRAMS) {
    const g = Number(row.grams);
    return sizeFood(m, g, `${Math.round(g)} g`) ?? (m.generic ? null : m);
  }
  const p = row.portions[Number(row.choice)];
  return p ? applyPortion(m, p) : null;
}

/**
 * Each identified food matched to USDA (or Open Food Facts) through the normal search, with the
 * scan's portion filled in. The user can change the match or portion; then one combined log.
 */
export function ScanFoodsReview({
  items,
  target,
  forLabel,
  onSearchInstead,
  onLog,
}: {
  items: ScanItem[];
  target: Pick<DailyTargets, "calories" | "protein"> | null;
  forLabel: string;
  onSearchInstead: () => void;
  onLog: (combined: FoodItem, parts: { aiName: string; food: FoodItem }[], servings: number) => void;
}) {
  const myFoods = useAppStore((s) => s.myFoods);
  const snackLogs = useAppStore((s) => s.snackLogs);
  const [rows, setRows] = useState<Row[]>(() =>
    items.map((item, i) => ({
      key: `${i}:${item.name}`,
      item,
      results: null,
      failed: false,
      match: null,
      portions: [],
      choice: AI,
      grams: String(Math.round(item.portion.grams)),
      changing: false,
    })),
  );

  const update = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function choose(key: string, food: FoodItem) {
    update(key, { match: food, changing: false, portions: [], choice: AI });
    const portions = await fetchPortions(food);
    update(key, { portions });
  }

  async function search(key: string, query: string, item: ScanItem) {
    update(key, { results: null, failed: false });
    const out = await searchFoods(query, { myFoods, recent: recentSnacks(snackLogs, 20) });
    const results = [...out.local, ...out.remote];
    update(key, { results, failed: Boolean(out.failed || out.offline) && results.length === 0 });
    const match = pickMatch(item, results);
    if (match) await choose(key, match);
  }

  useEffect(() => {
    for (const r of rows) void search(r.key, itemQuery(r.item), r.item);
    // Search once per scanned item when the review opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sized = rows.map((r) => ({ row: r, food: sizedFor(r) }));
  const ready = rows.length > 0 && sized.every((s) => s.food) && rows.every((r) => r.results !== null);
  const combined = ready ? combineFoods(sized.map((s) => s.food!)) : null;
  const topUp = combined && target ? proteinTopUp(Math.round(target.protein - combined.protein)) : null;

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.key} className="rounded-2xl border border-slate-200 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">
                Scanned: {r.item.brand ? `${r.item.brand} ` : ""}
                {r.item.name}
              </p>
              {r.results === null ? (
                <p className="mt-1 text-sm text-slate-500">Finding it in USDA…</p>
              ) : r.match ? (
                <p className="mt-0.5 text-sm font-semibold text-slate-900">
                  {r.match.name}
                  {r.match.brand ? <span className="font-normal text-slate-500"> · {r.match.brand}</span> : null}
                </p>
              ) : (
                <p className="mt-1 text-sm text-amber-800">{r.failed ? SEARCH_FAILED_MESSAGE : "No match found."}</p>
              )}
              {r.item.notes.length > 0 && <p className="mt-0.5 text-xs text-slate-500">Noted: {r.item.notes.join(", ")}</p>}
            </div>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
                aria-label={`Remove ${r.item.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {r.match && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <select
                value={r.choice}
                onChange={(e) => update(r.key, { choice: e.target.value })}
                className="min-h-[40px] max-w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
                aria-label={`Portion of ${r.match.name}`}
              >
                <option value={AI}>
                  {portionLabel(r.item.portion)}, about {Math.round(r.item.portion.grams)} g
                </option>
                {r.portions.map((p, i) => (
                  <option key={p.label} value={String(i)}>
                    {p.label} ({Math.round(p.grams)} g)
                  </option>
                ))}
                <option value={GRAMS}>Grams…</option>
              </select>
              {r.choice === GRAMS && (
                <label className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={r.grams}
                    onChange={(e) => update(r.key, { grams: e.target.value })}
                    className="min-h-[40px] w-20 rounded-lg border border-slate-200 px-2 text-sm"
                    aria-label="Grams"
                  />
                  <span className="text-xs text-slate-500">g</span>
                </label>
              )}
              {sizedFor(r) == null && (
                <span className="text-xs text-amber-800">No weight for this item: pick a portion.</span>
              )}
            </div>
          )}

          {r.results !== null && (
            <button
              type="button"
              onClick={() => update(r.key, { changing: !r.changing })}
              className="mt-2 text-xs font-semibold text-[#2563EB]"
              aria-expanded={r.changing}
            >
              {r.changing ? "Keep this match" : "Change"}
            </button>
          )}
          {r.changing && (
            <ChangeMatch
              results={r.results ?? []}
              initialQuery={itemQuery(r.item)}
              onPick={(f) => void choose(r.key, f)}
              onSearch={(q) => void search(r.key, q, { ...r.item, brand: null })}
            />
          )}
        </div>
      ))}

      {combined && target && <p className="text-sm leading-relaxed text-slate-700">{fitLine(combined, target, forLabel)}</p>}
      {topUp && <p className="text-sm leading-relaxed text-slate-700">{topUp}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!combined}
          onClick={() => combined && onLog(combined, sized.map((s) => ({ aiName: s.row.item.name, food: s.food! })), 1)}
          className="min-h-[44px] flex-1 rounded-xl bg-[#2563EB] text-sm font-semibold text-white disabled:opacity-40"
        >
          Log it
        </button>
        <button type="button" onClick={onSearchInstead} className="min-h-[44px] px-2 text-sm font-semibold text-slate-500">
          Search instead
        </button>
      </div>
    </div>
  );
}

function ChangeMatch({
  results,
  initialQuery,
  onPick,
  onSearch,
}: {
  results: FoodItem[];
  initialQuery: string;
  onPick: (food: FoodItem) => void;
  onSearch: (query: string) => void;
}) {
  const [q, setQ] = useState(initialQuery);
  return (
    <div className="mt-2 border-t border-slate-100 pt-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) onSearch(q.trim());
        }}
        className="flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search for a different match"
          className="min-h-[40px] min-w-0 flex-1 rounded-lg border border-slate-200 px-2 text-sm"
        />
        <button type="submit" className="min-h-[40px] rounded-lg bg-slate-100 px-3 text-sm font-semibold text-slate-700">
          Search
        </button>
      </form>
      <ul className="mt-1 divide-y divide-slate-100">
        {results.slice(0, 8).map((f) => (
          <li key={f.id}>
            <button type="button" onClick={() => onPick(f)} className="flex min-h-[44px] w-full flex-col justify-center py-1 text-left">
              <span className="truncate text-sm font-semibold text-slate-900">
                {f.name}
                {f.brand ? <span className="font-normal text-slate-500"> · {f.brand}</span> : null}
              </span>
              <span className="text-xs text-slate-500">
                {f.servingLabel} · {f.calories} kcal · {Math.round(f.protein)}g protein
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
