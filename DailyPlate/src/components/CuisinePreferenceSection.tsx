import { CUISINE_OPTIONS } from "@/utils/personalizationEngine";

export function CuisinePreferenceSection({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (cuisines: string[]) => void;
}) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((c) => c !== id) : [...selected, id]);
  }

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-slate-900">Cuisine preferences</h3>
        <p className="mt-1 text-sm text-slate-600">
          Optional — we’ll favor these styles when generating and swapping meals.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {CUISINE_OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => toggle(o.id)}
            className={`min-h-[40px] rounded-full border-2 px-4 text-sm font-semibold transition-colors ${
              selected.includes(o.id)
                ? "border-primary bg-primary/5 text-primary"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </section>
  );
}
