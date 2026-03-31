import { useEffect, useMemo, useState } from "react";
import Badge from "../components/appui/Badge.jsx";
import Button from "../components/appui/Button.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import { Input } from "../components/appui/Input.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import SettingsLayout from "../components/settings/SettingsLayout.jsx";
import { useAuth } from "../app/AuthContext.jsx";
import {
  createWorkspaceUser,
  listWorkspaceUsers,
  updateWorkspaceUser,
} from "../app/authApi.js";

const MODULE_CATALOG = [
  { key: "dashboard", label: "Dashboard" },
  { key: "offers", label: "Propostas" },
  { key: "newOffer", label: "Criar propostas" },
  { key: "clients", label: "Clientes" },
  { key: "calendar", label: "Agenda" },
  { key: "products", label: "Produtos" },
  { key: "reports", label: "Relatorios" },
  { key: "settings", label: "Configuracoes" },
  { key: "billing", label: "Billing" },
  { key: "team", label: "Equipe" },
];

const EDITABLE_MODULE_KEYS = [
  "offers",
  "newOffer",
  "clients",
  "calendar",
  "products",
  "reports",
  "settings",
];

const FALLBACK_PROFILE_CATALOG = [
  {
    key: "manager",
    label: "Manager",
    description:
      "Perfil para lideranca com acesso amplo a operacao comercial e aos relatorios do workspace.",
    defaultModules: {
      dashboard: true,
      offers: true,
      newOffer: true,
      clients: true,
      calendar: true,
      products: true,
      reports: true,
      settings: false,
      billing: false,
      team: false,
    },
  },
  {
    key: "sales",
    label: "Sales",
    description:
      "Perfil comercial focado em propostas, clientes, agenda e acompanhamento de resultados.",
    defaultModules: {
      dashboard: true,
      offers: true,
      newOffer: true,
      clients: true,
      calendar: true,
      products: false,
      reports: true,
      settings: false,
      billing: false,
      team: false,
    },
  },
  {
    key: "operations",
    label: "Operations",
    description:
      "Perfil operacional voltado para agenda, acompanhamento de propostas e carteira individual.",
    defaultModules: {
      dashboard: true,
      offers: true,
      newOffer: false,
      clients: true,
      calendar: true,
      products: false,
      reports: false,
      settings: false,
      billing: false,
      team: false,
    },
  },
];

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  profile: "sales",
  permissions: {},
};

function normalizePermissionMap(raw = {}) {
  return MODULE_CATALOG.reduce((acc, module) => {
    acc[module.key] = raw?.[module.key] === true;
    return acc;
  }, {});
}

function arePermissionMapsEqual(left = {}, right = {}) {
  return MODULE_CATALOG.every(
    (module) => (left?.[module.key] === true) === (right?.[module.key] === true),
  );
}

function getAllowedModuleLabels(map = {}) {
  return MODULE_CATALOG.filter((module) => map?.[module.key] === true).map(
    (module) => module.label,
  );
}

function getBlockedModuleLabels(map = {}) {
  return MODULE_CATALOG.filter((module) => map?.[module.key] !== true).map(
    (module) => module.label,
  );
}

function formatCurrency(cents = 0) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(cents || 0) / 100);
}

function getStatusTone(status) {
  return String(status || "active").toLowerCase() === "active" ? "PAID" : "EXPIRED";
}

function PermissionChips({ labels = [], tone = "PUBLIC", emptyLabel }) {
  if (!labels.length) {
    return <Badge tone="DRAFT">{emptyLabel}</Badge>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {labels.map((label) => (
        <Badge key={label} tone={tone}>
          {label}
        </Badge>
      ))}
    </div>
  );
}

