import { NavLink } from "react-router-dom";
import PageHeader from "../appui/PageHeader.jsx";
import Card, { CardBody } from "../appui/Card.jsx";
import Shell from "../layout/Shell.jsx";
import { useAuth } from "../../app/AuthContext.jsx";
import useThemeToggle from "../../app/useThemeToggle.js";

const TABS = [
  {
    key: "notifications",
    to: "/settings/notifications",
    label: "Notificacoes",
    description: "Email, WhatsApp e limites por plano.",
  },
  {
    key: "agenda",
    to: "/settings/agenda",
    label: "Agenda",
    description: "Disponibilidade, horarios e excecoes.",
  },
];

function formatPlanLabel(value) {
  const plan = String(value || "start").trim().toLowerCase();
  if (plan === "enterprise") return "Enterprise";
  if (plan === "business") return "Business";
  if (plan === "pro") return "Pro";
  return "Start";
}

export default function SettingsLayout({
  activeTab = "notifications",
  title,
  subtitle,
  actions = null,
  children,
}) {
  const { workspace, perms, user } = useAuth();
  const { isDark } = useThemeToggle();
  const plan =
    perms?.plan || workspace?.plan || user?.plan || user?.workspace?.plan || "start";

  return (
    <Shell>
      <div className="space-y-6">
        <PageHeader
          title={title || "Configuracoes"}
          subtitle={
            subtitle ||
            "Centralize preferencias do workspace, canais disponiveis e limites do plano."
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={[
                  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.18em]",
                  isDark
                    ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-100"
                    : "border-cyan-200 bg-cyan-50 text-cyan-700",
                ].join(" ")}
              >
                Plano {formatPlanLabel(plan)}
              </span>
              {actions}
            </div>
          }
        />

        <Card>
          <CardBody className="space-y-3 p-3">
            <div
              className={[
                "grid gap-2",
                TABS.length > 1 ? "sm:grid-cols-2" : "sm:grid-cols-1",
              ].join(" ")}
            >
              {TABS.map((tab) => {
                const active = tab.key === activeTab;
                return (
                  <NavLink
                    key={tab.key}
                    to={tab.to}
                    className={[
                      "rounded-[24px] border px-4 py-3 transition-all",
                      active
                        ? isDark
                          ? "border-cyan-400/25 bg-[linear-gradient(135deg,rgba(37,99,235,0.26),rgba(20,184,166,0.2))] text-white shadow-[0_20px_44px_-28px_rgba(37,99,235,0.65)]"
                          : "border-cyan-200 bg-[linear-gradient(135deg,rgba(219,234,254,0.96),rgba(204,251,241,0.7))] text-slate-950 shadow-[0_20px_44px_-28px_rgba(37,99,235,0.28)]"
                        : isDark
                          ? "border-white/10 bg-white/5 text-slate-200 hover:border-cyan-400/20 hover:bg-white/8"
                          : "border-slate-200/80 bg-white/80 text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <div className="text-sm font-bold">{tab.label}</div>
                    <div
                      className={[
                        "mt-1 text-xs leading-5",
                        active
                          ? isDark
                            ? "text-slate-200"
                            : "text-slate-600"
                          : isDark
                            ? "text-slate-400"
                            : "text-slate-500",
                      ].join(" ")}
                    >
                      {tab.description}
                    </div>
                  </NavLink>
                );
              })}
            </div>
          </CardBody>
        </Card>

        <div className="space-y-6 pb-24">{children}</div>
      </div>
    </Shell>
  );
}
