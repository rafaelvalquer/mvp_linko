import mongoose from "mongoose";

export const TEAM_WORKSPACE_PLANS = new Set(["business", "enterprise"]);

export const WORKSPACE_MODULE_KEYS = [
  "dashboard",
  "offers",
  "newOffer",
  "clients",
  "calendar",
  "products",
  "reports",
  "settings",
  "billing",
  "team",
];

const ALL_MODULES = Object.freeze(
  WORKSPACE_MODULE_KEYS.reduce((acc, key) => {
    acc[key] = true;
    return acc;
  }, {}),
);

const PROFILE_DEFAULTS = Object.freeze({
  owner: ALL_MODULES,
  manager: {
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
  sales: {
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
  operations: {
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
});

const PROFILE_METADATA = Object.freeze({
  owner: {
    key: "owner",
    label: "Owner",
    description:
      "Responsavel pela assinatura, configuracoes criticas, equipe e visao total do workspace.",
  },
  manager: {
    key: "manager",
    label: "Manager",
    description:
      "Perfil para lideranca com acesso amplo a operacao comercial e aos relatorios do workspace.",
  },
  sales: {
    key: "sales",
    label: "Sales",
    description:
      "Perfil comercial focado em propostas, clientes, agenda e acompanhamento de resultados.",
  },
  operations: {
    key: "operations",
    label: "Operations",
    description:
      "Perfil operacional voltado para agenda, acompanhamento de propostas e carteira individual.",
  },
});

export function normalizeWorkspacePlan(value) {
  const plan = String(value || "start")
    .trim()
    .toLowerCase();
  if (TEAM_WORKSPACE_PLANS.has(plan) || plan === "start" || plan === "pro") {
    return plan;
  }
  return "start";
}

export function canUseWorkspaceTeam(plan) {
  return TEAM_WORKSPACE_PLANS.has(normalizeWorkspacePlan(plan));
}

export function canUseWorkspaceSharedCatalog(plan) {
  return canUseWorkspaceTeam(plan);
}

export function normalizeWorkspaceProfile(value, fallback = "sales") {
  const profile = String(value || fallback)
    .trim()
    .toLowerCase();

  if (
    profile === "owner" ||
    profile === "manager" ||
    profile === "sales" ||
    profile === "operations"
  ) {
    return profile;
  }

  return fallback;
}

export function sanitizeModulePermissions(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return WORKSPACE_MODULE_KEYS.reduce((acc, key) => {
    if (source[key] === true || source[key] === false) {
      acc[key] = source[key];
    }
    return acc;
  }, {});
}

export function getDefaultModulePermissions(profile) {
  const normalized = normalizeWorkspaceProfile(profile, "sales");
  return {
    ...(PROFILE_DEFAULTS[normalized] || PROFILE_DEFAULTS.sales),
  };
}

export function getWorkspaceProfileCatalog() {
  return ["manager", "sales", "operations"].map((key) => ({
    key,
    label: PROFILE_METADATA[key]?.label || key,
    description: PROFILE_METADATA[key]?.description || "",
    defaultModules: getDefaultModulePermissions(key),
  }));
}

function sameId(a, b) {
  if (!a || !b) return false;
  return String(a) === String(b);
}

export function isWorkspaceOwnerUser(user, workspaceOwnerUserId = null) {
  if (!user) return false;
  if (user.role === "owner") return true;
  if (user.isWorkspaceOwner === true) return true;
  if (sameId(user._id, workspaceOwnerUserId)) return true;
  return false;
}

export function resolveModulePermissions({
  user,
  workspacePlan,
  workspaceOwnerUserId = null,
}) {
  const plan = normalizeWorkspacePlan(workspacePlan);
  if (!canUseWorkspaceTeam(plan)) {
    return { ...ALL_MODULES };
  }

  if (isWorkspaceOwnerUser(user, workspaceOwnerUserId)) {
    return { ...ALL_MODULES };
  }

  const profile = normalizeWorkspaceProfile(
    user?.profile,
    user?.role === "owner" ? "owner" : "sales",
  );
  const defaults = getDefaultModulePermissions(profile);
  const overrides = sanitizeModulePermissions(user?.permissions);

  return {
    ...defaults,
    ...overrides,
    billing: false,
    team: false,
  };
}

export function canAccessWorkspaceModule({
  user,
  workspacePlan,
  workspaceOwnerUserId = null,
  moduleKey,
}) {
  if (!moduleKey) return true;
  const permissions = resolveModulePermissions({
    user,
    workspacePlan,
    workspaceOwnerUserId,
  });
  return permissions[moduleKey] === true;
}

export function getScopedOwnerUserId({
  user,
  workspacePlan,
  workspaceOwnerUserId = null,
}) {
  const plan = normalizeWorkspacePlan(workspacePlan);
  if (!canUseWorkspaceTeam(plan)) return null;
  if (isWorkspaceOwnerUser(user, workspaceOwnerUserId)) return null;
  return user?._id || null;
}

export function getScopedCatalogOwnerUserId({
  user,
  workspacePlan,
  workspaceOwnerUserId = null,
}) {
  const plan = normalizeWorkspacePlan(workspacePlan);
  if (canUseWorkspaceSharedCatalog(plan)) return null;
  if (isWorkspaceOwnerUser(user, workspaceOwnerUserId)) return null;
  return user?._id || null;
}

export function buildWorkspaceScopeFilter({
  user,
  workspaceId,
  workspacePlan,
  workspaceOwnerUserId = null,
}) {
  const filter = { workspaceId };
  const scopedOwnerUserId = getScopedOwnerUserId({
    user,
    workspacePlan,
    workspaceOwnerUserId,
  });
  if (scopedOwnerUserId) {
    filter.ownerUserId =
      scopedOwnerUserId instanceof mongoose.Types.ObjectId
        ? scopedOwnerUserId
        : new mongoose.Types.ObjectId(String(scopedOwnerUserId));
  }
  return filter;
}

export function buildWorkspaceCatalogFilter({
  user,
  workspaceId,
  workspacePlan,
  workspaceOwnerUserId = null,
}) {
  const filter = { workspaceId };
  const scopedOwnerUserId = getScopedCatalogOwnerUserId({
    user,
    workspacePlan,
    workspaceOwnerUserId,
  });
  if (scopedOwnerUserId) {
    filter.ownerUserId =
      scopedOwnerUserId instanceof mongoose.Types.ObjectId
        ? scopedOwnerUserId
        : new mongoose.Types.ObjectId(String(scopedOwnerUserId));
  }
  return filter;
}

export function assertWorkspaceTeamPlan(plan) {
  if (canUseWorkspaceTeam(plan)) return;
  const err = new Error(
    "Gestao de equipe e permissoes ficam disponiveis a partir do plano Business.",
  );
  err.status = 403;
  err.code = "TEAM_FEATURE_PLAN_BLOCKED";
  throw err;
}

export function assertWorkspaceOwner(user, workspaceOwnerUserId = null) {
  if (isWorkspaceOwnerUser(user, workspaceOwnerUserId)) return;
  const err = new Error("Apenas o dono do workspace pode realizar esta acao.");
  err.status = 403;
  err.code = "WORKSPACE_OWNER_REQUIRED";
  throw err;
}

export function assertWorkspaceModuleAccess({
  user,
  workspacePlan,
  workspaceOwnerUserId = null,
  moduleKey,
}) {
  if (
    canAccessWorkspaceModule({
      user,
      workspacePlan,
      workspaceOwnerUserId,
      moduleKey,
    })
  ) {
    return;
  }

  const err = new Error("Voce nao tem permissao para acessar este modulo.");
  err.status = 403;
  err.code = "MODULE_ACCESS_DENIED";
  err.moduleKey = moduleKey;
  throw err;
}