function ProfileComparisonCard({ profile, selected, onSelect }) {
  const defaultModules = normalizePermissionMap(profile?.defaultModules);
  const allowed = getAllowedModuleLabels(defaultModules);
  const blocked = getBlockedModuleLabels(defaultModules);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "rounded-[28px] border p-5 text-left transition-all",
        selected
          ? "border-cyan-300 bg-[linear-gradient(135deg,rgba(219,234,254,0.96),rgba(204,251,241,0.7))] shadow-[0_20px_44px_-28px_rgba(37,99,235,0.28)] dark:border-cyan-400/30 dark:bg-[linear-gradient(135deg,rgba(37,99,235,0.2),rgba(20,184,166,0.12))]"
          : "surface-quiet hover:border-slate-300 hover:bg-slate-50 dark:hover:border-cyan-400/15 dark:hover:bg-white/8",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-950 dark:text-white">
            {profile?.label || profile?.key}
          </div>
          <div className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-300">
            {profile?.description || "Perfil de equipe"}
          </div>
        </div>
        {selected ? <Badge tone="PAID">Selecionado</Badge> : null}
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Libera por padrao
          </div>
          <PermissionChips labels={allowed} tone="PAID" emptyLabel="Nenhum modulo" />
        </div>
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Nao libera por padrao
          </div>
          <PermissionChips labels={blocked} tone="DRAFT" emptyLabel="Nenhum bloqueio" />
        </div>
      </div>
    </button>
  );
}

