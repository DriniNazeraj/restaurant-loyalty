import { useEffect, type ReactNode } from "react";
import { LogOutIcon, SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import "@/fonts/staff.ts";
import "@/fonts/reward-mono.ts";
import { BottomTabBar } from "@/components/staff/BottomTabBar";
import { STAFF_TABS } from "@/components/staff/staff-nav";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { api, setUnauthorizedHandler } from "@/lib/api";
import { clearStaffSession, isOwner, saveStaffSession, useStaffSession } from "@/lib/auth";
import { applyRestaurantTheme } from "@/lib/restaurant-theme";
import { Link, NavLink } from "@/lib/router";
import { useNavigate, usePathname } from "@/lib/router-hooks";

export function StaffShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = usePathname();
  const session = useStaffSession();
  const restaurantName = session?.restaurant.name ?? "";
  const owner = isOwner(session);

  // Any 401 on a staff request: drop the session and go back to login, then return here.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearStaffSession();
      toast.error("You were logged out, log in again");
      navigate("/admin/login", { replace: true, state: { from: window.location.pathname } });
    });
    return () => setUnauthorizedHandler(null);
  }, [navigate]);

  // Refresh role/restaurant from the server once per mount (role may have changed).
  const token = session?.token;
  useEffect(() => {
    if (!token) return;
    api
      .me(token)
      .then(({ staff, restaurant }) => saveStaffSession({ token, staff, restaurant }))
      .catch(() => undefined);
  }, [token]);

  useEffect(() => {
    applyRestaurantTheme(session?.restaurant.brandColor);
  }, [session?.restaurant.brandColor]);

  function logout() {
    clearStaffSession();
    navigate("/admin/login", { replace: true });
  }

  return (
    <TooltipProvider>
      <div className="staff-app min-h-svh font-sans" data-role={session?.staff.role}>
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background px-4 lg:hidden">
          <p className="truncate font-heading text-base font-bold text-ink">{restaurantName}</p>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Account menu"
              className="flex size-11 items-center justify-center rounded-full"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
                {(session?.staff.name ?? "?").slice(0, 1)}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <div className="px-2 py-1.5 text-xs text-ink-muted">
                {session?.staff.name} · {owner ? "Owner" : "Waiter"}
              </div>
              {owner ? (
                <DropdownMenuItem onClick={() => navigate("/admin/settings")}>
                  <SettingsIcon className="size-4" />
                  Settings
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onClick={logout}>
                <LogOutIcon className="size-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-border bg-background p-4 lg:flex">
          <p className="px-2 font-heading text-lg font-bold text-brand">{restaurantName}</p>
          <p className="px-2 text-xs text-ink-muted">
            {session?.staff.name} · {owner ? "Owner" : "Waiter"}
          </p>
          <nav className="mt-6 flex flex-1 flex-col gap-1" aria-label="Staff">
            {STAFF_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className={(isActive) =>
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
            {owner ? (
              <Link
                to="/admin/settings"
                className={`flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm ${
                  pathname === "/admin/settings" ? "bg-brand-soft text-brand" : "text-ink hover:bg-muted"
                }`}
              >
                <SettingsIcon className="size-4" />
                Settings
              </Link>
            ) : null}
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

        <main className="px-4 pt-6 pb-24 lg:ml-60 lg:max-w-5xl lg:p-8">
          {children}
        </main>
        <BottomTabBar />
        <Toaster position="top-center" />
      </div>
    </TooltipProvider>
  );
}
