import fs from "fs";
import path from "path";

import { getStripe } from "../stripeClient.js";
import { isMasterAdminEmail } from "../../utils/masterAdmin.js";
import { absPaymentProofPath } from "../storageLocal.js";
import { Workspace } from "../../models/Workspace.js";
import { User } from "../../models/User.js";
import { AppSettings } from "../../models/AppSettings.js";
import { Client } from "../../models/Client.js";
import { Product } from "../../models/Product.js";
import { Offer } from "../../models/Offer.js";
import { RecurringOffer } from "../../models/RecurringOffer.js";
import Booking from "../../models/Booking.js";
import { MyPage } from "../../models/MyPage.js";
import { MyPageClick } from "../../models/MyPageClick.js";
import { MyPageQuoteRequest } from "../../models/MyPageQuoteRequest.js";
import { UserAutomation } from "../../models/UserAutomation.js";
import { WhatsAppOutbox } from "../../models/WhatsAppOutbox.js";
import { MessageLog } from "../../models/MessageLog.js";
import { WhatsAppCommandSession } from "../../models/WhatsAppCommandSession.js";
import OfferReminderLog from "../../models/OfferReminderLog.js";
import { WebAgentMessage } from "../../models/WebAgentMessage.js";
import { PasswordResetCode } from "../../models/PasswordResetCode.js";
import { PendingRegistration } from "../../models/PendingRegistration.js";

const MY_PAGE_UPLOAD_DIR = path.resolve(process.cwd(), "uploads", "my-page");
const PRODUCT_UPLOAD_DIR = path.resolve(process.cwd(), "uploads", "products");

function buildError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
}

function buildOrQuery(clauses = []) {
  const validClauses = clauses.filter(Boolean);
  if (!validClauses.length) return null;
  if (validClauses.length === 1) return validClauses[0];
  return { $or: validClauses };
}

function cleanPublicPath(value) {
  return String(value || "").trim().split("?")[0].split("#")[0];
}

function resolveUploadPathFromUrl(value, prefix, absDir) {
  const cleanValue = cleanPublicPath(value);
  if (!cleanValue || !cleanValue.startsWith(prefix)) return null;

  const filename = path.basename(cleanValue.slice(prefix.length));
  if (!filename) return null;

  return path.join(absDir, filename);
}

function addIfPresent(targetSet, value) {
  if (value) targetSet.add(value);
}

function isStripeIgnorableError(error) {
  const code = String(error?.code || "").trim().toLowerCase();
  const message = String(error?.message || "").trim().toLowerCase();

  if (code === "resource_missing") return true;
  if (message.includes("already canceled")) return true;
  if (message.includes("already cancelled")) return true;
  if (message.includes("no such subscription")) return true;
  if (message.includes("no such subscription_schedule")) return true;
  if (message.includes("cannot be canceled because")) return true;
  if (message.includes("cannot be cancelled because")) return true;
  return false;
}

async function cancelStripeArtifacts(workspace) {
  const scheduleId = String(workspace?.subscription?.scheduleId || "").trim();
  const subscriptionId = String(
    workspace?.subscription?.stripeSubscriptionId || "",
  ).trim();

  if (!scheduleId && !subscriptionId) {
    return {
      attempted: false,
      scheduleCancelled: false,
      subscriptionCancelled: false,
    };
  }

  const stripe = getStripe();
  const result = {
    attempted: true,
    scheduleCancelled: false,
    subscriptionCancelled: false,
  };

  if (scheduleId) {
    try {
      await stripe.subscriptionSchedules.cancel(scheduleId);
      result.scheduleCancelled = true;
    } catch (error) {
      if (!isStripeIgnorableError(error)) {
        throw buildError(
          "Nao foi possivel cancelar a assinatura Stripe antes da exclusao da conta.",
          409,
          "stripe_subscription_cancel_failed",
        );
      }
    }
  }

  if (subscriptionId) {
    try {
      await stripe.subscriptions.cancel(subscriptionId);
      result.subscriptionCancelled = true;
    } catch (error) {
      if (!isStripeIgnorableError(error)) {
        throw buildError(
          "Nao foi possivel cancelar a assinatura Stripe antes da exclusao da conta.",
          409,
          "stripe_subscription_cancel_failed",
        );
      }
    }
  }

  return result;
}

