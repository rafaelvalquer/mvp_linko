//src/app/authApi.js

import { api } from "./api.js";

export function login({ email, password }) {
  return api("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function register({ name, email, password, workspaceName }) {
  return api("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password, workspaceName }),
  });
}

export function me() {
  return api("/auth/me");
}
