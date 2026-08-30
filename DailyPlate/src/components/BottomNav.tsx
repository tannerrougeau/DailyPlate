import {
  BookOpen,
  CalendarDays,
  CircleHelp,
  Home,
  ShoppingCart,
} from "lucide-react";
import { useAppStore, type NavTab } from "@/store/useAppStore";

const tabs: { id: NavTab; label: string; icon: typeof Home }[] = [
  { id: "today", label: "Today", icon: Home },
  { id: "plan", label: "Plan", icon: CalendarDays },
  { id: "recipes", label: "Recipes", icon: BookOpen },
  { id: "grocery", label: "Grocery", icon: ShoppingCart },
  { id: "guide", label: "Guide", icon: CircleHelp },
];

export function BottomNav() {
  const nav = useAppStore((s) => s.nav);
  const setNav = useAppStore((s) => s.setNav);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200/80 bg-white/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md"
      aria-label="Main"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1">
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = nav === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setNav(id)}
              className={`flex min-h-[52px] min-w-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-xs font-medium transition-colors ${
                active ? "text-[#2563EB]" : "text-slate-500 active:text-slate-700"
              }`}
            >
              <Icon
                className={`h-6 w-6 ${active ? "stroke-[2.5px]" : "stroke-[2px]"}`}
                aria-hidden
              />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
