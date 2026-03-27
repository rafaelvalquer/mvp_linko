import { api } from "./api.js";

export async function getUserAutomationsDashboard() {
  return api("/automations");
}

export async function createUserAutomation(input) {
  return api("/automations", {
    method: "POST",
    body: JSON.stringify(input || {}),
  });
}

export async function pauseUserAutomation(id) {
  return api(`/automations/${id}/pause`, {
    method: "POST",
  });
}

export async function resumeUserAutomation(id) {
  return api(`/automations/${id}/resume`, {
    method: "POST",
  });
}

export async function runUserAutomationNow(id) {
  return api(`/automations/${id}/run-now`, {
    method: "POST",
  });
}

export async function duplicateUserAutomation(id) {
  return api(`/automations/${id}/duplicate`, {
    method: "POST",
  });
}

export async function deleteUserAutomation(id) {
  return api(`/automations/${id}`, {
    method: "DELETE",
  });
}
