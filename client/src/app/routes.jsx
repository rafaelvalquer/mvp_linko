//src/app/routes.jsx
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";

import Home from "../pages/Home.jsx";

import Dashboard from "../pages/Dashboard.jsx";
import Offers from "../pages/Offers.jsx";
import NewOffer from "../pages/NewOffer.jsx";
import RecurringOffers from "../pages/RecurringOffers.jsx";
import RecurringOfferDetails from "../pages/RecurringOfferDetails.jsx";
import Calendar from "../pages/CalendarV2.jsx";
import Login from "../pages/Login.jsx";
import Register from "../pages/Register.jsx";
import RequireAuth from "../components/auth/RequireAuth.jsx";
import RequireModuleAccess from "../components/auth/RequireModuleAccess.jsx";
import RequireMasterAdmin from "../components/auth/RequireMasterAdmin.jsx";
import RequireRecurringPlan from "../components/auth/RequireRecurringPlan.jsx";
import RequireAutomationPlan from "../components/auth/RequireAutomationPlan.jsx";
import RequireWorkspaceOwner from "../components/auth/RequireWorkspaceOwner.jsx";
import Products from "../pages/Products.jsx";
import ProductDetails from "../pages/ProductDetails.jsx";
import Clients from "../pages/Clients.jsx";
import Management from "../pages/Management.jsx";

import PublicOffer from "../pages/PublicOffer.jsx";
import PublicSchedule from "../pages/PublicSchedule.jsx";
import PublicPixPayment from "../pages/PublicPixPayment.jsx";
import PublicBookingManage from "../pages/PublicBookingManage.jsx";
import PublicOfferCancelled from "../pages/PublicOfferCancelled.jsx";
import PublicOfferDone from "../pages/PublicOfferDone.jsx";
import PublicOfferFeedback from "../pages/PublicOfferFeedback.jsx";
import PublicPaidGuard from "../pages/PublicPaidGuard.jsx";
import SettingsAccount from "../pages/SettingsAccount.jsx";
import SettingsAgentGuide from "../pages/SettingsAgentGuide.jsx";
import SettingsAgenda from "../pages/SettingsAgenda.jsx";
import SettingsNotifications from "../pages/SettingsNotifications.jsx";
import SettingsTeam from "../pages/SettingsTeam.jsx";

// ✅ billing
import BillingPlans from "../pages/BillingPlans.jsx";
import BillingSuccess from "../pages/BillingSuccess.jsx";
import BillingCancel from "../pages/BillingCancel.jsx";

// ✅ NOVO: Relatórios
import Reports from "../pages/ReportsDashboard.jsx";
import FeedbackReportsPage from "../pages/FeedbackReportsPage.jsx";
import RecurringReportsPage from "../pages/RecurringReportsPage.jsx";
import AutomationsPage from "../pages/AutomationsPage.jsx";
import { useAuth } from "./AuthContext.jsx";
import { getFirstAccessibleWorkspaceRoute } from "../utils/workspacePermissions.js";

function RouterShell() {
  return <Outlet />;
}

function RootEntry() {
  const { user, loadingMe, perms } = useAuth();

  if (loadingMe && !user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-sm text-zinc-500">
        Carregando...
      </div>
    );
  }

  if (user) {
    return <Navigate to={getFirstAccessibleWorkspaceRoute(perms)} replace />;
  }

  return <Home />;
}

