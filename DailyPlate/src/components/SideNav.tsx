import { NAV_TABS } from "@/components/BottomNav";
import { useAppStore } from "@/store/useAppStore";

/** Side navigation for wide screens (lg and up); BottomNav is used below that. */
export function SideNav() {
  const nav = useAppStore((s) => s.nav);
  const setNav = useAppStore((s) => s.setNav);

  return (
    <nav
      className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-slate-200/80 bg-white px-3 py-6 lg:flex"
      aria-label="Main"
    >
      <p className="px-3 text-lg font-bold text-slate-900">DailyPlate</p>
      <ul className="mt-6 space-y-1">
        {NAV_TABS.map(({ id, label, icon: Icon }) => {
          const active = nav === id;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => setNav(id)}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold ${
                  active ? "bg-blue-50 text-[#2563EB]" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
