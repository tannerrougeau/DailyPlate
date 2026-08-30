import { useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import type { Recipe } from "@/types";
import { recipeImageGradient, recipeImageUrl, resolveRecipeForDisplay } from "@/utils/recipeImage";

type RecipeImageProps = {
  recipe: Recipe;
  className?: string;
  aspect?: "square" | "video" | "wide";
  /** Fill a positioned parent (e.g. meal card thumbnail). */
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
};

const aspectClass = {
  square: "aspect-square",
  video: "aspect-[4/3]",
  wide: "aspect-[16/10]",
} as const;

export function RecipeImage({
  recipe,
  className = "",
  aspect = "video",
  fill = false,
  sizes = "(max-width: 512px) 50vw, 240px",
  priority = false,
}: RecipeImageProps) {
  const [failed, setFailed] = useState(false);
  const resolved = resolveRecipeForDisplay(recipe);
  const gradient = recipeImageGradient(resolved);
  const src = recipeImageUrl(resolved, { width: 640, height: 480 });

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br ${gradient} ${
          fill ? "absolute inset-0 h-full w-full" : aspectClass[aspect]
        } ${className}`}
        aria-hidden
      >
        <UtensilsCrossed className="h-8 w-8 text-slate-400/70" strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <img
      key={src}
      src={src}
      alt=""
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      sizes={sizes}
      onError={() => setFailed(true)}
      className={
        fill
          ? `absolute inset-0 h-full w-full object-cover ${className}`
          : `object-cover ${aspectClass[aspect]} ${className}`
      }
    />
  );
}
