//src/app/authApi.js

import { api } from "./api.js";

export function login({ email, password }) {
  return api("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function register({
  name,
  email,
  password,
  workspaceName,
  plan,
  pixMonthlyLimit, // opcional (enterprise)
}) {
  return api("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      name,
      email,
      password,
      workspaceName,
      plan,
      ...(Number.isFinite(pixMonthlyLimit) ? { pixMonthlyLimit } : {}),
    }),
  });
}

export function me() {
  return api("/auth/me");
}
