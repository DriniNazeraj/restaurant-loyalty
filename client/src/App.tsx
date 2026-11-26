import { lazy, Suspense } from "react";
import { PH } from "@/lib/placeholders";
import { isThemeDemoEnabled } from "@/lib/theme";
import { Navigate, Route, Switch } from "@/lib/router";

// Every route is its own chunk; /admin code never loads on the public landing.
const LandingPage = lazy(() => import("@/pages/customer/LandingPage"));
const RewardPage = lazy(() => import("@/pages/customer/RewardPage"));
const LoginPage = lazy(() => import("@/pages/staff/LoginPage"));
const StaffApp = lazy(() => import("@/pages/staff/StaffApp"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));
// DEMO (DESIGN.md §10.4): own chunk, only fetched when the demo is on. Delete with ThemeSwitcher.tsx.
const ThemeSwitcher = lazy(() => import("@/components/ThemeSwitcher"));
const showThemeDemo = isThemeDemoEnabled();

export default function App() {
  return (
    <div className="relative min-h-svh">
    <Suspense fallback={<div className="min-h-svh" aria-busy="true" />}>
      <Switch>
        <Route path="/">
          <Navigate to={`/r/${PH.homeSlug}`} />
        </Route>
        <Route path="/r/:slug" component={LandingPage} />
        <Route path="/r/:slug/reward/:token" component={RewardPage} />
        <Route path="/admin/login" component={LoginPage} />
        <Route path="/admin" component={StaffApp} />
        <Route path="/admin/*" component={StaffApp} />
        <Route component={NotFoundPage} />
      </Switch>
      {showThemeDemo ? (
        <Suspense fallback={null}>
          <ThemeSwitcher />
        </Suspense>
      ) : null}
    </Suspense>
    </div>
  );
}