async function removeFiles(filePaths = []) {
  const summary = {
    attempted: filePaths.length,
    removed: 0,
    missing: 0,
    failed: 0,
  };

  for (const filePath of filePaths) {
    try {
      await fs.promises.unlink(filePath);
      summary.removed += 1;
    } catch (error) {
      if (error?.code === "ENOENT") {
        summary.missing += 1;
        continue;
      }

      summary.failed += 1;
      console.warn("[admin-delete-workspace-account] file_cleanup_failed", {
        filePath,
        message: error?.message || "unlink_failed",
      });
    }
  }

  return summary;
}

async function loadWorkspaceDeletionContext(workspaceId) {
  const workspace = await Workspace.findById(workspaceId)
    .select("_id name slug ownerUserId subscription")
    .lean();

  if (!workspace) return null;

  const [owner, users, myPages, products] = await Promise.all([
    User.findById(workspace.ownerUserId).select("_id name email").lean(),
    User.find({ workspaceId }).select("_id email").lean(),
    MyPage.find({ workspaceId }).select("_id avatarUrl").lean(),
    Product.find({ workspaceId }).select("_id imageUrl").lean(),
  ]);

  if (owner?.email && isMasterAdminEmail(owner.email)) {
    throw buildError(
      "Nao e permitido excluir uma conta cujo owner e master admin.",
      409,
      "workspace_owner_master_admin",
    );
  }

  const userIds = users.map((item) => item._id);
  const userEmails = users
    .map((item) => String(item?.email || "").trim().toLowerCase())
    .filter(Boolean);

  const [offers, sessions] = await Promise.all([
    Offer.find(
      buildOrQuery([
        { workspaceId },
        userIds.length ? { ownerUserId: { $in: userIds } } : null,
      ]),
    )
      .select("_id paymentProof")
      .lean(),
    WhatsAppCommandSession.find(
      buildOrQuery([
        { workspaceId },
        userIds.length ? { userId: { $in: userIds } } : null,
      ]),
    )
      .select("_id")
      .lean(),
  ]);

  const myPageIds = myPages.map((item) => item._id);
  const offerIds = offers.map((item) => item._id);
  const sessionIds = sessions.map((item) => item._id);

  const filePaths = new Set();

  for (const page of myPages) {
    addIfPresent(
      filePaths,
      resolveUploadPathFromUrl(
        page?.avatarUrl,
        "/uploads/my-page/",
        MY_PAGE_UPLOAD_DIR,
      ),
    );
  }

  for (const product of products) {
    addIfPresent(
      filePaths,
      resolveUploadPathFromUrl(
        product?.imageUrl,
        "/uploads/products/",
        PRODUCT_UPLOAD_DIR,
      ),
    );
  }

  for (const offer of offers) {
    const proof = offer?.paymentProof || null;
    if (proof?.storage?.provider !== "local") continue;
    const key = String(proof?.storage?.key || "").trim();
    if (!key) continue;

    try {
      addIfPresent(filePaths, absPaymentProofPath(key));
    } catch (error) {
      console.warn("[admin-delete-workspace-account] invalid_payment_proof_key", {
        workspaceId: String(workspaceId),
        key,
        message: error?.message || "invalid_payment_proof_key",
      });
    }
  }

  return {
    workspace,
    owner,
    userIds,
    userEmails,
    myPageIds,
    offerIds,
    sessionIds,
    filePaths: Array.from(filePaths),
  };
}

async function deleteManyWithCount(Model, query) {
  if (!query) return 0;
  const result = await Model.deleteMany(query);
  return Number(result?.deletedCount || 0);
}

