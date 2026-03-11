import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../app/AuthContext.jsx";

export default function RequireMasterAdmin({ children }) {
  const { user, loadingMe } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loadingMe || !user || user.isMasterAdmin === true) return undefined;

    const timer = window.setTimeout(() => {
      navigate("/dashboard", { replace: true });
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [loadingMe, navigate, user]);

  if (loadingMe && !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-zinc-500">
        Carregando...
      </div>
    );
  }

  if (!user) return null;

  if (user.isMasterAdmin !== true) {
    return (
      <div className="mx-auto flex min-h-[55vh] max-w-2xl items-center justify-center px-4">
        <div className="w-full rounded-[32px] border border-amber-200 bg-[linear-gradient(180deg,#fff7ed,#fffbeb)] p-8 text-center shadow-[0_24px_60px_-40px_rgba(180,83,9,0.35)]">
          <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-amber-700">
            403
          </div>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
            Acesso restrito
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Esta area de gerenciamento esta disponivel apenas para o usuario
            master autorizado. Redirecionando voce para o dashboard...
          </p>
        </div>
      </div>
    );
  }

  return children;
}
