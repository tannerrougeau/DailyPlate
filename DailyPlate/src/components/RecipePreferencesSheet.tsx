import type { ReactNode } from "react";
import { Heart, ThumbsDown, X } from "lucide-react";
import { recipeLibrary } from "@/recipes/recipeLibrary";
import { useAppStore } from "@/store/useAppStore";

export function RecipePreferencesSheet({ onClose }: { onClose: () => void }) {
  const favoriteIds = useAppStore((s) => s.favoriteIds);
  const dislikedIds = useAppStore((s) => s.dislikedIds);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const toggleDislike = useAppStore((s) => s.toggleDislike);

  const favorites = favoriteIds
    .map((id) => recipeLibrary.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => r != null);

  const dislikes = dislikedIds
    .map((id) => recipeLibrary.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => r != null);

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close preferences"
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
            Favorites & dislikes
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

        <div className="overflow-y-auto px-5 py-5">
          <p className="mb-5 text-sm leading-relaxed text-slate-600">
            Recipes you favorite or dislike from meal cards update your food preferences — similar
            to check-in — and shape future plans. Remove any entry here if you tapped by accident
            or want to repersonalize.
          </p>

          <PreferenceSection
            title="Favorites"
            icon={<Heart className="h-4 w-4 fill-red-500 text-red-500" />}
            empty="No favorite recipes yet."
            recipes={favorites}
            onRemove={(id) => toggleFavorite(id)}
            removeLabel="Remove from favorites"
          />

          <PreferenceSection
            title="Dislikes"
            icon={<ThumbsDown className="h-4 w-4 fill-slate-700 text-slate-700" />}
            empty="No disliked recipes yet."
            recipes={dislikes}
            onRemove={(id) => toggleDislike(id)}
            removeLabel="Remove dislike"
          />
        </div>
      </div>
    </div>
  );
}

function PreferenceSection({
  title,
  icon,
  empty,
  recipes,
  onRemove,
  removeLabel,
}: {
  title: string;
  icon: ReactNode;
  empty: string;
  recipes: { id: string; name: string; cuisine: string }[];
  onRemove: (id: string) => void;
  removeLabel: string;
}) {
  return (
    <section className="mb-6">
      <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
        {icon}
        {title}
        <span className="text-sm font-normal text-slate-400">({recipes.length})</span>
      </h3>
      {recipes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
          {empty}
        </p>
      ) : (
        <ul className="space-y-2">
          {recipes.map((recipe) => (
            <li
              key={recipe.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{recipe.name}</p>
                <p className="truncate text-xs capitalize text-slate-500">{recipe.cuisine}</p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(recipe.id)}
                className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-800"
              >
                {removeLabel}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
