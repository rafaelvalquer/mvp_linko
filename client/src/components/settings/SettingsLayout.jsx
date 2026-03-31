import { NavLink } from "react-router-dom";
import PageHeader from "../appui/PageHeader.jsx";
import Badge from "../appui/Badge.jsx";
import Card, { CardBody } from "../appui/Card.jsx";
import Shell from "../layout/Shell.jsx";
import { useAuth } from "../../app/AuthContext.jsx";

const TABS = [
  {
    key: "account",
    to: "/settings/account",
    label: "Conta",
    description: "Dados do usuario e numero para comandos no WhatsApp.",
  },
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
  {
    key: "team",
    to: "/settings/team",
    label: "Equipe",
    description: "Usuarios, acessos e performance por colaborador.",
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
  activeTab = "account",
  title,
  subtitle,
  actions = null,
  children,
}) {
  const { workspace, perms, user } = useAuth();
  const plan =
    perms?.plan || workspace?.plan || user?.plan || user?.workspace?.plan || "start";
  const visibleTabs = TABS.filter((tab) => {
    if (tab.key === "team") {
      return perms?.isWorkspaceTeamPlan === true && perms?.isWorkspaceOwner === true;
    }
    return true;
  });

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
              <Badge tone="NEUTRAL">Plano {formatPlanLabel(plan)}</Badge>
              {actions}
            </div>
          }
        />

        <Card variant="quiet">
          <CardBody className="space-y-3 p-3">
            <div
              className={[
                "grid gap-2",
                visibleTabs.length > 2
                  ? "sm:grid-cols-2 lg:grid-cols-3"
                  : visibleTabs.length > 1
                    ? "sm:grid-cols-2"
                    : "sm:grid-cols-1",
              ].join(" ")}
            >
              {visibleTabs.map((tab) => {
                const active = tab.key === activeTab;
                return (
                  <NavLink
                    key={tab.key}
                    to={tab.to}
                    className={[
                      "rounded-[24px] border px-4 py-3 transition-all",
                      active
                        ? "border-sky-300 bg-[linear-gradient(135deg,rgba(37,99,235,0.12),rgba(20,184,166,0.16))] text-slate-950 shadow-[0_20px_44px_-28px_rgba(37,99,235,0.3)] dark:border-sky-400/25 dark:bg-[linear-gradient(135deg,rgba(37,99,235,0.2),rgba(20,184,166,0.14))] dark:text-white"
                        : "surface-quiet text-slate-700 hover:border-slate-300 hover:text-slate-950 dark:text-slate-200 dark:hover:border-white/15 dark:hover:text-white",
                    ].join(" ")}
                  >
                    <div className="text-sm font-bold">{tab.label}</div>
                    <div
                      className={[
                        "mt-1 text-xs leading-5",
                        active
                          ? "text-slate-600 dark:text-slate-200"
                          : "text-slate-500 dark:text-slate-400",
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

        <div className="space-y-6 pb-32">{children}</div>
      </div>
    </Shell>
  );
}
