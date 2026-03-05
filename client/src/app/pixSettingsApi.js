// src/app/pixSettingsApi.js
import { api } from "./api.js";

// Reaproveita endpoints existentes do backend (withdraw/payout-settings)
export function getPixSettings() {
  return api("/withdraw/payout-settings");
}

export function updatePixSettings({ payoutPixKeyType, payoutPixKey }) {
  return api("/withdraw/payout-settings", {
    method: "PUT",
    body: JSON.stringify({ payoutPixKeyType, payoutPixKey }),
  });
}
