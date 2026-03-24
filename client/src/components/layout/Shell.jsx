import { useEffect, useMemo, useState } from "react";
import { PanelLeft } from "lucide-react";
import { Link } from "react-router-dom";

import { useAuth } from "../../app/AuthContext.jsx";
import useThemeToggle from "../../app/useThemeToggle.js";
import MyWhatsAppModal from "../account/MyWhatsAppModal.jsx";
import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";
import {
  MyWhatsAppModalProvider,
} from "./MyWhatsAppModalContext.jsx";

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

function MobileMenuButton({ isDark, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Abrir menu"
      className={[
        "fixed left-4 top-[76px] z-40 inline-flex h-10 w-10 items-center justify-center rounded-2xl border backdrop-blur-xl transition md:hidden",
        isDark
          ? "border-white/10 bg-[rgba(8,15,30,0.88)] text-slate-100 shadow-[0_18px_40px_-20px_rgba(15,23,42,0.9)] hover:border-cyan-400/30 hover:bg-[rgba(10,18,36,0.96)]"
          : "border-slate-200/80 bg-white/92 text-slate-700 shadow-[0_18px_36px_-22px_rgba(15,23,42,0.25)] hover:border-sky-300 hover:bg-white hover:text-slate-950",
      ].join(" ")}
    >
      <PanelLeft className="h-5 w-5" />
    </button>
  );
}

function BillingInlineNotice({ isDark }) {
  const { subscriptionStatus, canCreatePix } = useAuth();
  const status = String(subscriptionStatus || "").toLowerCase();

  if (!subscriptionStatus || canCreatePix) return null;

  const title =
    status === "past_due"
      ? "Pagamento pendente"
      : status === "inactive"
        ? "Assinatura inativa"
        : status === "canceled"
          ? "Assinatura cancelada"
          : "Assinatura com restricao";

  const description =
    status === "past_due"
      ? "A cobranca Pix esta bloqueada ate a regularizacao do pagamento."
      : "A cobranca Pix esta bloqueada. Ative um plano para continuar usando a operacao completa.";

  return (
    <div
      className={[
        "rounded-[28px] border p-4 shadow-[0_20px_40px_-28px_rgba(180,83,9,0.35)] sm:p-5",
        isDark
          ? "border-amber-400/20 bg-[linear-gradient(135deg,rgba(120,53,15,0.32),rgba(68,64,18,0.22))] shadow-[0_24px_40px_-28px_rgba(15,23,42,0.55)]"
          : "border-amber-200/80 bg-[linear-gradient(135deg,#fff7ed,#fffbeb)]",
      ].join(" ")}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div
            className={[
              "text-sm font-bold uppercase tracking-[0.18em]",
              isDark ? "text-amber-200" : "text-amber-700",
            ].join(" ")}
          >
            {title}
          </div>
          <div
            className={[
              "mt-1 text-sm leading-6",
              isDark ? "text-amber-50" : "text-amber-900",
            ].join(" ")}
          >
            {description}
          </div>
        </div>

        <Link
          to="/billing/plans"
          className={[
            "inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition",
            isDark
              ? "bg-white text-slate-950 hover:bg-slate-100"
              : "bg-slate-950 text-white hover:bg-slate-800",
          ].join(" ")}
        >
          Ver planos
        </Link>
      </div>
    </div>
  );
}

export default function Shell({ children, topbarAction = null }) {
  const { isDark, setIsDark } = useThemeToggle();
  const [sidebarExpanded, setSidebarExpanded] = useState(readSidebarExpanded);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [myWhatsAppModalOpen, setMyWhatsAppModalOpen] = useState(false);

  const myWhatsAppModalActions = useMemo(
    () => ({
      openMyWhatsAppModal: () => setMyWhatsAppModalOpen(true),
      closeMyWhatsAppModal: () => setMyWhatsAppModalOpen(false),
    }),
    [],
  );

  useEffect(() => {
    persistSidebarExpanded(sidebarExpanded);
  }, [sidebarExpanded]);

  useEffect(() => {
    if (!mobileSidebarOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
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
    <MyWhatsAppModalProvider value={myWhatsAppModalActions}>
      <div
        className={[
          "relative min-h-screen overflow-x-hidden transition-colors",
          isDark ? "bg-[#040b18] text-white" : "bg-[rgb(246,248,252)] text-slate-900",
        ].join(" ")}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className={[
              "absolute left-[-140px] top-[-140px] h-80 w-80 rounded-full blur-3xl",
              isDark ? "bg-cyan-400/14" : "bg-cyan-400/18",
            ].join(" ")}
          />
          <div
            className={[
              "absolute right-[-160px] top-1/4 h-96 w-96 rounded-full blur-3xl",
              isDark ? "bg-blue-500/18" : "bg-blue-500/14",
            ].join(" ")}
          />
          <div className="absolute bottom-[-220px] left-1/3 h-[30rem] w-[30rem] rounded-full bg-emerald-400/10 blur-3xl" />
        </div>

        <Topbar
          isDark={isDark}
          setIsDark={setIsDark}
          contextualAction={topbarAction}
          onOpenMyWhatsApp={myWhatsAppModalActions.openMyWhatsAppModal}
        />
        <MobileMenuButton
          isDark={isDark}
          onClick={() => setMobileSidebarOpen(true)}
        />

        <div className="relative flex w-full">
          <aside
            className={[
              "hidden md:block md:shrink-0",
              "transition-[width] duration-300 ease-out",
              sidebarExpanded ? "md:w-[288px]" : "md:w-[104px]",
            ].join(" ")}
          >
            <div className="sticky top-[68px] h-[calc(100vh-68px)] overflow-y-auto p-4">
              <Sidebar
                collapsed={!sidebarExpanded}
                onToggle={() => setSidebarExpanded((previous) => !previous)}
              />
            </div>
          </aside>

          <main className="min-w-0 flex-1 pb-8">
            <div className="px-4 pb-6 pt-[80px] sm:px-5 lg:px-6">
              <div
                className={[
                  "min-h-[calc(100vh-104px)] rounded-[30px] border p-4 backdrop-blur-xl transition-colors sm:p-5 lg:p-6",
                  isDark
                    ? "border-white/10 bg-[linear-gradient(180deg,rgba(12,19,34,0.94),rgba(6,12,24,0.9))] shadow-[0_22px_72px_-52px_rgba(15,23,42,0.8)]"
                    : "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(243,246,250,0.9))] shadow-[0_22px_72px_-56px_rgba(15,23,42,0.16)]",
                ].join(" ")}
              >
                <div className="space-y-6">
                  <BillingInlineNotice isDark={isDark} />
                  {children}
                </div>
              </div>
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
              "absolute inset-0 backdrop-blur-sm transition-opacity duration-300",
              isDark ? "bg-slate-950/60" : "bg-slate-950/30",
              mobileSidebarOpen ? "opacity-100" : "opacity-0",
            ].join(" ")}
          />

          <div
            className={[
              "absolute inset-y-0 left-0 w-[90vw] max-w-[340px] transition-transform duration-300 ease-out",
              mobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
            ].join(" ")}
          >
            <div className="h-full overflow-y-auto p-4 pt-[84px]">
              <Sidebar
                collapsed={false}
                mobile
                onToggle={() => setMobileSidebarOpen(false)}
                onNavigate={() => setMobileSidebarOpen(false)}
              />
            </div>
          </div>
        </div>

        <MyWhatsAppModal
          open={myWhatsAppModalOpen}
          onClose={myWhatsAppModalActions.closeMyWhatsAppModal}
        />
      </div>
    </MyWhatsAppModalProvider>
  );
}
