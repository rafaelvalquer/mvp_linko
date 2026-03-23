const baseUrl = String(process.env.WA_SMOKE_BASE_URL || "http://127.0.0.1:3010").replace(
  /\/+$/g,
  "",
);
const adminKey =
  process.env.WA_SMOKE_ADMIN_KEY ||
  process.env.WA_ADMIN_API_KEY ||
  process.env.WA_API_KEY ||
  "";

async function hit(pathname, { requiresAuth = false } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: requiresAuth && adminKey ? { "x-api-key": adminKey } : {},
  });

  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  return {
    ok: response.ok,
    status: response.status,
    pathname,
    body,
  };
}

async function main() {
  const checks = [
    await hit("/health"),
    await hit("/status", { requiresAuth: true }),
    await hit("/events/recent", { requiresAuth: true }),
  ];

  for (const check of checks) {
    console.log(`\n[${check.pathname}] HTTP ${check.status}`);
    console.log(
      typeof check.body === "string"
        ? check.body
        : JSON.stringify(check.body, null, 2),
    );
  }
}

main().catch((error) => {
  console.error(error?.message || String(error));
  process.exitCode = 1;
});
