import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../app/AuthContext.jsx";

export default function RequireAuth({ children }) {
  const { user, loadingMe } = useAuth();
  const loc = useLocation();

  // ✅ Se já existe user, nunca “derrube” a tela para loading (evita loop)
  if (loadingMe && !user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-sm text-zinc-500">
        Carregando…
      </div>
    );
  }

  if (!user) {
    const next = loc.pathname + loc.search;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return children;
}
