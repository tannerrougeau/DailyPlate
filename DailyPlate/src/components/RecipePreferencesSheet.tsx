import { X } from "lucide-react";
import { allRecipes } from "@/recipes/recipePool";
import { type PreferenceKind, useAppStore } from "@/store/useAppStore";
import { useOverlayBack } from "@/hooks/useOverlayBack";
import { customTokens, DISLIKED_FOOD_CHIPS, FAVORITE_FOOD_CHIPS } from "@/utils/chipMatching";
import { PROTEIN_SOURCE_PREF_OPTIONS } from "@/utils/planningPrefs";
import { CUISINE_OPTIONS } from "@/utils/personalizationEngine";

type Entry = { key: string; name: string; onRemove: () => void };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Favorites view: compact name lists, each with a remove ×. Removing affects the next plan right away. */
export function RecipePreferencesSheet({ onClose }: { onClose: () => void }) {
  useOverlayBack(true, onClose);
  const favoriteIds = useAppStore((s) => s.favoriteIds);
  const dislikedIds = useAppStore((s) => s.dislikedIds);
  const profile = useAppStore((s) => s.userProfile);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const toggleDislike = useAppStore((s) => s.toggleDislike);
  const removePreference = useAppStore((s) => s.removePreference);
  const userRecipes = useAppStore((s) => s.userRecipes);
  const library = allRecipes(userRecipes);

  const recipeEntries = (ids: string[], remove: (id: string) => void): Entry[] =>
    ids
      .map((id) => library.find((r) => r.id === id))
      .filter((r): r is NonNullable<typeof r> => r != null)
      .map((r) => ({ key: r.id, name: r.name, onRemove: () => remove(r.id) }));

  const pref = (kind: PreferenceKind, value: string, name: string): Entry => ({
    key: `${kind}:${value}`,
    name,
    onRemove: () => removePreference(kind, value),
  });

  const favoriteFoods: Entry[] = profile
    ? [
        ...profile.favoriteFoodChips
          .filter((id) => id !== "none")
          .map((id) => pref("favoriteChip", id, FAVORITE_FOOD_CHIPS.find((c) => c.id === id)?.label ?? cap(id))),
        ...customTokens(profile.favoriteFoodCustom ?? "").map((t) => pref("favoriteCustom", t, cap(t))),
      ]
    : [];
  const avoidedFoods: Entry[] = profile
    ? [
        ...profile.dislikedFoodChips
          .filter((id) => id !== "none")
          .map((id) => pref("avoidChip", id, DISLIKED_FOOD_CHIPS.find((c) => c.id === id)?.label ?? cap(id))),
        ...(profile.avoidedProteinSources ?? []).map((id) =>
          pref("avoidProtein", id, PROTEIN_SOURCE_PREF_OPTIONS.find((o) => o.id === id)?.label ?? cap(id)),
        ),
        ...customTokens(profile.dislikedFoodCustom ?? "").map((t) => pref("avoidCustom", t, cap(t))),
      ]
    : [];
  const cuisines: Entry[] = (profile?.preferredCuisines ?? []).map((id) =>
    pref("cuisine", id, CUISINE_OPTIONS.find((c) => c.id === id)?.label ?? cap(id)),
  );

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close favorites"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-labelledby="prefs-title"
        className="relative z-[86] flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-3xl border border-slate-200 bg-[#f5f5f4] shadow-2xl sm:rounded-3xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <h2 id="prefs-title" className="text-lg font-bold text-slate-900">
            Favorites
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

        <div className="space-y-5 overflow-y-auto px-5 py-4">
          <p className="text-xs leading-relaxed text-slate-500">
            Tap × to remove anything. Your next plan uses the change right away.
          </p>
          <NameList title="Liked recipes" entries={recipeEntries(favoriteIds, toggleFavorite)} />
          <NameList title="Disliked recipes" entries={recipeEntries(dislikedIds, toggleDislike)} />
          <NameList title="Favorite foods" entries={favoriteFoods} />
          <NameList title="Avoided foods" entries={avoidedFoods} />
          <NameList title="Preferred cuisines" entries={cuisines} />
        </div>
      </div>
    </div>
  );
}

function NameList({ title, entries }: { title: string; entries: Entry[] }) {
  return (
    <section>
      <h3 className="mb-1.5 text-sm font-semibold text-slate-900">
        {title} <span className="font-normal text-slate-400">({entries.length})</span>
      </h3>
      {entries.length === 0 ? (
        <p className="text-xs text-slate-400">None yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {entries.map((e) => (
            <li key={e.key} className="flex items-center gap-2 py-0.5 pl-3 pr-1">
              <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{e.name}</span>
              <button
                type="button"
                onClick={e.onRemove}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                aria-label={`Remove ${e.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
