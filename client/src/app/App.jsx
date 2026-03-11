import { RouterProvider } from "react-router-dom";
import { router } from "./routes.jsx";
import "../styles/globals.css";
import { AuthProvider } from "./AuthContext.jsx";
import { ThemeProvider } from "./useThemeToggle.js";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  );
}
