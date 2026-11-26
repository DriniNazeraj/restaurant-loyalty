import { useEffect } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { LogOutIcon, SettingsIcon } from "lucide-react";
import "@/fonts/staff.ts";
import { BottomTabBar } from "@/components/staff/BottomTabBar";
import { STAFF_TABS } from "@/components/staff/staff-nav";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { clearStaffSession, readStaffSession } from "@/lib/auth";
import { applyRestaurantTheme } from "@/lib/restaurant-theme";
import { PH } from "@/lib/placeholders";

export function StaffShell() {
  const navigate = useNavigate();
  const session = readStaffSession();
  const restaurantName = session?.restaurant.name ?? PH.restaurantName;

  useEffect(() => {
    applyRestaurantTheme(session?.restaurant.brandColor);
  }, [session?.restaurant.brandColor]);

  function logout() {
    clearStaffSession();
    navigate("/admin/login", { replace: true });
  }

  return (
    <div className="staff-app min-h-svh font-sans">
      <header className="flex h-14 items-center justify-between border-b border-border px-4 lg:hidden">
        <p className="truncate font-heading text-base font-semibold text-ink">{restaurantName}</p>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Account menu"
            className="flex size-11 items-center justify-center rounded-full"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
              {restaurantName.slice(0, 1)}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate("/admin/settings")}>
              <SettingsIcon className="size-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={logout}>
              <LogOutIcon className="size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-border bg-background p-4 lg:flex">
        <p className="px-2 font-heading text-lg font-bold text-brand">{restaurantName}</p>
        <nav className="mt-6 flex flex-1 flex-col gap-1" aria-label="Staff">
          {STAFF_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium ${
                    isActive ? "bg-brand-soft text-brand" : "text-ink hover:bg-muted"
                  }`
                }
              >
                <Icon className="size-4" aria-hidden />
                {tab.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-1">
          <Link
            to="/admin/settings"
            className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-ink hover:bg-muted"
          >
            <SettingsIcon className="size-4" />
            Settings
          </Link>
          <button
            type="button"
            onClick={logout}
            className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-left text-sm text-ink hover:bg-muted"
          >
            <LogOutIcon className="size-4" />
            Log out
          </button>
        </div>
      </aside>

      <main className="px-4 pb-24 pt-6 lg:ml-60 lg:max-w-5xl lg:px-8 lg:pb-8">
        <Outlet />
      </main>
      <BottomTabBar />
    </div>
  );
}
