// src/routes.jsx
import { createBrowserRouter } from "react-router-dom";
import Dashboard from "../pages/Dashboard.jsx";
import Offers from "../pages/Offers.jsx";
import NewOffer from "../pages/NewOffer.jsx";
import Calendar from "../pages/Calendar.jsx";
import PublicOffer from "../pages/PublicOffer.jsx";
import PublicSchedule from "../pages/PublicSchedule.jsx";
import PublicPixPayment from "../pages/PublicPixPayment.jsx";
import PublicOfferDone from "../pages/PublicOfferDone.jsx";

export const router = createBrowserRouter(
  [
    { path: "/", element: <Dashboard /> },
    { path: "/offers", element: <Offers /> },
    { path: "/offers/new", element: <NewOffer /> },
    { path: "/calendar", element: <Calendar /> },

    // PÚBLICO
    { path: "/p/:token", element: <PublicOffer /> },
    { path: "/p/:token/schedule", element: <PublicSchedule /> },
    { path: "/p/:token/pay", element: <PublicPixPayment /> },
    { path: "/p/:token/done", element: <PublicOfferDone /> },
  ],
  // remove o warning do startTransition (não é erro, só warning)
  { future: { v7_startTransition: true } },
);
