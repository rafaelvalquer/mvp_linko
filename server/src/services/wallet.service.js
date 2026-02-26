// server/src/services/wallet.service.js
import mongoose from "mongoose";
import { Workspace } from "../models/Workspace.js";
import PixDebit from "../models/PixDebit.js";

function isDupKey(err) {
  return (
    err?.code === 11000 ||
    String(err?.message || "").includes("E11000 duplicate key error")
  );
}

function isTransientTxnError(err) {
  return (
    err?.code === 251 ||
    (Array.isArray(err?.errorLabels) &&
      err.errorLabels.includes("TransientTransactionError")) ||
    String(err?.message || "").includes("has been aborted")
  );
}

function isTransactionNotSupported(err) {
  const msg = String(err?.message || "");
  return (
    msg.includes("Transaction numbers are only allowed") ||
    msg.includes("replica set member") ||
    msg.includes("not supported by this deployment")
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Credita walletAvailableCents quando um pagamento for confirmado (Pix PAID).
 *
 * - Idempotente por paymentId (key = credit:paid:${paymentId})
 * - Transação (PixDebit + $inc no Workspace) com retry de erro transitório
 * - Fallback sem transação apenas quando o Mongo não suporta transações
 */
export async function creditWalletOnPaid({
  workspaceId,
  offerId = null,
  paymentId,
  amountCents,
  meta = {},
  txnRetries = 2,
} = {}) {
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

  const wsObjId = new mongoose.Types.ObjectId(wsIdStr);
  const offerObjId =
    offerId && mongoose.isValidObjectId(String(offerId))
      ? new mongoose.Types.ObjectId(String(offerId))
      : null;

  const key = `credit:paid:${payId}`;

  const debitDoc = {
    workspaceId: wsObjId,
    offerId: offerObjId,
    paymentId: payId,
    eventId: payId, // compat
    key,
    kind: "WALLET_CREDIT",
    amountCents: amt,
    status: "APPLIED",
    reason: "pix_paid",
    meta: { ...(meta || {}) },
  };

  // =========================
  // 1) Transaction + retry
  // =========================
  for (let attempt = 0; attempt <= txnRetries; attempt++) {
    const session = await mongoose.startSession();
    try {
      let skipped = false;

      await session.withTransaction(
        async () => {
          // ledger idempotente
          try {
            await PixDebit.create([debitDoc], { session });
          } catch (e) {
            if (isDupKey(e)) {
              skipped = true;
              return;
            }
            throw e;
          }

          const upd = await Workspace.updateOne(
            { _id: wsObjId },
            { $inc: { walletAvailableCents: amt } },
            { session, strict: false },
          );

          if ((upd?.matchedCount || 0) !== 1) {
            const err = new Error("Workspace não encontrado para crédito.");
            err.code = "WS_NOT_FOUND";
            throw err;
          }
        },
        {
          readPreference: "primary",
          readConcern: { level: "snapshot" },
          writeConcern: { w: "majority" },
          maxCommitTimeMS: 5000,
        },
      );

      if (skipped) return { ok: true, skipped: true, key };
      return { ok: true, credited: true, key };
    } catch (err) {
      if (isDupKey(err)) return { ok: true, skipped: true, key };

      // sem suporte a transação -> fallback
      if (isTransactionNotSupported(err)) break;

      // erro transitório: retry
      if (isTransientTxnError(err) && attempt < txnRetries) {
        await sleep(150 * (attempt + 1));
        continue;
      }

      return { ok: false, error: err?.message || String(err), key };
    } finally {
      session.endSession().catch(() => {});
    }
  }

  // =========================
  // 2) Fallback sem transaction
  // =========================
  try {
    try {
      await PixDebit.create(debitDoc);
    } catch (e) {
      if (isDupKey(e)) return { ok: true, skipped: true, key };
      return { ok: false, error: e?.message || String(e), key };
    }

    const upd = await Workspace.updateOne(
      { _id: wsObjId },
      { $inc: { walletAvailableCents: amt } },
      { strict: false },
    );

    if ((upd?.matchedCount || 0) !== 1) {
      // reverte ledger (permite retry)
      await PixDebit.deleteOne({ workspaceId: wsObjId, key }).catch(() => {});
      return {
        ok: false,
        error: "Workspace não encontrado para crédito.",
        key,
      };
    }

    return { ok: true, credited: true, key };
  } catch (e) {
    // reverte ledger em erro desconhecido
    await PixDebit.deleteOne({ workspaceId: wsObjId, key }).catch(() => {});
    return { ok: false, error: e?.message || String(e), key };
  }
}
