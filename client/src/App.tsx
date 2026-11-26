import { lazy, Suspense } from "react";
import { PH } from "@/lib/placeholders";
import { Navigate, Route, Switch } from "@/lib/router";

// Every route is its own chunk; /admin code never loads on the public landing.
const LandingPage = lazy(() => import("@/pages/customer/LandingPage"));
const RewardPage = lazy(() => import("@/pages/customer/RewardPage"));
const LoginPage = lazy(() => import("@/pages/staff/LoginPage"));
const StaffApp = lazy(() => import("@/pages/staff/StaffApp"));

export default function App() {
  return (
    <Suspense fallback={<div className="min-h-svh" aria-busy="true" />}>
      <Switch>
        <Route path="/">
          <Navigate to={`/r/${PH.restaurantSlug}`} />
        </Route>
        <Route path="/r/:slug" component={LandingPage} />
        <Route path="/r/:slug/reward/:token" component={RewardPage} />
        <Route path="/admin/login" component={LoginPage} />
        <Route path="/admin" component={StaffApp} />
        <Route path="/admin/*" component={StaffApp} />
        <Route>
          <Navigate to={`/r/${PH.restaurantSlug}`} />
        </Route>
      </Switch>
    </Suspense>
  );
}
