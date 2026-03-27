import { Navigate } from "react-router-dom";
import { useAuth } from "../../app/AuthContext.jsx";
import { canUseAutomations } from "../../utils/planFeatures.js";

export default function RequireAutomationPlan({
  children,
  redirectTo = "/dashboard",
}) {
  const { loadingMe, perms, workspace, user } = useAuth();

  const plan =
    perms?.plan || workspace?.plan || user?.plan || user?.workspace?.plan || "start";

  if (loadingMe) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-sm text-zinc-500">
        Carregando...
      </div>
    );
  }

  if (!canUseAutomations(plan)) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}