export async function deleteWorkspaceAccountForAdmin(workspaceId) {
  const context = await loadWorkspaceDeletionContext(workspaceId);
  if (!context) return null;

  const {
    workspace,
    userIds,
    userEmails,
    myPageIds,
    offerIds,
    sessionIds,
    filePaths,
  } = context;

  const billingCleanup = await cancelStripeArtifacts(workspace);

  const deletedCounts = {};

  deletedCounts.webAgentMessages = await deleteManyWithCount(
    WebAgentMessage,
    buildOrQuery([
      { workspaceId },
      userIds.length ? { userId: { $in: userIds } } : null,
      sessionIds.length ? { sessionId: { $in: sessionIds } } : null,
    ]),
  );

  deletedCounts.whatsAppCommandSessions = await deleteManyWithCount(
    WhatsAppCommandSession,
    buildOrQuery([
      { workspaceId },
      userIds.length ? { userId: { $in: userIds } } : null,
    ]),
  );

  deletedCounts.myPageClicks = await deleteManyWithCount(
    MyPageClick,
    buildOrQuery([
      { workspaceId },
      myPageIds.length ? { pageId: { $in: myPageIds } } : null,
      userIds.length ? { ownerUserId: { $in: userIds } } : null,
    ]),
  );

  deletedCounts.myPageQuoteRequests = await deleteManyWithCount(
    MyPageQuoteRequest,
    buildOrQuery([
      { workspaceId },
      myPageIds.length ? { pageId: { $in: myPageIds } } : null,
      userIds.length ? { ownerUserId: { $in: userIds } } : null,
      offerIds.length ? { createdOfferId: { $in: offerIds } } : null,
    ]),
  );

  deletedCounts.messageLogs = await deleteManyWithCount(
    MessageLog,
    buildOrQuery([
      { workspaceId },
      offerIds.length ? { offerId: { $in: offerIds } } : null,
    ]),
  );

  deletedCounts.offerReminderLogs = await deleteManyWithCount(
    OfferReminderLog,
    buildOrQuery([
      { workspaceId },
      offerIds.length ? { offerId: { $in: offerIds } } : null,
    ]),
  );

  deletedCounts.whatsAppOutbox = await deleteManyWithCount(
    WhatsAppOutbox,
    { workspaceId },
  );

  deletedCounts.userAutomations = await deleteManyWithCount(
    UserAutomation,
    buildOrQuery([
      { workspaceId },
      userIds.length ? { userId: { $in: userIds } } : null,
    ]),
  );

  deletedCounts.bookings = await deleteManyWithCount(
    Booking,
    buildOrQuery([
      { workspaceId },
      offerIds.length ? { offerId: { $in: offerIds } } : null,
      myPageIds.length ? { myPageId: { $in: myPageIds } } : null,
      userIds.length ? { ownerUserId: { $in: userIds } } : null,
    ]),
  );

  deletedCounts.recurringOffers = await deleteManyWithCount(
    RecurringOffer,
    { workspaceId },
  );

  deletedCounts.offers = await deleteManyWithCount(
    Offer,
    buildOrQuery([
      { workspaceId },
      userIds.length ? { ownerUserId: { $in: userIds } } : null,
    ]),
  );

  deletedCounts.products = await deleteManyWithCount(Product, { workspaceId });
  deletedCounts.clients = await deleteManyWithCount(Client, { workspaceId });
  deletedCounts.appSettings = await deleteManyWithCount(AppSettings, { workspaceId });
  deletedCounts.myPages = await deleteManyWithCount(MyPage, { workspaceId });

  deletedCounts.passwordResetCodes = userEmails.length
    ? await deleteManyWithCount(PasswordResetCode, {
        email: { $in: userEmails },
      })
    : 0;

  deletedCounts.pendingRegistrations = userEmails.length
    ? await deleteManyWithCount(PendingRegistration, {
        email: { $in: userEmails },
      })
    : 0;

  deletedCounts.users = await deleteManyWithCount(User, { workspaceId });

  const workspaceDeleteResult = await Workspace.deleteOne({ _id: workspaceId });
  deletedCounts.workspaces = Number(workspaceDeleteResult?.deletedCount || 0);

  const fileCleanup = await removeFiles(filePaths);

  return {
    workspaceId: String(workspace._id),
    slug: workspace.slug || "",
    name: workspace.name || "",
    deletedCounts,
    billingCleanup,
    fileCleanup,
  };
}
