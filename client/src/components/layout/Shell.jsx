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
    <div className="col-span-12 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
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
    <div className="min-h-screen">
      <Topbar />
      <div className="mx-auto grid max-w-6xl grid-cols-12 gap-6 px-4 py-6">
        <BillingInlineNotice />
        <div className="col-span-12 md:col-span-3">
          <Sidebar />
        </div>
        <main className="col-span-12 md:col-span-9">{children}</main>
      </div>
    </div>
  );
}
