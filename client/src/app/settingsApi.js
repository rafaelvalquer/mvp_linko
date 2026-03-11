import { api } from "./api.js";

export function getSettings() {
  return api("/settings");
}

export function updateAgendaSettings(agenda) {
  return api("/settings/agenda", {
    method: "PATCH",
    body: JSON.stringify({ agenda }),
  });
}

export function updateNotificationSettings(notifications) {
  return api("/settings/notifications", {
    method: "PATCH",
    body: JSON.stringify({ notifications }),
  });
}
