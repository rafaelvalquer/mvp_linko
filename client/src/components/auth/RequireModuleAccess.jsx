import { Navigate } from "react-router-dom";
import { useAuth } from "../../app/AuthContext.jsx";
import {
  getFirstAccessibleWorkspaceRoute,
  hasWorkspaceModuleAccess,
} from "../../utils/workspacePermissions.js";

export default function RequireModuleAccess({
  moduleKey,
  redirectTo = null,
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

  if (!hasWorkspaceModuleAccess(perms, moduleKey)) {
    return <Navigate to={redirectTo || getFirstAccessibleWorkspaceRoute(perms)} replace />;
  }

  return children;
}
