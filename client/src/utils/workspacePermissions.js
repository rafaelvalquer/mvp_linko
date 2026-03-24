const MODULE_KEYS = [
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

function allModulesEnabled() {
  return MODULE_KEYS.reduce((acc, key) => {
    acc[key] = true;
    return acc;
  }, {});
}

export function isWorkspaceTeamPlan(plan) {
  const normalized = String(plan || "start")
    .trim()
    .toLowerCase();
  return normalized === "business" || normalized === "enterprise";
}

export function normalizeWorkspaceModulePermissions({
  plan,
  isWorkspaceOwner,
  modulePermissions,
}) {
  if (!isWorkspaceTeamPlan(plan) || isWorkspaceOwner) {
    return allModulesEnabled();
  }

  const source =
    modulePermissions && typeof modulePermissions === "object"
      ? modulePermissions
      : {};

  return MODULE_KEYS.reduce((acc, key) => {
    acc[key] = source[key] === true;
    return acc;
  }, {});
}

export function hasWorkspaceModuleAccess(perms, moduleKey) {
  if (!moduleKey) return true;
  const modules =
    perms?.modules && typeof perms.modules === "object" ? perms.modules : {};
  return modules[moduleKey] === true;
}

export function getFirstAccessibleWorkspaceRoute(perms) {
  const candidates = [
    ["dashboard", "/dashboard"],
    ["offers", "/offers"],
    ["calendar", "/calendar"],
    ["reports", "/reports"],
    ["settings", "/settings/account"],
    ["products", "/store/products"],
    ["clients", "/store/customers"],
  ];

  const found = candidates.find(([moduleKey]) =>
    hasWorkspaceModuleAccess(perms, moduleKey),
  );

  return found?.[1] || "/dashboard";
}
