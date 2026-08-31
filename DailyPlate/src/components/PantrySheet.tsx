import { Package, X } from "lucide-react";
import { useOverlayBack } from "@/hooks/useOverlayBack";
import type { GroceryItem } from "@/types";
import { formatQty } from "@/utils/grocery";

function parseOwnedKey(key: string): { name: string; unit: string } {
  const parts = key.split("::");
  return { name: parts[1] ?? key, unit: parts[2] ?? "" };
}

export function PantrySheet({
  items,
  ownedKeys,
  checkedKeys,
  onToggleChecked,
  onRemoveFromPantry,
  onClose,
}: {
  items: GroceryItem[];
  ownedKeys: string[];
  checkedKeys: string[];
  onToggleChecked: (key: string) => void;
  onRemoveFromPantry: (key: string) => void;
  onClose: () => void;
}) {
  useOverlayBack(true, onClose);
  const byKey = new Map(items.map((item) => [item.key, item]));
  const rows = ownedKeys.map((key) => {
    const item = byKey.get(key);
    if (item) return item;
    const parsed = parseOwnedKey(key);
    return {
      key,
      name: parsed.name,
      quantity: 0,
      unit: parsed.unit,
      category: "Pantry" as const,
    };
  });

  return (
    <div className="fixed inset-0 z-[86] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close pantry"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-labelledby="pantry-title"
        className="relative z-[87] flex max-h-[88dvh] w-full max-w-lg flex-col overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50">
              <Package className="h-4 w-4 text-amber-700" aria-hidden />
            </span>
            <h2 id="pantry-title" className="text-lg font-bold text-slate-900">
              Pantry
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Items you already have at home. Checking one keeps it visible. Inventory stays after you
          generate a new plan.
        </p>
        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            Nothing in pantry yet. Mark grocery items as Pantry to save them here.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((item) => {
              const checked = checkedKeys.includes(item.key);
              return (
                <li key={item.key}>
                  <div
                    className={`flex min-h-[48px] items-center gap-3 rounded-xl border px-3 py-2 ${
                      checked
                        ? "border-amber-100 bg-amber-50/60"
                        : "border-slate-100 bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      aria-label={`Mark ${item.name} ${checked ? "unchecked" : "checked"} in pantry`}
                      onClick={() => onToggleChecked(item.key)}
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
                        checked
                          ? "border-amber-600 bg-amber-600 text-white"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {checked ? "✓" : ""}
                    </button>
                    <span
                      className={`min-w-0 flex-1 text-sm ${
                        checked ? "text-slate-500" : "text-slate-800"
                      }`}
                    >
                      {item.quantity > 0 && (
                        <span className="font-medium tabular-nums">{formatQty(item.quantity)} </span>
                      )}
                      {item.unit} {item.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveFromPantry(item.key)}
                      className="text-[11px] font-semibold text-slate-400 hover:text-slate-700"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
