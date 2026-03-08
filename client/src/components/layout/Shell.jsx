import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../app/AuthContext.jsx";
import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";

function readSidebarExpanded() {
  try {
    const raw = localStorage.getItem("sidebar_expanded");
    if (raw == null) return true;
    return raw === "1";
  } catch {
    return true;
  }
}

function persistSidebarExpanded(value) {
  try {
    localStorage.setItem("sidebar_expanded", value ? "1" : "0");
  } catch {}
}

function MobileMenuButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Abrir menu"
      className="fixed left-4 top-20 z-40 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white/95 text-zinc-700 shadow-[0_10px_30px_rgba(15,23,42,0.10)] backdrop-blur transition hover:border-zinc-300 hover:bg-white hover:text-zinc-900 md:hidden"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="4" x2="20" y1="6" y2="6" />
        <line x1="4" x2="20" y1="12" y2="12" />
        <line x1="4" x2="20" y1="18" y2="18" />
      </svg>
    </button>
  );
}

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
      : "A geração de cobranças Pix está bloqueada. Assine ou reative um plano para continuar.";

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-sm">{desc}</div>
      <div className="mt-3">
        <Link
          to="/billing/plans"
          className="inline-flex rounded-xl bg-zinc-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800"
        >
          Ver planos
        </Link>
      </div>
    </div>
  );
}

export default function Shell({ children }) {
  const [sidebarExpanded, setSidebarExpanded] = useState(readSidebarExpanded);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    persistSidebarExpanded(sidebarExpanded);
  }, [sidebarExpanded]);

  useEffect(() => {
    if (!mobileSidebarOpen) return undefined;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileSidebarOpen]);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 768) {
        setMobileSidebarOpen(false);
      }
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="min-h-screen w-full bg-[linear-gradient(180deg,#ffffff_0%,#fafafa_100%)]">
      <Topbar />

      <MobileMenuButton onClick={() => setMobileSidebarOpen(true)} />

      <div className="flex w-full">
        <aside
          className={[
            "hidden md:block md:shrink-0 md:border-r md:border-zinc-200/80 md:bg-white/70",
            "transition-[width] duration-300 ease-out",
            sidebarExpanded ? "md:w-[288px]" : "md:w-[104px]",
          ].join(" ")}
        >
          <div className="sticky top-0 h-screen overflow-y-auto p-4">
            <Sidebar
              collapsed={!sidebarExpanded}
              onToggle={() => setSidebarExpanded((prev) => !prev)}
            />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="space-y-6 px-4 pb-6 pt-20 sm:px-6 md:py-6">
            <BillingInlineNotice />
            {children}
          </div>
        </main>
      </div>

      <div
        className={[
          "fixed inset-0 z-50 md:hidden",
          mobileSidebarOpen ? "pointer-events-auto" : "pointer-events-none",
        ].join(" ")}
      >
        <div
          onClick={() => setMobileSidebarOpen(false)}
          className={[
            "absolute inset-0 bg-zinc-950/30 backdrop-blur-[2px] transition-opacity duration-300",
            mobileSidebarOpen ? "opacity-100" : "opacity-0",
          ].join(" ")}
        />

        <div
          className={[
            "absolute inset-y-0 left-0 w-[88vw] max-w-[320px] transition-transform duration-300 ease-out",
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
        >
          <div className="h-full p-4">
            <Sidebar
              collapsed={false}
              mobile
              onToggle={() => setMobileSidebarOpen(false)}
              onNavigate={() => setMobileSidebarOpen(false)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
