// server/src/services/wallet.service.js
import mongoose from "mongoose";
import { Workspace } from "../models/Workspace.js";
import PixDebit from "../models/PixDebit.js";

function isDupKey(err) {
  return (
    err?.code === 11000 ||
    String(err?.message || "").includes("E11000 duplicate key error") ||
    String(err?.message || "").includes("E11000")
  );
}

/**
 * Crédito de wallet idempotente e rápido (sem transaction).
 * Fluxo:
 * 1) cria PixDebit com key única (idempotência)
 * 2) se criou, faz $inc no Workspace
 * 3) se duplicado, retorna skipped
 * 4) se falhar o $inc, remove o PixDebit (best-effort) para permitir retry
 */
export async function creditWalletOnPaid({
  workspaceId,
  offerId = null,
  paymentId,
  amountCents,
  meta = {},
}) {
  const wsIdStr = String(workspaceId || "").trim();
  const payId = String(paymentId || "").trim();
  const amt = Math.round(Number(amountCents || 0));

  if (!wsIdStr || !mongoose.isValidObjectId(wsIdStr)) {
    return { ok: false, skipped: true, reason: "invalid_workspaceId" };
  }
  if (!payId) return { ok: false, skipped: true, reason: "missing_paymentId" };
  if (!Number.isFinite(amt) || amt <= 0) {
    return { ok: false, skipped: true, reason: "invalid_amount" };
  }

  const key = `credit:paid:${payId}`;

  // 1) ledger idempotente
  try {
    await PixDebit.create({
      workspaceId: wsIdStr,
      offerId:
        offerId && mongoose.isValidObjectId(String(offerId))
          ? String(offerId)
          : null,
      paymentId: payId,
      key,
      kind: "WALLET_CREDIT",
      amountCents: amt,
      status: "APPLIED",
      reason: "pix_paid",
      meta: { ...(meta || {}) },
    });
  } catch (e) {
    if (isDupKey(e)) return { ok: true, skipped: true, key };
    return { ok: false, error: e?.message || String(e), key };
  }

  // 2) aplica crédito (atômico)
  try {
    const r = await Workspace.updateOne(
      { _id: wsIdStr },
      { $inc: { walletAvailableCents: amt } },
    );

    if (!r?.matchedCount) {
      // rollback best-effort do ledger para permitir retry
      await PixDebit.deleteOne({ workspaceId: wsIdStr, key }).catch(() => {});
      return {
        ok: false,
        error: "Workspace não encontrado para crédito.",
        key,
      };
    }

    return { ok: true, credited: true, key };
  } catch (e) {
    // rollback best-effort do ledger para permitir retry
    await PixDebit.deleteOne({ workspaceId: wsIdStr, key }).catch(() => {});
    return { ok: false, error: e?.message || String(e), key };
  }
}
