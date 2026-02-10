import { createBrowserRouter } from "react-router-dom";
import Dashboard from "../pages/Dashboard.jsx";
import Offers from "../pages/Offers.jsx";
import NewOffer from "../pages/NewOffer.jsx";
import Calendar from "../pages/Calendar.jsx";
import PublicOffer from "../pages/PublicOffer.jsx";
import PublicSchedule from "../pages/PublicSchedule.jsx";

export const router = createBrowserRouter([
  { path: "/", element: <Dashboard /> },
  { path: "/offers", element: <Offers /> },
  { path: "/offers/new", element: <NewOffer /> },
  { path: "/calendar", element: <Calendar /> },

  // público
  { path: "/p/:token", element: <PublicOffer /> },
  { path: "/p/:token/schedule", element: <PublicSchedule /> },
]);