export const router = createBrowserRouter(
  [
    {
      element: <RouterShell />,
      children: [
        { path: "/login", element: <Login /> },
        { path: "/register", element: <Register /> },
        { path: "/", element: <RootEntry /> },

        {
          path: "/billing/plans",
          element: (
            <RequireAuth>
              <RequireWorkspaceOwner>
                <BillingPlans />
              </RequireWorkspaceOwner>
            </RequireAuth>
          ),
        },
        {
          path: "/billing/success",
          element: (
            <RequireAuth>
              <RequireWorkspaceOwner>
                <BillingSuccess />
              </RequireWorkspaceOwner>
            </RequireAuth>
          ),
        },
        {
          path: "/billing/cancel",
          element: (
            <RequireAuth>
              <RequireWorkspaceOwner>
                <BillingCancel />
              </RequireWorkspaceOwner>
            </RequireAuth>
          ),
        },

        {
          path: "/dashboard",
          element: (
            <RequireAuth>
              <RequireModuleAccess moduleKey="dashboard">
                <Dashboard />
              </RequireModuleAccess>
            </RequireAuth>
          ),
        },
        {
          path: "/gerenciamento",
          element: (
            <RequireAuth>
              <RequireMasterAdmin>
                <Management />
              </RequireMasterAdmin>
            </RequireAuth>
          ),
        },
        {
          path: "/offers",
          element: (
            <RequireAuth>
              <RequireModuleAccess moduleKey="offers">
                <Offers />
              </RequireModuleAccess>
            </RequireAuth>
          ),
        },
        {
          path: "/offers/new",
          element: (
            <RequireAuth>
              <RequireModuleAccess moduleKey="newOffer">
                <NewOffer />
              </RequireModuleAccess>
            </RequireAuth>
          ),
        },
        {
          path: "/offers/recurring",
          element: (
            <RequireAuth>
              <RequireModuleAccess moduleKey="offers">
                <RequireRecurringPlan>
                  <RecurringOffers />
                </RequireRecurringPlan>
              </RequireModuleAccess>
            </RequireAuth>
          ),
        },
        {
          path: "/offers/recurring/:id",
          element: (
            <RequireAuth>
              <RequireModuleAccess moduleKey="offers">
                <RequireRecurringPlan>
                  <RecurringOfferDetails />
                </RequireRecurringPlan>
              </RequireModuleAccess>
            </RequireAuth>
          ),
        },
        {
          path: "/calendar",
          element: (
            <RequireAuth>
              <RequireModuleAccess moduleKey="calendar">
                <Calendar />
              </RequireModuleAccess>
            </RequireAuth>
          ),
        },

        {
          path: "/reports",
          element: (
            <RequireAuth>
              <RequireModuleAccess moduleKey="reports">
                <Reports />
              </RequireModuleAccess>
            </RequireAuth>
          ),
        },
        {
          path: "/reports/feedback",
          element: (
            <RequireAuth>
              <RequireModuleAccess moduleKey="reports">
                <FeedbackReportsPage />
              </RequireModuleAccess>
            </RequireAuth>
          ),
        },
        {
          path: "/reports/recurring",
          element: (
            <RequireAuth>
              <RequireModuleAccess moduleKey="reports">
                <RequireRecurringPlan redirectTo="/reports">
                  <RecurringReportsPage />
                </RequireRecurringPlan>
              </RequireModuleAccess>
            </RequireAuth>
          ),
        },
        {
          path: "/automations",
          element: (
            <RequireAuth>
              <RequireAutomationPlan redirectTo="/dashboard">
                <AutomationsPage />
              </RequireAutomationPlan>
            </RequireAuth>
          ),
        },

        {
          path: "/settings",
          element: (
            <RequireAuth>
              <RequireModuleAccess moduleKey="settings">
                <Navigate to="/settings/account" replace />
              </RequireModuleAccess>
            </RequireAuth>
          ),
        },
        {
          path: "/settings/account",
          element: (
            <RequireAuth>
              <RequireModuleAccess moduleKey="settings">
                <SettingsAccount />
              </RequireModuleAccess>
            </RequireAuth>
          ),
        },
        {
          path: "/settings/account/agent-guide",
          element: (
            <RequireAuth>
              <RequireModuleAccess moduleKey="settings">
                <SettingsAgentGuide />
              </RequireModuleAccess>
            </RequireAuth>
          ),
        },
        {
          path: "/settings/notifications",
          element: (
            <RequireAuth>
              <RequireModuleAccess moduleKey="settings">
                <SettingsNotifications />
              </RequireModuleAccess>
            </RequireAuth>
          ),
        },
        {
          path: "/settings/agenda",
          element: (
            <RequireAuth>
              <RequireModuleAccess moduleKey="settings">
                <SettingsAgenda />
              </RequireModuleAccess>
            </RequireAuth>
          ),
        },
        {
          path: "/settings/team",
          element: (
            <RequireAuth>
              <RequireWorkspaceOwner>
                <RequireModuleAccess moduleKey="settings">
                  <SettingsTeam />
                </RequireModuleAccess>
              </RequireWorkspaceOwner>
            </RequireAuth>
          ),
        },

        // ✅ /withdraws agora abre o modal de Conta Pix (sem página)
        {
          path: "/withdraws",
          element: (
            <RequireAuth>
              <Navigate
                to="/dashboard"
                replace
                state={{ openPixSettings: true }}
              />
            </RequireAuth>
          ),
        },

        {
          path: "/store/products",
          element: (
            <RequireAuth>
              <RequireModuleAccess moduleKey="products">
                <Products />
              </RequireModuleAccess>
            </RequireAuth>
          ),
        },
        {
          path: "/store/products/:id",
          element: (
            <RequireAuth>
              <RequireModuleAccess moduleKey="products">
                <ProductDetails />
              </RequireModuleAccess>
            </RequireAuth>
          ),
        },
        {
          path: "/store/customers",
          element: (
            <RequireAuth>
              <RequireModuleAccess moduleKey="clients">
                <Clients />
              </RequireModuleAccess>
            </RequireAuth>
          ),
        },

        // PÚBLICO
        {
          path: "/p/:token",
          element: (
            <PublicPaidGuard>
              <PublicOffer />
            </PublicPaidGuard>
          ),
        },
        {
          path: "/p/:token/schedule",
          element: (
            <PublicPaidGuard>
              <PublicSchedule />
            </PublicPaidGuard>
          ),
        },
        {
          path: "/p/:token/pay",
          element: (
            <PublicPaidGuard>
              <PublicPixPayment />
            </PublicPaidGuard>
          ),
        },
        {
          path: "/p/:token/cancelled",
          element: (
            <PublicPaidGuard>
              <PublicOfferCancelled />
            </PublicPaidGuard>
          ),
        },
        { path: "/p/:token/manage", element: <PublicBookingManage /> },

        { path: "/p/:token/done", element: <PublicOfferDone /> },
        { path: "/p/:token/feedback", element: <PublicOfferFeedback /> },
      ],
    },
  ],
  { future: { v7_startTransition: true } },
);
