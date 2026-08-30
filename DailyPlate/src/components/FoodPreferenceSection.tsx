import {
  DISLIKED_FOOD_CHIPS,
  FAVORITE_FOOD_CHIPS,
} from "@/utils/chipMatching";

function toggleChipList(list: string[], id: string, exclusiveId: string): string[] {
  if (id === exclusiveId) return [exclusiveId];
  const next = list.filter((x) => x !== exclusiveId);
  if (next.includes(id)) return next.filter((x) => x !== id);
  return [...next, id];
}

type FoodPreferenceSectionProps = {
  favoriteChips: string[];
  dislikedChips: string[];
  favoriteCustom: string;
  dislikedCustom: string;
  onFavoriteChipsChange: (chips: string[]) => void;
  onDislikedChipsChange: (chips: string[]) => void;
  onFavoriteCustomChange: (value: string) => void;
  onDislikedCustomChange: (value: string) => void;
};

export function FoodPreferenceSection({
  favoriteChips,
  dislikedChips,
  favoriteCustom,
  dislikedCustom,
  onFavoriteChipsChange,
  onDislikedChipsChange,
  onFavoriteCustomChange,
  onDislikedCustomChange,
}: FoodPreferenceSectionProps) {
  return (
    <>
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-900">Foods you love</h3>
        <p className="text-sm text-slate-500">
          Whole foods and common recipe ingredients — tap all that apply.
        </p>
        <div className="flex flex-wrap gap-2">
          {FAVORITE_FOOD_CHIPS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() =>
                onFavoriteChipsChange(toggleChipList(favoriteChips, c.id, "none"))
              }
              className={`min-h-[44px] rounded-full border-2 px-3.5 text-sm font-semibold ${
                favoriteChips.includes(c.id)
                  ? "border-[#2563EB] bg-blue-50 text-blue-900"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">
            Additional favorites (comma-separated)
          </span>
          <input
            type="text"
            value={favoriteCustom}
            onChange={(e) => onFavoriteCustomChange(e.target.value)}
            placeholder="e.g. turkey, basil, balsamic"
            className="min-h-[48px] w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#2563EB]"
          />
        </label>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-900">Strongly disliked</h3>
        <p className="text-sm text-slate-500">
          We avoid recipes that match these ingredients or additives.
        </p>
        <div className="flex flex-wrap gap-2">
          {DISLIKED_FOOD_CHIPS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() =>
                onDislikedChipsChange(toggleChipList(dislikedChips, c.id, "none"))
              }
              className={`min-h-[44px] rounded-full border-2 px-3.5 text-sm font-semibold ${
                dislikedChips.includes(c.id)
                  ? "border-red-400 bg-red-50 text-red-900"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">
            Additional avoids (comma-separated)
          </span>
          <input
            type="text"
            value={dislikedCustom}
            onChange={(e) => onDislikedCustomChange(e.target.value)}
            placeholder="e.g. coconut, bell pepper, mayo"
            className="min-h-[48px] w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#2563EB]"
          />
        </label>
      </section>
    </>
  );
}
