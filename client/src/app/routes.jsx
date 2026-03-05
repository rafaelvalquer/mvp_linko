//src/app/routes.jsx
import { createBrowserRouter, Navigate } from "react-router-dom";

import Home from "../pages/Home.jsx";

import Dashboard from "../pages/Dashboard.jsx";
import Offers from "../pages/Offers.jsx";
import NewOffer from "../pages/NewOffer.jsx";
import Calendar from "../pages/Calendar.jsx";
import Login from "../pages/Login.jsx";
import Register from "../pages/Register.jsx";
import RequireAuth from "../components/auth/RequireAuth.jsx";
import Products from "../pages/Products.jsx";
import ProductDetails from "../pages/ProductDetails.jsx";
import Clients from "../pages/Clients.jsx";

import PublicOffer from "../pages/PublicOffer.jsx";
import PublicSchedule from "../pages/PublicSchedule.jsx";
import PublicPixPayment from "../pages/PublicPixPayment.jsx";
import PublicOfferDone from "../pages/PublicOfferDone.jsx";
import PublicPaidGuard from "../pages/PublicPaidGuard.jsx";
import SettingsAgenda from "../pages/SettingsAgenda.jsx";

// ✅ billing
import BillingPlans from "../pages/BillingPlans.jsx";
import BillingSuccess from "../pages/BillingSuccess.jsx";
import BillingCancel from "../pages/BillingCancel.jsx";

// ✅ NOVO: Relatórios
import Reports from "../pages/Reports.jsx";

export const router = createBrowserRouter(
  [
    { path: "/login", element: <Login /> },
    { path: "/register", element: <Register /> },
    { path: "/", element: <Home /> },

    {
      path: "/billing/plans",
      element: (
        <RequireAuth>
          <BillingPlans />
        </RequireAuth>
      ),
    },
    {
      path: "/billing/success",
      element: (
        <RequireAuth>
          <BillingSuccess />
        </RequireAuth>
      ),
    },
    {
      path: "/billing/cancel",
      element: (
        <RequireAuth>
          <BillingCancel />
        </RequireAuth>
      ),
    },

    {
      path: "/dashboard",
      element: (
        <RequireAuth>
          <Dashboard />
        </RequireAuth>
      ),
    },
    {
      path: "/offers",
      element: (
        <RequireAuth>
          <Offers />
        </RequireAuth>
      ),
    },
    {
      path: "/offers/new",
      element: (
        <RequireAuth>
          <NewOffer />
        </RequireAuth>
      ),
    },
    {
      path: "/calendar",
      element: (
        <RequireAuth>
          <Calendar />
        </RequireAuth>
      ),
    },

    {
      path: "/reports",
      element: (
        <RequireAuth>
          <Reports />
        </RequireAuth>
      ),
    },

    {
      path: "/settings/agenda",
      element: (
        <RequireAuth>
          <SettingsAgenda />
        </RequireAuth>
      ),
    },

    // ✅ /withdraws agora abre o modal de Conta Pix (sem página)
    {
      path: "/withdraws",
      element: (
        <RequireAuth>
          <Navigate to="/dashboard" replace state={{ openPixSettings: true }} />
        </RequireAuth>
      ),
    },

    {
      path: "/store/products",
      element: (
        <RequireAuth>
          <Products />
        </RequireAuth>
      ),
    },
    {
      path: "/store/products/:id",
      element: (
        <RequireAuth>
          <ProductDetails />
        </RequireAuth>
      ),
    },
    {
      path: "/store/customers",
      element: (
        <RequireAuth>
          <Clients />
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

    { path: "/p/:token/done", element: <PublicOfferDone /> },
  ],
  { future: { v7_startTransition: true } },
);
