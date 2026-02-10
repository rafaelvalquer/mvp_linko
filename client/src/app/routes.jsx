import { createBrowserRouter } from "react-router-dom";

import Dashboard from "../pages/Dashboard.jsx";
import Offers from "../pages/Offers.jsx";
import NewOffer from "../pages/NewOffer.jsx";
import Calendar from "../pages/Calendar.jsx";

import PublicOffer from "../pages/PublicOffer.jsx";
import PublicSchedule from "../pages/PublicSchedule.jsx";
import PublicPixPayment from "../pages/PublicPixPayment.jsx";
import PublicOfferDone from "../pages/PublicOfferDone.jsx";
import PublicPaidGuard from "../pages/PublicPaidGuard.jsx";

export const router = createBrowserRouter(
  [
    { path: "/", element: <Dashboard /> },
    { path: "/offers", element: <Offers /> },
    { path: "/offers/new", element: <NewOffer /> },
    { path: "/calendar", element: <Calendar /> },

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
