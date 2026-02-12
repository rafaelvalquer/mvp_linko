import { RouterProvider } from "react-router-dom";
import { router } from "./routes.jsx";
import "../styles/globals.css";
import { AuthProvider } from "./AuthContext.jsx";

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
