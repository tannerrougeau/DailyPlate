import { useEffect, useMemo, useState } from "react";
import { ChefHat, Heart, Search } from "lucide-react";
import { MealPrepSheet } from "@/components/MealPrepSheet";
import { RecipeDetailsBody } from "@/components/RecipeDetailsBody";
import { RecipeImage } from "@/components/RecipeImage";
import { RecipePreferencesSheet } from "@/components/RecipePreferencesSheet";
import { UsageNote } from "@/components/UsageNote";
import { useAppStore } from "@/store/useAppStore";
import { recipeLibrary } from "@/recipes/recipeLibrary";
import type { CarbVariationId, Recipe } from "@/types";
import { isMealPrepFriendly } from "@/utils/mealPrep";
import {
  countRecipesByProtein,
  filterRecipesForLibrary,
  getProteinSource,
  PROTEIN_SOURCE_FILTERS,
  proteinSourceLabel,
  RECIPE_CATEGORY_TABS,
  type ProteinSourceFilter,
  type RecipeCategory,
} from "@/utils/recipeProteinSource";

export function RecipesScreen() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [category, setCategory] = useState<RecipeCategory>("breakfast");
  const [proteinSource, setProteinSource] = useState<ProteinSourceFilter>("all");
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [mealPrepRecipe, setMealPrepRecipe] = useState<Recipe | null>(null);
  const recipesNoteDismissed = useAppStore((s) => s.dismissedUsageNotes.recipes);
  const dismissUsageNote = useAppStore((s) => s.dismissUsageNote);
  const favoriteIds = useAppStore((s) => s.favoriteIds);
  const dislikedIds = useAppStore((s) => s.dislikedIds);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [selected?.id ?? "list"]);

  const proteinCounts = useMemo(
    () => countRecipesByProtein(recipeLibrary, category),
    [category],
  );

  const filtered = useMemo(
    () => filterRecipesForLibrary(recipeLibrary, category, proteinSource, query),
    [category, proteinSource, query],
  );

  const categoryLabel = RECIPE_CATEGORY_TABS.find((t) => t.id === category)?.label ?? category;

  if (selected) {
    return (
      <>
        <RecipeDetail
          recipe={selected}
          onBack={() => setSelected(null)}
          onMealPrep={() => setMealPrepRecipe(selected)}
        />
        {mealPrepRecipe && (
          <MealPrepSheet recipe={mealPrepRecipe} onClose={() => setMealPrepRecipe(null)} />
        )}
      </>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-32 pt-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Recipes</h1>
        <button
          type="button"
          onClick={() => setPrefsOpen(true)}
          className="flex min-h-[40px] shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300"
        >
          <Heart className="h-4 w-4 text-red-500" aria-hidden />
          Favorites
          {(favoriteIds.length > 0 || dislikedIds.length > 0) && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs tabular-nums text-slate-600">
              {favoriteIds.length + dislikedIds.length}
            </span>
          )}
        </button>
      </div>

      {!recipesNoteDismissed && (
        <UsageNote
          text="Browse by meal type, filter by protein source, and search — recipes are sorted A–Z."
          onDismiss={() => dismissUsageNote("recipes")}
        />
      )}

      {/* Meal category */}
      <section aria-label="Meal category" className="mb-3 card-surface p-1.5">
        <div className="grid grid-cols-4 gap-1">
          {RECIPE_CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategory(tab.id)}
              aria-pressed={category === tab.id}
              className={`min-h-[44px] rounded-xl px-1 text-xs font-semibold transition-colors ${
                category === tab.id
                  ? "bg-primary text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* Protein source — horizontal chips for mobile */}
      <section aria-label="Protein source filter" className="mb-4">
        <p className="mb-2 px-0.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Protein source
        </p>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none">
          {PROTEIN_SOURCE_FILTERS.map((option) => {
            const count = proteinCounts[option.id];
            const active = proteinSource === option.id;
            const disabled = option.id !== "all" && count === 0;
            return (
              <button
                key={option.id}
                type="button"
                disabled={disabled}
                aria-pressed={active}
                onClick={() => setProteinSource(option.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors disabled:opacity-35 ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                {option.shortLabel}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                    active ? "bg-primary/15 text-primary" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Search */}
      <div className="mb-4 card-surface p-3">
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search recipes, tags, or cuisine…"
            className="min-h-[44px] w-full bg-transparent text-sm outline-none"
          />
        </label>
      </div>

      <p className="mb-4 px-0.5 text-xs text-slate-500">
        {filtered.length === 0
          ? `No ${categoryLabel.toLowerCase()} recipes match`
          : `${filtered.length} ${categoryLabel.toLowerCase()} recipe${filtered.length === 1 ? "" : "s"}`}
        {proteinSource !== "all" &&
          ` · ${PROTEIN_SOURCE_FILTERS.find((o) => o.id === proteinSource)?.label}`}
        {filtered.length > 0 && " · sorted A–Z"}
      </p>

      <ul className="grid grid-cols-2 gap-3">
        {filtered.length === 0 && (
          <li className="col-span-2 card-surface px-4 py-10 text-center">
            <p className="text-sm font-medium text-slate-600">No recipes found</p>
            <p className="mt-1 text-xs text-slate-400">
              Try another protein filter, category, or search term.
            </p>
            {(proteinSource !== "all" || query) && (
              <button
                type="button"
                onClick={() => {
                  setProteinSource("all");
                  setQuery("");
                }}
                className="mt-4 text-sm font-semibold text-primary"
              >
                Clear filters
              </button>
            )}
          </li>
        )}
        {filtered.map((recipe) => {
          const protein = getProteinSource(recipe);
          return (
            <li key={recipe.id}>
              <button
                type="button"
                onClick={() => setSelected(recipe)}
                className="group w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-left shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="overflow-hidden">
                  <RecipeImage
                    recipe={recipe}
                    aspect="wide"
                    className="w-full transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="p-3">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">
                    {recipe.name}
                    {isMealPrepFriendly(recipe) && (
                      <span className="ml-1 inline-block rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-800">
                        Prep
                      </span>
                    )}
                  </p>
                  <p className="mt-1 truncate text-xs capitalize text-slate-400">
                    {recipe.cuisine}
                    <span className="mx-1 text-slate-300">·</span>
                    {proteinSourceLabel(protein)}
                  </p>
                  <p className="mt-2 text-xs tabular-nums text-slate-500">
                    {recipe.calories} kcal · P {recipe.protein}g
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {prefsOpen && <RecipePreferencesSheet onClose={() => setPrefsOpen(false)} />}
    </div>
  );
}

function RecipeDetail({
  recipe,
  onBack,
  onMealPrep,
}: {
  recipe: Recipe;
  onBack: () => void;
  onMealPrep: () => void;
}) {
  const [variationId, setVariationId] = useState<string | undefined>(
    recipe.variationDetails?.[0]?.id,
  );
  const [carbVariationId, setCarbVariationId] = useState<CarbVariationId>("white-rice");

  return (
    <div className="mx-auto max-w-lg px-4 pb-32 pt-4">
      <button type="button" onClick={onBack} className="mb-4 text-sm font-medium text-slate-500">
        ← Back to Recipes
      </button>
      <article className="overflow-hidden card-surface">
        <RecipeImage recipe={recipe} aspect="wide" className="w-full" priority />
        <div className="p-5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{recipe.name}</h1>
          <p className="mt-2 text-sm capitalize text-slate-500">
            {recipe.cuisine} · {proteinSourceLabel(getProteinSource(recipe))} · Prep{" "}
            {recipe.prepMinutes} min · Cook {recipe.cookMinutes} min
          </p>
          {isMealPrepFriendly(recipe) && (
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-900">
              <ChefHat className="h-3.5 w-3.5" aria-hidden />
              Meal prep friendly
            </span>
          )}
          <button
            type="button"
            onClick={onMealPrep}
            className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-violet-200 bg-violet-50 px-4 text-sm font-semibold text-violet-950"
          >
            <ChefHat className="h-5 w-5" aria-hidden />
            Cook as Meal Prep (Make Leftovers)
          </button>

          <section className="mt-6">
            <RecipeDetailsBody
              recipe={recipe}
              variationId={variationId}
              onVariationChange={setVariationId}
              carbVariationId={carbVariationId}
              onCarbVariationChange={setCarbVariationId}
            />
          </section>
        </div>
      </article>
    </div>
  );
}
