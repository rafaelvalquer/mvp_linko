import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/AuthContext.jsx";

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
    <div className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-emerald-500" />
          <div>
            <div className="text-sm font-semibold">PayLink</div>
            <div className="text-xs text-zinc-500">
              Propostas • Agenda • Pix
            </div>
          </div>
        </div>
        {user ? (
          <div className="flex items-center gap-3">
            <div className="text-xs text-zinc-700">
              Olá, <span className="font-semibold">{displayName}</span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
            >
              Sair
            </button>
          </div>
        ) : (
          <div className="text-xs text-zinc-500">MVP (sem login)</div>
        )}
      </div>
    </div>
  );
}
