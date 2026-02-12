//src/components/auth/RequireAuth.jsx

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../app/AuthContext.jsx";

export default function RequireAuth({ children }) {
  const { token, user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;

  const isAuthed = !!token && !!user;
  if (!isAuthed) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return children;
}
