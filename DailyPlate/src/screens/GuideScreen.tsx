import { useState, type ReactNode } from "react";
import { ChevronDown, Heart, Leaf, ShoppingBasket } from "lucide-react";

function GuideAccordion({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
      >
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 text-sm leading-relaxed text-slate-700">
          {children}
        </div>
      )}
    </section>
  );
}

function Pillar({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3.5 text-center shadow-sm">
      <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB]">
        {icon}
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-0.5 text-xs leading-snug text-slate-500">{text}</p>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <p className="font-semibold text-slate-900">{question}</p>
      <p className="mt-1 text-slate-600">{answer}</p>
    </div>
  );
}

export function GuideScreen() {
  return (
    <div className="mx-auto max-w-lg px-4 pb-28 pt-2">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900">Guide</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          DailyPlate learns what you like, plans leftovers, and keeps recipes practical — scaled
          gently, never forced out of shape.
        </p>
      </header>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <Pillar
          icon={<Heart className="h-4 w-4" aria-hidden />}
          title="Learns you"
          text="Likes, skips, and check-ins steer future picks."
        />
        <Pillar
          icon={<Leaf className="h-4 w-4" aria-hidden />}
          title="Leftovers"
          text="Cook once when you can; grocery follows the calendar."
        />
        <Pillar
          icon={<ShoppingBasket className="h-4 w-4" aria-hidden />}
          title="Real plates"
          text="Adult vs child portions. Recipes stay intact."
        />
      </div>

      <div className="space-y-3">
        <GuideAccordion title="Where things live">
          <ul className="space-y-2">
            <li>
              <span className="font-semibold text-slate-900">Today</span> — today’s meals, eaten or
              skip, regenerate this day.
            </li>
            <li>
              <span className="font-semibold text-slate-900">Plan</span> — 2-day, 3-day, week, or
              month. Tap a meal for variations.
            </li>
            <li>
              <span className="font-semibold text-slate-900">Recipes</span> — browse, favorite, or
              add your own.
            </li>
            <li>
              <span className="font-semibold text-slate-900">Grocery</span> — list for selected
              dates, scaled for your household.
            </li>
          </ul>
        </GuideAccordion>

        <GuideAccordion title="FAQ">
          <div className="space-y-3">
            <FaqItem
              question="Do children get the same portion?"
              answer="No. Child plates default smaller than adult. Set sizes in Settings if you want. Grocery and prep totals use that split."
            />
            <FaqItem
              question="Can I add my own recipes?"
              answer="Yes — Recipes → Add recipe. We may scale slightly to hit goals; quality comes first."
            />
            <FaqItem
              question="Why lock a meal?"
              answer="Locked meals stay put when you regenerate. Use them for meals you already cooked or love."
            />
          </div>
        </GuideAccordion>
      </div>
    </div>
  );
}
