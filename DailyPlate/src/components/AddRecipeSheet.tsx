import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useOverlayBack } from "@/hooks/useOverlayBack";
import { useAppStore } from "@/store/useAppStore";
import type { IngredientCategory, MealSlotId, RecipeIngredient } from "@/types";
import {
  CUSTOM_RECIPE_SCALE_NOTICE,
  emptyIngredient,
  INGREDIENT_CATEGORIES,
  buildUserRecipe,
} from "@/utils/userRecipe";

const MEAL_TYPES: { id: MealSlotId; label: string }[] = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "snack", label: "Snack" },
];

type VariationDraft = {
  label: string;
  ingredientsText: string;
  stepsText: string;
};

function parseIngredientLines(text: string): RecipeIngredient[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+(?:\.\d+)?)\s+(\S+)\s+(.+)$/);
      if (match) {
        return {
          name: match[3]!,
          quantity: Number(match[1]),
          unit: match[2]!,
          category: "Pantry" as IngredientCategory,
        };
      }
      return { name: line, quantity: 1, unit: "serving", category: "Pantry" as IngredientCategory };
    });
}

export function AddRecipeSheet({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (notice: string | null) => void;
}) {
  useOverlayBack(true, onClose);
  const addUserRecipe = useAppStore((s) => s.addUserRecipe);
  const userRecipes = useAppStore((s) => s.userRecipes);
  const targets = useAppStore((s) => s.targets);
  const userProfile = useAppStore((s) => s.userProfile);

  const [name, setName] = useState("");
  const [mealSlot, setMealSlot] = useState<MealSlotId>("dinner");
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([emptyIngredient()]);
  const [stepsText, setStepsText] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [variations, setVariations] = useState<VariationDraft[]>([]);

  function updateIngredient(index: number, patch: Partial<RecipeIngredient>) {
    setIngredients((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function handleSave() {
    const cleanIngredients = ingredients.filter((ing) => ing.name.trim());
    const instructions = stepsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!name.trim() || cleanIngredients.length === 0 || instructions.length === 0) return;

    const { recipe, macrosAdjusted } = buildUserRecipe(
      {
        name,
        mealSlot,
        ingredients: cleanIngredients,
        instructions,
        tags: tagsText.split(",").map((t) => t.trim()).filter(Boolean),
        variations: variations
          .filter((v) => v.label.trim())
          .map((v) => ({
            label: v.label,
            ingredients: parseIngredientLines(v.ingredientsText),
            instructions: v.stepsText.split("\n").map((s) => s.trim()).filter(Boolean),
          })),
        calories: calories.trim() === "" ? null : Number(calories),
        protein: protein.trim() === "" ? null : Number(protein),
        carbs: carbs.trim() === "" ? null : Number(carbs),
        fat: fat.trim() === "" ? null : Number(fat),
      },
      {
        targets,
        mealsPerDay: userProfile?.mealsPerDay,
        nextNumber: 10_000 + userRecipes.length,
      },
    );
    addUserRecipe(recipe);
    onSaved(macrosAdjusted ? CUSTOM_RECIPE_SCALE_NOTICE : null);
    onClose();
  }

  const canSave =
    name.trim().length > 0 &&
    ingredients.some((ing) => ing.name.trim()) &&
    stepsText.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close add recipe"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-labelledby="add-recipe-title"
        className="relative z-[91] flex max-h-[92dvh] w-full max-w-lg flex-col overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="add-recipe-title" className="text-lg font-bold text-slate-900">
            Add recipe
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

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Lemon garlic chicken"
            className="min-h-[48px] w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#2563EB]"
          />
        </label>

        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Meal type</p>
        <div className="mb-4 grid grid-cols-4 gap-1">
          {MEAL_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setMealSlot(t.id)}
              className={`min-h-[40px] rounded-xl text-xs font-semibold ${
                mealSlot === t.id ? "bg-[#2563EB] text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Ingredients
        </p>
        <div className="mb-3 space-y-2">
          {ingredients.map((ing, index) => (
            <div key={index} className="grid grid-cols-[4.5rem_4.5rem_1fr] gap-1.5">
              <input
                type="number"
                inputMode="decimal"
                value={ing.quantity}
                onChange={(e) => updateIngredient(index, { quantity: Number(e.target.value) || 0 })}
                className="min-h-[40px] rounded-lg border border-slate-200 px-2 text-sm outline-none"
                aria-label="Quantity"
              />
              <input
                value={ing.unit}
                onChange={(e) => updateIngredient(index, { unit: e.target.value })}
                placeholder="cup"
                className="min-h-[40px] rounded-lg border border-slate-200 px-2 text-sm outline-none"
                aria-label="Unit"
              />
              <input
                value={ing.name}
                onChange={(e) => updateIngredient(index, { name: e.target.value })}
                placeholder="Ingredient"
                className="min-h-[40px] rounded-lg border border-slate-200 px-2 text-sm outline-none"
              />
              <select
                value={ing.category}
                onChange={(e) =>
                  updateIngredient(index, { category: e.target.value as IngredientCategory })
                }
                className="col-span-3 min-h-[36px] rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-600"
              >
                {INGREDIENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setIngredients((rows) => [...rows, emptyIngredient()])}
            className="text-sm font-semibold text-[#2563EB]"
          >
            + Add ingredient
          </button>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Steps
          </span>
          <textarea
            value={stepsText}
            onChange={(e) => setStepsText(e.target.value)}
            rows={4}
            placeholder="One step per line"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
          />
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Tags <span className="font-normal normal-case text-slate-400">(optional)</span>
          </span>
          <input
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="quick, high protein"
            className="min-h-[44px] w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
          />
        </label>

        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Macros per serving <span className="font-normal normal-case">(optional)</span>
        </p>
        <div className="mb-4 grid grid-cols-4 gap-1.5">
          {[
            ["kcal", calories, setCalories],
            ["P g", protein, setProtein],
            ["C g", carbs, setCarbs],
            ["F g", fat, setFat],
          ].map(([label, value, setter]) => (
            <input
              key={String(label)}
              type="number"
              inputMode="decimal"
              value={value as string}
              onChange={(e) => (setter as (v: string) => void)(e.target.value)}
              placeholder={String(label)}
              className="min-h-[40px] rounded-lg border border-slate-200 px-2 text-center text-sm outline-none"
            />
          ))}
        </div>

        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Variations <span className="font-normal normal-case">(optional)</span>
            </p>
            <button
              type="button"
              onClick={() =>
                setVariations((rows) => [
                  ...rows,
                  { label: "", ingredientsText: "", stepsText: "" },
                ])
              }
              className="text-xs font-semibold text-[#2563EB]"
            >
              + Add
            </button>
          </div>
          {variations.map((v, index) => (
            <div key={index} className="mb-2 space-y-1.5 rounded-xl border border-slate-100 p-2.5">
              <input
                value={v.label}
                onChange={(e) =>
                  setVariations((rows) =>
                    rows.map((row, i) => (i === index ? { ...row, label: e.target.value } : row)),
                  )
                }
                placeholder="Variation name"
                className="min-h-[40px] w-full rounded-lg border border-slate-200 px-2 text-sm outline-none"
              />
              <textarea
                value={v.ingredientsText}
                onChange={(e) =>
                  setVariations((rows) =>
                    rows.map((row, i) =>
                      i === index ? { ...row, ingredientsText: e.target.value } : row,
                    ),
                  )
                }
                rows={2}
                placeholder="Extra ingredients, one per line (e.g. 1 tbsp honey)"
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none"
              />
              <textarea
                value={v.stepsText}
                onChange={(e) =>
                  setVariations((rows) =>
                    rows.map((row, i) =>
                      i === index ? { ...row, stepsText: e.target.value } : row,
                    ),
                  )
                }
                rows={2}
                placeholder="Extra steps, one per line"
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none"
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          disabled={!canSave}
          onClick={handleSave}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] text-sm font-semibold text-white disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          Save recipe
        </button>
      </section>
    </div>
  );
}
