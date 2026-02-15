//src/app/routes.jsx
import { createBrowserRouter } from "react-router-dom";

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
import Withdraws from "../pages/Withdraws.jsx";

export const router = createBrowserRouter(
  [
    { path: "/login", element: <Login /> },
    { path: "/register", element: <Register /> },

    {
      path: "/",
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

    { path: "/withdraws", element: <Withdraws /> },

    // SUA LOJA (ex.: premium)
    { path: "/store/products", element: <Products /> },
    { path: "/store/products/:id", element: <ProductDetails /> },
    { path: "/store/customers", element: <Clients /> },

    // PÚBLICO (guard redireciona para /done quando já estiver pago)
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

    // FINAL IMUTÁVEL
    { path: "/p/:token/done", element: <PublicOfferDone /> },
  ],
  { future: { v7_startTransition: true } },
);
