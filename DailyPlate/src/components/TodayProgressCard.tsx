import { useEffect, useRef, useState } from "react";
import type { DailyTargets } from "@/types";

function fiberTarget(targets: DailyTargets): number {
  if (targets.fiber != null && Number.isFinite(targets.fiber)) return targets.fiber;
  return Math.round((targets.calories / 1000) * 14);
}

function ThinBar({
  label,
  eaten,
  target,
  barClass,
}: {
  label: string;
  eaten: number;
  target: number;
  barClass: string;
}) {
  const pct = target > 0 ? Math.min(100, (eaten / target) * 100) : 0;
  return (
    <div>
      <div className="mb-0.5 flex items-baseline justify-between gap-2 text-[10px] leading-none">
        <span className="font-semibold text-slate-500">{label}</span>
        <span className="tabular-nums text-slate-500">
          {Math.round(eaten)}/{Math.round(target)}g
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function TodayProgressCard({
  targets,
  eaten,
}: {
  targets: DailyTargets;
  eaten: DailyTargets;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-8px 0px 0px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const kcalEaten = Math.round(eaten.calories);
  const kcalTarget = Math.round(targets.calories);
  const kcalLeft = Math.max(0, kcalTarget - kcalEaten);
  const proteinLeft = Math.max(0, Math.round(targets.protein - eaten.protein));
  const kcalPct = kcalTarget > 0 ? Math.min(100, (kcalEaten / kcalTarget) * 100) : 0;
  const fiberGoal = fiberTarget(targets);

  return (
    <>
      <div ref={sentinelRef} className="h-px" aria-hidden />
      {stuck && (
        <div className="fixed inset-x-0 top-0 z-30 border-b border-slate-200/80 bg-cream/95 px-4 py-2 backdrop-blur-sm">
          <p className="mx-auto max-w-lg text-center text-sm font-semibold tabular-nums text-slate-900">
            {kcalLeft.toLocaleString()} kcal left
            <span className="mx-1.5 font-normal text-slate-300">·</span>
            <span className="font-medium text-slate-600">{proteinLeft}g protein left</span>
          </p>
        </div>
      )}
      <section className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-sm">
        <p
          className="text-center text-2xl font-semibold tabular-nums tracking-tight text-slate-900"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {kcalLeft.toLocaleString()}
          <span className="ml-1 font-sans text-sm font-medium text-slate-500">kcal left</span>
        </p>
        <p className="mt-0.5 text-center text-xs tabular-nums text-slate-400">
          {kcalEaten.toLocaleString()} / {kcalTarget.toLocaleString()}
        </p>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-[#2563EB]"
            style={{ width: `${kcalPct}%` }}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
          <ThinBar
            label="Protein"
            eaten={eaten.protein}
            target={targets.protein}
            barClass="bg-sky-500"
          />
          <ThinBar
            label="Carbs"
            eaten={eaten.carbs}
            target={targets.carbs}
            barClass="bg-amber-400"
          />
          <ThinBar
            label="Fat"
            eaten={eaten.fat}
            target={targets.fat}
            barClass="bg-orange-400"
          />
          <ThinBar
            label="Fiber"
            eaten={eaten.fiber ?? 0}
            target={fiberGoal}
            barClass="bg-emerald-500"
          />
        </div>
      </section>
    </>
  );
}
