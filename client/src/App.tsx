import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { RequireAuth } from "@/components/staff/RequireAuth";
import { StaffShell } from "@/components/staff/StaffShell";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PH } from "@/lib/placeholders";

const LandingPage = lazy(() => import("@/pages/customer/LandingPage"));
const RewardPage = lazy(() => import("@/pages/customer/RewardPage"));
const LoginPage = lazy(() => import("@/pages/staff/LoginPage"));
const RedeemPage = lazy(() => import("@/pages/staff/RedeemPage"));
const ContactsPage = lazy(() => import("@/pages/staff/ContactsPage"));
const QrCardPage = lazy(() => import("@/pages/staff/QrCardPage"));
const CampaignsPage = lazy(() => import("@/pages/staff/CampaignsPage"));
const CampaignEditPage = lazy(() => import("@/pages/staff/CampaignEditPage"));
const SettingsPage = lazy(() => import("@/pages/staff/SettingsPage"));

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light" enableSystem={false}>
      <TooltipProvider>
        <BrowserRouter>
          <Suspense fallback={<div className="flex min-h-svh items-center justify-center text-ink-muted">Loading…</div>}>
            <Routes>
              <Route path="/" element={<Navigate to={`/r/${PH.restaurantSlug}`} replace />} />
              <Route path="/r/:slug" element={<LandingPage />} />
              <Route path="/r/:slug/reward/:token" element={<RewardPage />} />
              <Route path="/admin/login" element={<LoginPage />} />
              <Route element={<RequireAuth />}>
                <Route element={<StaffShell />}>
                  <Route path="/admin" element={<Navigate to="/admin/redeem" replace />} />
                  <Route path="/admin/redeem" element={<RedeemPage />} />
                  <Route path="/admin/contacts" element={<ContactsPage />} />
                  <Route path="/admin/qr" element={<QrCardPage />} />
                  <Route path="/admin/campaigns" element={<CampaignsPage />} />
                  <Route path="/admin/campaigns/new" element={<CampaignEditPage />} />
                  <Route path="/admin/campaigns/:id" element={<CampaignEditPage />} />
                  <Route path="/admin/settings" element={<SettingsPage />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to={`/r/${PH.restaurantSlug}`} replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}
