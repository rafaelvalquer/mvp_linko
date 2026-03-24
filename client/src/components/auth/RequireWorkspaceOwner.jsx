import { Navigate } from "react-router-dom";
import { useAuth } from "../../app/AuthContext.jsx";

export default function RequireWorkspaceOwner({
  redirectTo = "/dashboard",
  children,
}) {
  const { perms, loadingMe } = useAuth();

  if (loadingMe) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-sm text-zinc-500">
        Carregando...
      </div>
    );
  }

  if (perms?.isWorkspaceOwner !== true) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}
