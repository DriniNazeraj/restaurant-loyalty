import { NavLink } from "react-router-dom";
import { STAFF_TABS } from "@/components/staff/staff-nav";

export function BottomTabBar() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex h-16 border-t border-border bg-background lg:hidden"
      aria-label="Staff"
    >
      {STAFF_TABS.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 text-xs ${
                isActive ? "text-brand" : "text-ink-muted"
              }`
            }
          >
            <Icon className="size-5" aria-hidden />
            <span>{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
