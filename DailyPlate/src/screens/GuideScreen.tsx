import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

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
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
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

function GuideList({ items }: { items: string[] }) {
  return (
    <ul className="mt-2 list-disc space-y-1.5 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function GuideSubheading({ children }: { children: ReactNode }) {
  return <p className="mt-3 font-semibold text-slate-900">{children}</p>;
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
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Guide</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Keep using DailyPlate and plans get closer to you: likes, dislikes, and check-ins
          personalize picks; leftover and low-complexity options cut busy nights; grocery stays
          tied to the calendar you actually cook. Targets tighten over time — recipes stay intact,
          scaled only slightly rather than forced out of shape.
        </p>
      </header>

      <div className="space-y-3">
        <GuideAccordion title="Getting Started" defaultOpen>
          <p>
            DailyPlate builds meal plans around your goals, then helps you shop and cook with less
            mental load. Here is what each tab does:
          </p>
          <GuideSubheading>Today</GuideSubheading>
          <p>
            Your home base for the day you are viewing. See planned meals, macro progress, and
            generate or refresh a single day. Open Settings (gear) to adjust household size, protein
            targets, and macro split.
          </p>
          <GuideSubheading>Plan</GuideSubheading>
          <p>
            A weekly view (Monday–Sunday) of your schedule. Generate full weeks, copy a week
            forward, or open any day for details. Switch to Month view when you want the big
            calendar picture.
          </p>
          <GuideSubheading>Recipes</GuideSubheading>
          <p>
            Browse the full library, filter by meal type, and mark favorites or dislikes so future
            plans lean toward what you actually enjoy.
          </p>
          <GuideSubheading>Grocery</GuideSubheading>
          <p>
            A shopping list built from your selected plan dates. Amounts scale for your household
            size automatically.
          </p>
          <GuideSubheading>Calorie &amp; macro targets</GuideSubheading>
          <p>
            Your calorie target comes from your profile (age, weight, activity, and goal). Protein
            is set first — it is the priority. Remaining calories are split between carbs and fat
            based on your macro split preference (balanced, higher carb, or higher fat).
          </p>
          <GuideList
            items={[
              "Protein target is always honored before carbs and fat adjust.",
              "Meals scale to fit your daily calories without extreme portion changes.",
              "Enable “Prioritize minimum protein” in Settings if you want extra protein bias.",
            ]}
          />
        </GuideAccordion>

        <GuideAccordion title="Meal Planning Basics">
          <GuideSubheading>Generate daily or weekly plans</GuideSubheading>
          <GuideList
            items={[
              "Today tab: use Generate Day Plan for a single day.",
              "Plan tab: tap Generate on any day row, or use Generate Week for the whole week.",
              "Locked days are skipped — lock a day when you already have meals you want to keep.",
            ]}
          />
          <GuideSubheading>Meal prep &amp; batch cooking</GuideSubheading>
          <p>
            Recipes marked “Prep” can be cooked once and spread across multiple days. On a meal
            card or recipe detail, tap the chef hat to open Meal Prep, choose portions and dates,
            and the app assigns leftovers automatically.
          </p>
          <GuideList
            items={[
              "Weekly Meal Prep in onboarding (or Check-in) can auto-repeat one slot across the week.",
              "Grocery lists count batch ingredients once per cook session, not per portion.",
            ]}
          />
          <GuideSubheading>Edit, swap, or regenerate</GuideSubheading>
          <GuideList
            items={[
              "Shuffle icon — swap one meal slot for a new recipe pick.",
              "Lock icon — lock a meal or entire day so regeneration leaves it alone.",
              "Show details — full ingredients, variations, and serving weights.",
              "Regenerate Day (in Plan day view) rebuilds all unlocked slots for that date.",
              "Favorite or dislike recipes to steer future picks over time.",
            ]}
          />
        </GuideAccordion>

        <GuideAccordion title="Tips for Success">
          <GuideSubheading>Hitting protein goals enjoyably</GuideSubheading>
          <GuideList
            items={[
              "Lean on high-protein breakfasts (oats, smoothies, egg bites, yogurt parfaits).",
              "Use recipe variations to keep flavors fresh without starting from scratch.",
              "Prioritize minimum protein in Settings when cutting or building muscle.",
              "Swap meals you are tired of — variety helps adherence more than perfection.",
            ]}
          />
          <GuideSubheading>Grocery list best practices</GuideSubheading>
          <GuideList
            items={[
              "Select weeks or days that match your shopping trip to avoid over-buying.",
              "Check off items as you shop; clear the list when you are done.",
              "Household size scales quantities — update it in Settings if your crew changes.",
              "Batch-cook proteins and grains once, then mix into different meals through the week.",
            ]}
          />
          <GuideSubheading>Cravings &amp; plateaus</GuideSubheading>
          <GuideList
            items={[
              "A plateau is normal — use Check-in to revisit calories, not just willpower.",
              "If hunger is high, favor higher-volume meals (salads, bowls, lean proteins).",
              "Cravings often mean too much restriction — swap in a favorite-tagged recipe instead of skipping.",
              "Consistency beats perfection: one off-plan meal does not reset your progress.",
            ]}
          />
        </GuideAccordion>

        <GuideAccordion title="FAQ">
          <div className="space-y-3">
            <FaqItem
              question="Why is my protein target so high?"
              answer="Protein is set from your body weight and goal (lose, maintain, or gain). Higher protein supports muscle retention while dieting and recovery while training. You can enable a minimum protein floor in Settings, but the app always prioritizes protein before adjusting carbs and fat."
            />
            <FaqItem
              question="How does scaling work with household size?"
              answer="Your personal calorie and macro targets stay individual. Household size only scales ingredient amounts and grocery quantities — so cooking for two adults looks different on the list than cooking for one, but your daily targets do not double."
            />
            <FaqItem
              question="Can I customize recipes?"
              answer="Yes. Add your own recipes from the Recipes tab (name, meal type, ingredients, steps, optional tags and variations). You can also pick flavor variations on planned meals, swap meals, favorite or dislike recipes, and lock meals you want to keep. Scaling stays gentle so recipes are not distorted."
            />
            <FaqItem
              question="How often should I do a Check-in?"
              answer="Every 2–4 weeks is a good rhythm, or whenever weight, hunger, or energy shifts noticeably. Check-in updates your calorie recommendation and lets you refresh food preferences and meal-prep habits."
            />
            <FaqItem
              question="Why did my carbs or fat change after I updated Settings?"
              answer="When you change macro split preference (balanced, higher carb, or higher fat), the app recalculates how remaining calories — after protein — are divided. Total calories and protein stay tied to your profile unless you adjust them in Check-in."
            />
            <FaqItem
              question="What happens when I lock a meal or day?"
              answer="Locked meals and days are excluded from Generate Day and Generate Week. Use locks when you have meals you love or already prepped and do not want the app to replace them."
            />
          </div>
        </GuideAccordion>
      </div>
    </div>
  );
}
