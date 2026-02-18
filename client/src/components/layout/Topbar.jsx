// src/components/layout/Topbar.jsx
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/AuthContext.jsx";

// ✅ ajuste o caminho conforme sua estrutura
import brandLogo from "../../assets/brand.png";

export default function Topbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const displayName =
    (user?.name && String(user.name).trim()) || user?.email || "";

  function handleLogout() {
    signOut(); // limpa token + estado
    navigate("/login", { replace: true });
  }

  return (
    <div className="border-b bg-white shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-4">
          {/* CONTAINER DA LOGO - Aumentado e sem bordas restritivas */}
          <div className="flex h-12 items-center justify-center transition-transform hover:scale-105">
            <img
              src={brandLogo}
              alt="Logo da marca"
              className="h-full w-auto max-w-[140px] object-contain"
              loading="eager"
              draggable={false}
            />
          </div>

          <div className="border-l border-zinc-200 pl-4">
            <div className="text-base font-bold tracking-tight text-zinc-900">
              PayLink
            </div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">
              Propostas • Agenda • Pix
            </div>
          </div>
        </div>

        {user ? (
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <div className="text-[10px] uppercase text-zinc-400 font-bold">
                Usuário Logado
              </div>
              <div className="text-sm font-medium text-zinc-700">
                {displayName}
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-600 transition-all hover:bg-red-50 hover:text-red-600 hover:border-red-100"
            >
              Sair
            </button>
          </div>
        ) : (
          <div className="text-xs font-medium text-zinc-400 bg-zinc-50 px-3 py-1 rounded-full border border-zinc-100">
            Modo Visualização
          </div>
        )}
      </div>
    </div>
  );
}
