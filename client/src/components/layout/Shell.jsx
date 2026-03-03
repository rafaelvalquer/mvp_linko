import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";
import { useAuth } from "../../app/AuthContext.jsx";
import { Link } from "react-router-dom";

function BillingInlineNotice() {
  const { subscriptionStatus, canCreatePix } = useAuth();
  const s = String(subscriptionStatus || "").toLowerCase();

  if (!subscriptionStatus || canCreatePix) return null;

  const title =
    s === "past_due"
      ? "Pagamento pendente"
      : s === "inactive"
        ? "Assinatura inativa"
        : s === "canceled"
          ? "Assinatura cancelada"
          : "Assinatura com restrição";

  const desc =
    s === "past_due"
      ? "A geração de cobranças Pix está bloqueada até regularizar o pagamento."
      : "A geração de cobranças Pix está bloqueada. Assine/reative um plano para continuar.";

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-sm">{desc}</div>
      <div className="mt-3">
        <Link
          to="/billing/plans"
          className="inline-flex rounded-xl bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
        >
          Ver planos
        </Link>
      </div>
    </div>
  );
}

export default function Shell({ children }) {
  return (
    <div className="min-h-screen w-full bg-white">
      <Topbar />

      {/* Layout full-width */}
      <div className="flex w-full flex-col md:flex-row">
        {/* Sidebar colada na esquerda */}
        <aside
          className={[
            "w-full md:w-[280px] shrink-0 bg-white",
            "border-b md:border-b-0 md:border-r border-zinc-200",
          ].join(" ")}
        >
          {/* Sticky no desktop */}
          <div className="md:sticky md:top-0 md:h-[calc(100vh-0px)] md:overflow-y-auto p-4">
            <Sidebar />
          </div>
        </aside>

        {/* Conteúdo principal ocupa todo o resto */}
        <main className="flex-1 min-w-0">
          <div className="px-4 sm:px-6 py-6 space-y-6">
            <BillingInlineNotice />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