export default function SettingsTeam() {
  const { loadingMe, perms, workspace } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [creating, setCreating] = useState(false);
  const [items, setItems] = useState([]);
  const [profileCatalog, setProfileCatalog] = useState(FALLBACK_PROFILE_CATALOG);
  const [form, setForm] = useState(EMPTY_FORM);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const fieldClass = "app-field w-full px-4 py-3";

  const canUseTeam = perms?.isWorkspaceTeamPlan === true;
  const profileMap = useMemo(
    () =>
      new Map(
        (Array.isArray(profileCatalog) && profileCatalog.length
          ? profileCatalog
          : FALLBACK_PROFILE_CATALOG
        ).map((profile) => [profile.key, profile]),
      ),
    [profileCatalog],
  );

  function getProfileDefaults(profileKey) {
    return normalizePermissionMap(profileMap.get(profileKey)?.defaultModules || {});
  }

  async function loadUsers() {
    try {
      setLoading(true);
      setErr("");
      const data = await listWorkspaceUsers();
      setItems(Array.isArray(data?.items) ? data.items : []);
      setProfileCatalog(
        Array.isArray(data?.profileCatalog) && data.profileCatalog.length
          ? data.profileCatalog
          : FALLBACK_PROFILE_CATALOG,
      );
    } catch (error) {
      setErr(error?.message || "Falha ao carregar os usuarios do workspace.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!loadingMe && canUseTeam) {
      loadUsers();
    } else if (!loadingMe) {
      setLoading(false);
    }
  }, [loadingMe, canUseTeam]);

  useEffect(() => {
    setForm((prev) => {
      if (Object.keys(prev.permissions || {}).length > 0) return prev;
      return {
        ...prev,
        permissions: getProfileDefaults(prev.profile || "sales"),
      };
    });
  }, [profileMap]);

  const workspaceOwner = useMemo(
    () => items.find((item) => item.isWorkspaceOwner === true || item.role === "owner"),
    [items],
  );
  const formDefaults = useMemo(
    () => getProfileDefaults(form.profile),
    [form.profile, profileMap],
  );
  const formPermissions = useMemo(
    () => normalizePermissionMap(form.permissions),
    [form.permissions],
  );
  const formIsCustom = useMemo(
    () => !arePermissionMapsEqual(formPermissions, formDefaults),
    [formPermissions, formDefaults],
  );
  const selectedProfile = profileMap.get(form.profile) || FALLBACK_PROFILE_CATALOG[1];
  const selectedAllowed = useMemo(
    () => getAllowedModuleLabels(formDefaults),
    [formDefaults],
  );
  const selectedBlocked = useMemo(
    () => getBlockedModuleLabels(formDefaults),
    [formDefaults],
  );

  function handleCreateProfileChange(profileKey) {
    setForm((prev) => ({
      ...prev,
      profile: profileKey,
      permissions: getProfileDefaults(profileKey),
    }));
  }

  async function handleCreateUser(event) {
    event.preventDefault();
    try {
      setCreating(true);
      setErr("");
      setOkMsg("");
      await createWorkspaceUser({
        ...form,
        permissions: formPermissions,
      });
      setForm({
        ...EMPTY_FORM,
        permissions: getProfileDefaults(EMPTY_FORM.profile),
      });
      setOkMsg("Usuario criado com sucesso.");
      await loadUsers();
    } catch (error) {
      setErr(error?.message || "Falha ao criar usuario.");
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdateUser(userId, payload) {
    try {
      setSavingId(userId);
      setErr("");
      setOkMsg("");
      await updateWorkspaceUser(userId, payload);
      setOkMsg("Usuario atualizado com sucesso.");
      await loadUsers();
    } catch (error) {
      setErr(error?.message || "Falha ao atualizar usuario.");
    } finally {
      setSavingId("");
    }
  }

  if (loadingMe || loading) {
    return (
      <SettingsLayout
        activeTab="team"
        title="Equipe"
        subtitle="Gerencie usuarios, acessos por modulo e acompanhe a performance individual."
      >
        <Skeleton className="h-44 rounded-[28px]" />
        <Skeleton className="h-72 rounded-[28px]" />
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout
      activeTab="team"
      title="Equipe"
      subtitle="O dono do workspace controla usuarios, acessos e a visao individual da operacao. Clientes e produtos ficam compartilhados no catalogo do workspace."
    >
      {err ? (
        <div className="surface-quiet rounded-2xl border border-rose-200/80 p-4 text-sm text-rose-700 dark:border-rose-400/20 dark:text-rose-200">
          {err}
        </div>
      ) : null}

      {okMsg ? (
        <div className="surface-quiet rounded-2xl border border-emerald-200/80 p-4 text-sm text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-200">
          {okMsg}
        </div>
      ) : null}

      {!canUseTeam ? (
        <Card variant="quiet">
          <CardHeader
            title="Equipe indisponivel"
            subtitle="Gestao multiusuario fica disponivel a partir dos planos Business e Enterprise. Quando ativa, clientes e produtos passam a ser compartilhados no workspace."
          />
        </Card>
      ) : (
        <>
          <Card variant="quiet">
            <CardHeader
              title="Dono do workspace"
              subtitle="Esse usuario responde pela assinatura, pelos recursos do workspace e pela visao consolidada da operacao."
            />
            <CardBody className="space-y-4">
              <div className="surface-subtle rounded-2xl p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-950 dark:text-white">
                      {workspaceOwner?.name || "Owner do workspace"}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-300">
                      {workspaceOwner?.email || "Titular da conta"}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="PAID">Dono do workspace</Badge>
                    <Badge tone="PUBLIC">{String(workspace?.plan || "").toUpperCase()}</Badge>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card variant="elevated">
            <CardHeader
              title="Novo usuario"
              subtitle="Escolha um perfil com clareza visual e ajuste os modulos se precisar personalizar. Clientes e produtos sao compartilhados para quem tiver acesso a esses modulos."
            />
            <CardBody className="space-y-6">
              <div className="grid gap-4 xl:grid-cols-3">
                {(Array.isArray(profileCatalog) && profileCatalog.length
                  ? profileCatalog
                  : FALLBACK_PROFILE_CATALOG
                ).map((profile) => (
                  <ProfileComparisonCard
                    key={profile.key}
                    profile={profile}
                    selected={form.profile === profile.key}
                    onSelect={() => handleCreateProfileChange(profile.key)}
                  />
                ))}
              </div>

              <div className="surface-secondary rounded-[28px] p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-950 dark:text-white">
                      {selectedProfile?.label || form.profile}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-300">
                      {selectedProfile?.description || "Perfil de equipe"}
                    </div>
                  </div>
                  <Badge tone={formIsCustom ? "ACCEPTED" : "PAID"}>
                    {formIsCustom ? "Permissoes customizadas" : "Padrao do perfil"}
                  </Badge>
                </div>

                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                  <div>
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Libera por padrao
                    </div>
                    <PermissionChips
                      labels={selectedAllowed}
                      tone="PAID"
                      emptyLabel="Nenhum modulo"
                    />
                  </div>
                  <div>
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Nao libera por padrao
                    </div>
                    <PermissionChips
                      labels={selectedBlocked}
                      tone="DRAFT"
                      emptyLabel="Nenhum bloqueio"
                    />
                  </div>
                </div>
              </div>

              <form className="space-y-4" onSubmit={handleCreateUser}>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-900 dark:text-white">
                      Nome
                    </label>
                    <Input
                      value={form.name}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, name: event.target.value }))
                      }
                      placeholder="Nome do colaborador"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-900 dark:text-white">
                      E-mail
                    </label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, email: event.target.value }))
                      }
                      placeholder="email@empresa.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-900 dark:text-white">
                      Senha inicial
                    </label>
                    <Input
                      type="password"
                      value={form.password}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, password: event.target.value }))
                      }
                      placeholder="Minimo 6 caracteres"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-900 dark:text-white">
                      Perfil
                    </label>
                    <select
                      value={form.profile}
                      onChange={(event) => handleCreateProfileChange(event.target.value)}
                      className={fieldClass}
                    >
                      {(Array.isArray(profileCatalog) && profileCatalog.length
                        ? profileCatalog
                        : FALLBACK_PROFILE_CATALOG
                      ).map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="surface-secondary rounded-[28px] p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-950 dark:text-white">
                        Ajuste fino dos modulos
                      </div>
                      <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-300">
                        O perfil aplica uma base padrao. Se voce alterar os checkboxes abaixo, este usuario passa a usar permissoes customizadas.
                      </div>
                    </div>
                    <Badge tone={formIsCustom ? "ACCEPTED" : "PAID"}>
                      {formIsCustom ? "Customizado" : "Padrao do perfil"}
                    </Badge>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {EDITABLE_MODULE_KEYS.map((key) => {
                      const module = MODULE_CATALOG.find((item) => item.key === key);
                      return (
                        <label
                          key={key}
                          className="surface-subtle flex items-center justify-between rounded-2xl px-4 py-3 text-sm"
                        >
                          <span className="font-medium text-slate-900 dark:text-white">
                            {module?.label || key}
                          </span>
                          <input
                            type="checkbox"
                            checked={formPermissions[key] === true}
                            onChange={(event) =>
                              setForm((prev) => ({
                                ...prev,
                                permissions: {
                                  ...normalizePermissionMap(prev.permissions),
                                  [key]: event.target.checked,
                                },
                              }))
                            }
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={creating}>
                    {creating ? "Criando..." : "Criar usuario"}
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>

          <Card variant="quiet">
            <CardHeader
              title="Usuarios e performance"
              subtitle="Ofertas, agenda e relatorios seguem com carteira individual. Clientes e produtos ficam compartilhados no workspace."
            />
            <CardBody className="space-y-4">
              {items
                .filter((item) => item.isWorkspaceOwner !== true && item.role !== "owner")
                .map((item) => {
                  const profileDefaults = getProfileDefaults(item.profile);
                  const effectivePermissions = normalizePermissionMap(
                    item.modulePermissions || item.permissions || {},
                  );
                  const itemIsCustom = !arePermissionMapsEqual(
                    effectivePermissions,
                    profileDefaults,
                  );
                  const itemProfile = profileMap.get(item.profile) || {
                    key: item.profile,
                    label: String(item.profile || "").toUpperCase(),
                    description: "Perfil de equipe",
                  };
                  const itemAllowed = getAllowedModuleLabels(effectivePermissions);
                  const itemBlocked = getBlockedModuleLabels(effectivePermissions);

                  return (
                    <div
                      key={item._id}
                      className="surface-subtle rounded-3xl border border-slate-200/70 p-4 dark:border-white/10"
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-semibold text-slate-950 dark:text-white">
                              {item.name}
                            </div>
                            <Badge tone={getStatusTone(item.status)}>
                              {item.status === "active" ? "Ativo" : "Desativado"}
                            </Badge>
                            <Badge tone="PUBLIC">
                              {itemProfile?.label || String(item.profile || "").toUpperCase()}
                            </Badge>
                            <Badge tone={itemIsCustom ? "ACCEPTED" : "PAID"}>
                              {itemIsCustom
                                ? "Permissoes customizadas"
                                : "Padrao do perfil"}
                            </Badge>
                          </div>
                          <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-300">
                            {item.email}
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <div className="surface-quiet rounded-2xl px-4 py-3">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                              Propostas
                            </div>
                            <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
                              {item.performance?.offersCreated || 0}
                            </div>
                          </div>
                          <div className="surface-quiet rounded-2xl px-4 py-3">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                              Conversao
                            </div>
                            <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
                              {Number(item.performance?.conversionPct || 0).toFixed(2)}%
                            </div>
                          </div>
                          <div className="surface-quiet rounded-2xl px-4 py-3">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                              Receita
                            </div>
                            <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
                              {formatCurrency(item.performance?.paidRevenueCents || 0)}
                            </div>
                          </div>
                          <div className="surface-quiet rounded-2xl px-4 py-3">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                              Agenda
                            </div>
                            <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
                              {item.performance?.bookingsConfirmed || 0} confirmados
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="surface-secondary mt-4 rounded-[28px] p-5">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="text-sm font-semibold text-slate-950 dark:text-white">
                              {itemProfile?.label || item.profile}
                            </div>
                            <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-300">
                              {itemProfile?.description || "Perfil de equipe"}
                            </div>
                          </div>
                          <Badge tone={itemIsCustom ? "ACCEPTED" : "PAID"}>
                            {itemIsCustom
                              ? "Permissoes customizadas"
                              : "Padrao do perfil"}
                          </Badge>
                        </div>

                        <div className="mt-5 grid gap-5 lg:grid-cols-2">
                          <div>
                            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                              Libera agora
                            </div>
                            <PermissionChips
                              labels={itemAllowed}
                              tone="PAID"
                              emptyLabel="Nenhum modulo"
                            />
                          </div>
                          <div>
                            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                              Nao libera agora
                            </div>
                            <PermissionChips
                              labels={itemBlocked}
                              tone="DRAFT"
                              emptyLabel="Nenhum bloqueio"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 xl:grid-cols-[220px,1fr,120px]">
                        <div className="space-y-2">
                          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                            Perfil
                          </label>
                          <select
                            value={item.profile}
                            onChange={(event) =>
                              handleUpdateUser(item._id, {
                                profile: event.target.value,
                                permissions: getProfileDefaults(event.target.value),
                              })
                            }
                            className={fieldClass}
                            disabled={savingId === item._id}
                          >
                            {(Array.isArray(profileCatalog) && profileCatalog.length
                              ? profileCatalog
                              : FALLBACK_PROFILE_CATALOG
                            ).map((option) => (
                              <option key={option.key} value={option.key}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="surface-secondary rounded-[28px] p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="text-sm font-semibold text-slate-950 dark:text-white">
                                Ajuste fino dos modulos
                              </div>
                              <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-300">
                                Os checkboxes abaixo personalizam o perfil deste usuario sem alterar os padroes do catalogo.
                              </div>
                            </div>
                            <Badge tone={itemIsCustom ? "ACCEPTED" : "PAID"}>
                              {itemIsCustom ? "Customizado" : "Padrao do perfil"}
                            </Badge>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            {EDITABLE_MODULE_KEYS.map((key) => {
                              const module = MODULE_CATALOG.find((field) => field.key === key);
                              return (
                                <label
                                  key={`${item._id}-${key}`}
                                  className="surface-subtle flex items-center justify-between rounded-2xl px-4 py-3 text-sm"
                                >
                                  <span className="font-medium text-slate-900 dark:text-white">
                                    {module?.label || key}
                                  </span>
                                  <input
                                    type="checkbox"
                                    checked={effectivePermissions[key] === true}
                                    disabled={savingId === item._id}
                                    onChange={(event) =>
                                      handleUpdateUser(item._id, {
                                        permissions: {
                                          ...effectivePermissions,
                                          [key]: event.target.checked,
                                        },
                                      })
                                    }
                                  />
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex items-end justify-end">
                          <Button
                            type="button"
                            variant={item.status === "active" ? "ghost" : "secondary"}
                            disabled={savingId === item._id}
                            onClick={() =>
                              handleUpdateUser(item._id, {
                                status: item.status === "active" ? "disabled" : "active",
                              })
                            }
                          >
                            {savingId === item._id
                              ? "Salvando..."
                              : item.status === "active"
                                ? "Desativar"
                                : "Reativar"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </CardBody>
          </Card>
        </>
      )}
    </SettingsLayout>
  );
}
