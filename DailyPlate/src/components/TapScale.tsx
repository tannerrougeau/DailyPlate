export function TapScale({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`flex h-12 flex-1 items-center justify-center rounded-2xl border-2 text-base font-bold ${
              value === n
                ? "border-[#2563EB] bg-blue-50 text-blue-900"
                : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
