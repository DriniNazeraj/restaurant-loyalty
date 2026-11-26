import { lazy, Suspense } from "react";
import { OwnerOnly } from "@/components/staff/OwnerOnly";
import { RequireAuth } from "@/components/staff/RequireAuth";
import { StaffShell } from "@/components/staff/StaffShell";
import { Navigate, Route, Switch } from "@/lib/router";

const RedeemPage = lazy(() => import("@/pages/staff/RedeemPage"));
const ContactsPage = lazy(() => import("@/pages/staff/ContactsPage"));
const QrCardPage = lazy(() => import("@/pages/staff/QrCardPage"));
const CampaignsPage = lazy(() => import("@/pages/staff/CampaignsPage"));
const CampaignEditPage = lazy(() => import("@/pages/staff/CampaignEditPage"));
const SettingsPage = lazy(() => import("@/pages/staff/SettingsPage"));

export default function StaffApp() {
  return (
    <RequireAuth>
      <StaffShell>
        <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-muted" aria-busy="true" />}>
          <Switch>
            <Route path="/admin/redeem" component={RedeemPage} />
            <Route path="/admin/contacts" component={ContactsPage} />
            <Route path="/admin/qr" component={QrCardPage} />
            <Route path="/admin/campaigns" component={CampaignsPage} />
            <Route path="/admin/campaigns/new" component={CampaignEditPage} />
            <Route path="/admin/campaigns/:id" component={CampaignEditPage} />
            <Route path="/admin/settings">
              <OwnerOnly>
                <SettingsPage />
              </OwnerOnly>
            </Route>
            <Route>
              <Navigate to="/admin/redeem" />
            </Route>
          </Switch>
        </Suspense>
      </StaffShell>
    </RequireAuth>
  );
}
