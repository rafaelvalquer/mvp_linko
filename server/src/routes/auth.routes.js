//server/src/routes/auth.routes.js
import crypto from "node:crypto";
import { Router } from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { asyncHandler } from "../utils/asyncHandler.js";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { Workspace } from "../models/Workspace.js";
import { PendingRegistration } from "../models/PendingRegistration.js";
import { PasswordResetCode } from "../models/PasswordResetCode.js";
import { authOptional, ensureAuth } from "../middleware/auth.js";
import { sendRegistrationVerificationEmail } from "../services/emailVerification.js";
import { sendForgotPasswordCode } from "../services/resendEmail.js";
import {
  ensureWhatsNewBaseline,
  listWhatsNewForUser,
} from "../services/whatsNew.service.js";
import { isMasterAdminEmail } from "../utils/masterAdmin.js";

const r = Router();

const REGISTER_CODE_LENGTH = 4;
const REGISTER_CODE_TTL_MS = 10 * 60 * 1000;
const REGISTER_RESEND_COOLDOWN_MS = 60 * 1000;
const REGISTER_MAX_ATTEMPTS = 10;

const PASSWORD_RESET_CODE_LENGTH = 4;
const PASSWORD_RESET_CODE_TTL_MS = 10 * 60 * 1000;
const PASSWORD_RESET_RESEND_COOLDOWN_MS = 60 * 1000;
const PASSWORD_RESET_MAX_ATTEMPTS = 10;

r.use(authOptional);

function normalizePlan(v) {
  const p = String(v || "")
    .trim()
    .toLowerCase();
  if (!p) return "start";
  if (p === "start" || p === "pro" || p === "business" || p === "enterprise") {
    return p;
  }
  return "start";
}

function normEmail(v) {
  return String(v || "")
    .trim()
    .toLowerCase();
}

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || ""));
}

function hasMinPasswordLength(v) {
  return String(v || "").length >= 8;
}

function hasSpecialPasswordChar(v) {
  return /[^A-Za-z0-9]/.test(String(v || ""));
}

function validateResetPassword(v) {
  const password = String(v || "");
  return hasMinPasswordLength(password) && hasSpecialPasswordChar(password);
}

function toSlug(v) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

async function uniqueWorkspaceSlug(base) {
  const s0 = toSlug(base);
  if (!s0) return undefined;

  for (let i = 0; i < 10; i += 1) {
    const suffix = crypto.randomBytes(2).toString("hex");
    const s = i === 0 ? s0 : `${s0}-${suffix}`;
    // eslint-disable-next-line no-await-in-loop
    const exists = await Workspace.exists({ slug: s });
    if (!exists) return s;
  }

  return undefined;
}

function signToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      workspaceId: String(user.workspaceId),
      role: user.role,
      isMasterAdmin: isMasterAdminEmail(user.email),
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn || "7d" },
  );
}

function makeCode(length = REGISTER_CODE_LENGTH) {
  return crypto
    .randomInt(0, 10 ** length)
    .toString()
    .padStart(length, "0");
}

function getWorkspaceName(name, workspaceName) {
  const ws = String(workspaceName || "").trim();
  if (ws) return ws;

  const n = String(name || "").trim();
  if (n) return n;

  return "Meu Workspace";
}

function validateRegisterPayload(body = {}) {
  const name = String(body?.name || "").trim();
  const email = normEmail(body?.email);
  const password = String(body?.password || "");
  const workspaceName = getWorkspaceName(name, body?.workspaceName);
  const plan = normalizePlan(body?.plan || "start");

  if (!name) {
    const err = new Error("Nome obrigatório.");
    err.status = 400;
    err.code = "NAME_REQUIRED";
    throw err;
  }

  if (!isValidEmail(email)) {
    const err = new Error("E-mail inválido.");
    err.status = 400;
    err.code = "EMAIL_INVALID";
    throw err;
  }

  if (!password || password.length < 6) {
    const err = new Error("A senha deve ter pelo menos 6 caracteres.");
    err.status = 400;
    err.code = "PASSWORD_TOO_SHORT";
    throw err;
  }

  if (!workspaceName) {
    const err = new Error("Nome do workspace obrigatório.");
    err.status = 400;
    err.code = "WORKSPACE_NAME_REQUIRED";
    throw err;
  }

  return { name, email, password, workspaceName, plan };
}

function buildPendingRegistrationResponse(pending) {
  const lastSentAt = pending?.lastSentAt
    ? new Date(pending.lastSentAt)
    : new Date();
  const canResendAt = new Date(
    lastSentAt.getTime() + REGISTER_RESEND_COOLDOWN_MS,
  );
  const expiresAt = pending?.expiresAt ? new Date(pending.expiresAt) : null;

  return {
    email: String(pending?.email || ""),
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    canResendAt: canResendAt.toISOString(),
    cooldownSeconds: Math.floor(REGISTER_RESEND_COOLDOWN_MS / 1000),
    codeLength: REGISTER_CODE_LENGTH,
  };
}

function buildPasswordResetResponse(resetDoc) {
  const lastSentAt = resetDoc?.lastSentAt
    ? new Date(resetDoc.lastSentAt)
    : new Date();
  const canResendAt = new Date(
    lastSentAt.getTime() + PASSWORD_RESET_RESEND_COOLDOWN_MS,
  );
  const expiresAt = resetDoc?.expiresAt ? new Date(resetDoc.expiresAt) : null;

  return {
    email: String(resetDoc?.email || ""),
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    canResendAt: canResendAt.toISOString(),
    cooldownSeconds: Math.floor(PASSWORD_RESET_RESEND_COOLDOWN_MS / 1000),
    codeLength: PASSWORD_RESET_CODE_LENGTH,
  };
}

function buildWorkspacePayload(ws) {
  if (!ws) return null;

  return {
    _id: ws._id,
    name: ws.name,
    slug: ws.slug,
    plan: normalizePlan(ws.plan),
    planStatus: ws.planStatus || "free",
    subscription: ws.subscription || null,
    payoutPixKeyType: ws.payoutPixKeyType || "",
    payoutPixKeyMasked: ws.payoutPixKeyMasked || "",
    autoPayoutEnabled: !!ws.autoPayoutEnabled,
    payoutHoldMinutes: Number(ws.payoutHoldMinutes ?? 0) || 0,
  };
}

function buildUserPayload(user) {
  if (!user) return null;

  const isMasterAdmin = isMasterAdminEmail(user?.email);
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    workspaceId: user.workspaceId,
    role: user.role,
    status: user.status,
    isMasterAdmin,
    whatsNewLastSeenAt: user.whatsNewLastSeenAt || null,
  };
}

function buildAuthResponse(user, ws) {
  const token = signToken(user);

  return {
    ok: true,
    token,
    user: buildUserPayload(user),
    workspace: buildWorkspacePayload(ws),
  };
}

function sendError(res, status, error, code, extra = {}) {
  return res.status(status).json({ ok: false, error, code, ...extra });
}

async function createPendingRegistration(data) {
  const now = new Date();
  const code = makeCode();
  const expiresAt = new Date(now.getTime() + REGISTER_CODE_TTL_MS);
  const passwordHash = await bcrypt.hash(data.password, 10);

  const pending = await PendingRegistration.findOneAndUpdate(
    { email: data.email },
    {
      $set: {
        name: data.name,
        email: data.email,
        passwordHash,
        workspaceName: data.workspaceName,
        plan: data.plan,
        code,
        expiresAt,
        lastSentAt: now,
        attempts: 0,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    },
  );

  await sendRegistrationVerificationEmail({
    to: data.email,
    name: data.name,
    code,
    expiresAt,
  });

  return pending;
}

async function findUserForPasswordReset(email) {
  const user = await User.findOne({ email }).select(
    "_id name email status passwordHash workspaceId role",
  );

  if (!user) {
    return {
      user: null,
      error: {
        status: 404,
        code: "ACCOUNT_NOT_FOUND",
        message: "Nenhuma conta foi encontrada para este e-mail.",
      },
    };
  }

  if (user.status !== "active") {
    return {
      user: null,
      error: {
        status: 403,
        code: "ACCOUNT_DISABLED",
        message: "Esta conta está indisponível para redefinição de senha.",
      },
    };
  }

  return { user, error: null };
}

async function createPasswordResetCode(user) {
  const now = new Date();
  const code = makeCode(PASSWORD_RESET_CODE_LENGTH);
  const expiresAt = new Date(now.getTime() + PASSWORD_RESET_CODE_TTL_MS);

  const resetDoc = await PasswordResetCode.findOneAndUpdate(
    { email: user.email },
    {
      $set: {
        email: user.email,
        code,
        expiresAt,
        lastSentAt: now,
        attempts: 0,
        usedAt: null,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    },
  );

  await sendForgotPasswordCode({
    to: user.email,
    name: user.name,
    code,
    expiresAt,
  });

  return resetDoc;
}

async function loadPasswordResetByEmail(email) {
  return PasswordResetCode.findOne({ email }).select("+code");
}

function validatePasswordResetRequestPayload(email) {
  if (!isValidEmail(email)) {
    const err = new Error("E-mail inválido.");
    err.status = 400;
    err.code = "EMAIL_INVALID";
    throw err;
  }
}

function ensurePasswordResetCanBeUsed(resetDoc) {
  if (!resetDoc) {
    const err = new Error(
      "Nenhuma solicitação de redefinição foi encontrada para este e-mail.",
    );
    err.status = 404;
    err.code = "NO_PASSWORD_RESET_REQUEST";
    throw err;
  }

  if (resetDoc.usedAt) {
    const err = new Error("Este código já foi utilizado. Solicite um novo.");
    err.status = 410;
    err.code = "CODE_ALREADY_USED";
    throw err;
  }

  if (resetDoc.expiresAt && resetDoc.expiresAt.getTime() <= Date.now()) {
    const err = new Error("O código expirou. Solicite um novo envio.");
    err.status = 410;
    err.code = "CODE_EXPIRED";
    throw err;
  }

  if (Number(resetDoc.attempts || 0) >= PASSWORD_RESET_MAX_ATTEMPTS) {
    const err = new Error(
      "Número máximo de tentativas excedido. Solicite um novo código.",
    );
    err.status = 429;
    err.code = "TOO_MANY_ATTEMPTS";
    throw err;
  }
}

async function assertValidPasswordResetCode({
  email,
  code,
  incrementOnFail = true,
}) {
  const cleanEmail = normEmail(email);
  const cleanCode = String(code || "")
    .replace(/\D+/g, "")
    .slice(0, PASSWORD_RESET_CODE_LENGTH);

  validatePasswordResetRequestPayload(cleanEmail);

  if (cleanCode.length !== PASSWORD_RESET_CODE_LENGTH) {
    const err = new Error("Digite o código de 4 dígitos corretamente.");
    err.status = 400;
    err.code = "CODE_INVALID_FORMAT";
    throw err;
  }

  const resetDoc = await loadPasswordResetByEmail(cleanEmail);
  ensurePasswordResetCanBeUsed(resetDoc);

  if (String(resetDoc.code || "") !== cleanCode) {
    if (incrementOnFail) {
      await PasswordResetCode.updateOne(
        { _id: resetDoc._id },
        { $inc: { attempts: 1 } },
      ).catch(() => {});
    }

    const err = new Error("Código inválido.");
    err.status = 400;
    err.code = "INVALID_CODE";
    throw err;
  }

  return resetDoc;
}

async function handleRegisterRequestCode(req, res) {
  const payload = validateRegisterPayload(req.body);

  const exists = await User.exists({ email: payload.email });
  if (exists) {
    return sendError(res, 409, "Este e-mail já está em uso.", "EMAIL_IN_USE");
  }

  const pending = await createPendingRegistration(payload);

  return res.json({
    ok: true,
    pendingRegistration: buildPendingRegistrationResponse(pending),
  });
}

r.post("/auth/register", asyncHandler(handleRegisterRequestCode));

r.post("/auth/register/request-code", asyncHandler(handleRegisterRequestCode));

r.post(
  "/auth/register/resend-code",
  asyncHandler(async (req, res) => {
    const email = normEmail(req.body?.email);

    if (!isValidEmail(email)) {
      return sendError(res, 400, "E-mail inválido.", "EMAIL_INVALID");
    }

    const exists = await User.exists({ email });
    if (exists) {
      await PendingRegistration.deleteOne({ email }).catch(() => {});
      return sendError(res, 409, "Este e-mail já está em uso.", "EMAIL_IN_USE");
    }

    const pending = await PendingRegistration.findOne({ email }).select(
      "+code +passwordHash",
    );

    if (!pending) {
      return sendError(
        res,
        404,
        "Nenhum cadastro pendente encontrado para este e-mail.",
        "NO_PENDING_REGISTRATION",
      );
    }

    if (pending.expiresAt && pending.expiresAt.getTime() <= Date.now()) {
      await PendingRegistration.deleteOne({ _id: pending._id }).catch(() => {});
      return sendError(
        res,
        410,
        "O código expirou. Solicite um novo cadastro.",
        "CODE_EXPIRED",
      );
    }

    const lastSentAt = pending.lastSentAt ? new Date(pending.lastSentAt) : null;
    const now = Date.now();
    const retryAt = lastSentAt
      ? lastSentAt.getTime() + REGISTER_RESEND_COOLDOWN_MS
      : 0;
    const retryAfterMs = retryAt - now;

    if (retryAfterMs > 0) {
      return sendError(
        res,
        429,
        "Aguarde 1 minuto para reenviar o código.",
        "RESEND_COOLDOWN",
        {
          retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
          canResendAt: new Date(retryAt).toISOString(),
        },
      );
    }

    const code = makeCode();
    const expiresAt = new Date(now + REGISTER_CODE_TTL_MS);

    pending.code = code;
    pending.expiresAt = expiresAt;
    pending.lastSentAt = new Date(now);
    pending.attempts = 0;
    await pending.save();

    await sendRegistrationVerificationEmail({
      to: pending.email,
      name: pending.name,
      code,
      expiresAt,
    });

    return res.json({
      ok: true,
      pendingRegistration: buildPendingRegistrationResponse(pending),
    });
  }),
);

r.post(
  "/auth/register/verify-code",
  asyncHandler(async (req, res) => {
    const email = normEmail(req.body?.email);
    const code = String(req.body?.code || "")
      .replace(/\D+/g, "")
      .slice(0, REGISTER_CODE_LENGTH);

    if (!isValidEmail(email)) {
      return sendError(res, 400, "E-mail inválido.", "EMAIL_INVALID");
    }

    if (code.length !== REGISTER_CODE_LENGTH) {
      return sendError(
        res,
        400,
        "Informe o código de 4 dígitos.",
        "CODE_INVALID_FORMAT",
      );
    }

    const pending = await PendingRegistration.findOne({ email }).select(
      "+code +passwordHash",
    );

    if (!pending) {
      return sendError(
        res,
        404,
        "Nenhum cadastro pendente encontrado para este e-mail.",
        "NO_PENDING_REGISTRATION",
      );
    }

    if (pending.expiresAt && pending.expiresAt.getTime() <= Date.now()) {
      await PendingRegistration.deleteOne({ _id: pending._id }).catch(() => {});
      return sendError(
        res,
        410,
        "O código expirou. Solicite um novo e-mail.",
        "CODE_EXPIRED",
      );
    }

    if (Number(pending.attempts || 0) >= REGISTER_MAX_ATTEMPTS) {
      return sendError(
        res,
        429,
        "Número máximo de tentativas excedido. Solicite um novo código.",
        "TOO_MANY_ATTEMPTS",
      );
    }

    if (String(pending.code || "") !== code) {
      await PendingRegistration.updateOne(
        { _id: pending._id },
        { $inc: { attempts: 1 } },
      ).catch(() => {});

      return sendError(res, 400, "Código inválido.", "INVALID_CODE");
    }

    const exists = await User.exists({ email });
    if (exists) {
      await PendingRegistration.deleteOne({ _id: pending._id }).catch(() => {});
      return sendError(res, 409, "Este e-mail já está em uso.", "EMAIL_IN_USE");
    }

    const session = await mongoose.startSession();
    let userDoc = null;
    let workspaceId = null;

    try {
      await session.withTransaction(async () => {
        const userId = new mongoose.Types.ObjectId();
        workspaceId = new mongoose.Types.ObjectId();
        const wsSlug = await uniqueWorkspaceSlug(pending.workspaceName);

        await Workspace.create(
          [
            {
              _id: workspaceId,
              name: pending.workspaceName,
              slug: wsSlug,
              ownerUserId: userId,
              plan: normalizePlan(pending.plan || "start"),
              planStatus: "free",
              subscription: {
                provider: "stripe",
                status: "inactive",
              },
            },
          ],
          { session },
        );

        const createdUsers = await User.create(
          [
            {
              _id: userId,
              name: pending.name,
              email: pending.email,
              passwordHash: pending.passwordHash,
              workspaceId,
              role: "owner",
              status: "active",
            },
          ],
          { session },
        );

        userDoc = createdUsers?.[0] || null;

        await PendingRegistration.deleteOne({ _id: pending._id }).session(
          session,
        );
      });
    } finally {
      session.endSession();
    }

    const authUser = await ensureWhatsNewBaseline(userDoc?._id);
    const ws = await Workspace.findById(workspaceId).lean();
    return res.json(buildAuthResponse(authUser || userDoc, ws));
  }),
);

r.post(
  "/auth/forgot-password/request-code",
  asyncHandler(async (req, res) => {
    const email = normEmail(req.body?.email);
    validatePasswordResetRequestPayload(email);

    const { user, error } = await findUserForPasswordReset(email);
    if (error) {
      return sendError(res, error.status, error.message, error.code);
    }

    const resetDoc = await createPasswordResetCode(user);

    return res.json({
      ok: true,
      passwordReset: buildPasswordResetResponse(resetDoc),
      message: "Enviamos um código de 4 dígitos para o seu e-mail.",
    });
  }),
);

r.post(
  "/auth/forgot-password/resend-code",
  asyncHandler(async (req, res) => {
    const email = normEmail(req.body?.email);
    validatePasswordResetRequestPayload(email);

    const { user, error } = await findUserForPasswordReset(email);
    if (error) {
      return sendError(res, error.status, error.message, error.code);
    }

    const resetDoc = await loadPasswordResetByEmail(email);
    if (!resetDoc) {
      return sendError(
        res,
        404,
        "Nenhuma solicitação de redefinição foi encontrada para este e-mail.",
        "NO_PASSWORD_RESET_REQUEST",
      );
    }

    if (resetDoc.usedAt) {
      return sendError(
        res,
        410,
        "Este código já foi utilizado. Solicite um novo envio.",
        "CODE_ALREADY_USED",
      );
    }

    const lastSentAt = resetDoc.lastSentAt ? new Date(resetDoc.lastSentAt) : null;
    const now = Date.now();
    const retryAt = lastSentAt
      ? lastSentAt.getTime() + PASSWORD_RESET_RESEND_COOLDOWN_MS
      : 0;
    const retryAfterMs = retryAt - now;

    if (retryAfterMs > 0) {
      return sendError(
        res,
        429,
        "Aguarde 1 minuto para reenviar o código.",
        "RESEND_COOLDOWN",
        {
          retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
          canResendAt: new Date(retryAt).toISOString(),
        },
      );
    }

    const refreshedReset = await createPasswordResetCode(user);

    return res.json({
      ok: true,
      passwordReset: buildPasswordResetResponse(refreshedReset),
      message: "Enviamos um novo código para o seu e-mail.",
    });
  }),
);

r.post(
  "/auth/forgot-password/verify-code",
  asyncHandler(async (req, res) => {
    const email = normEmail(req.body?.email);
    const code = req.body?.code;

    try {
      const resetDoc = await assertValidPasswordResetCode({ email, code });
      return res.json({
        ok: true,
        passwordReset: buildPasswordResetResponse(resetDoc),
        message: "Código validado com sucesso.",
      });
    } catch (err) {
      return sendError(
        res,
        err.status || 400,
        err.message || "Falha ao validar o código.",
        err.code || "PASSWORD_RESET_VERIFY_FAILED",
      );
    }
  }),
);

r.post(
  "/auth/forgot-password/reset-password",
  asyncHandler(async (req, res) => {
    const email = normEmail(req.body?.email);
    const code = req.body?.code;
    const newPassword = String(req.body?.newPassword || "");

    validatePasswordResetRequestPayload(email);

    if (!validateResetPassword(newPassword)) {
      return sendError(
        res,
        400,
        "A nova senha deve ter no mínimo 8 caracteres e pelo menos 1 caractere especial.",
        "PASSWORD_RULES_INVALID",
      );
    }

    try {
      const resetDoc = await assertValidPasswordResetCode({ email, code });
      const { user, error } = await findUserForPasswordReset(email);

      if (error) {
        return sendError(res, error.status, error.message, error.code);
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);

      await User.updateOne({ _id: user._id }, { $set: { passwordHash } });

      await PasswordResetCode.updateOne(
        { _id: resetDoc._id, usedAt: null },
        {
          $set: {
            usedAt: new Date(),
            expiresAt: new Date(),
          },
        },
      ).catch(() => {});

      return res.json({
        ok: true,
        message: "Senha redefinida com sucesso. Faça login com sua nova senha.",
      });
    } catch (err) {
      return sendError(
        res,
        err.status || 400,
        err.message || "Falha ao redefinir a senha.",
        err.code || "PASSWORD_RESET_FAILED",
      );
    }
  }),
);

r.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
    const email = normEmail(req.body?.email);
    const password = String(req.body?.password || "");
    if (!email)
      return res.status(400).json({ ok: false, error: "email required" });
    if (!password)
      return res.status(400).json({ ok: false, error: "password required" });

    const user = await User.findOne({ email });
    if (!user || user.status !== "active")
      return res.status(401).json({ ok: false, error: "invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok)
      return res.status(401).json({ ok: false, error: "invalid credentials" });

    const authUser = await ensureWhatsNewBaseline(user._id);
    const ws = await Workspace.findById(user.workspaceId).lean();
    return res.json(buildAuthResponse(authUser || user, ws));
  }),
);

r.get(
  "/auth/me",
  ensureAuth,
  asyncHandler(async (req, res) => {
    const authUser = await ensureWhatsNewBaseline(req.user._id);
    const ws = await Workspace.findById(req.user.workspaceId).lean();

    return res.json({
      ok: true,
      user: buildUserPayload(authUser || req.user),
      workspace: buildWorkspacePayload(ws),
    });
  }),
);

r.get(
  "/auth/whats-new",
  ensureAuth,
  asyncHandler(async (req, res) => {
    const authUser = await ensureWhatsNewBaseline(req.user._id);
    const snapshotAt = new Date();
    const payload = await listWhatsNewForUser({
      user: authUser || req.user,
      snapshotAt,
    });

    return res.json({
      ok: true,
      snapshotAt: payload.snapshotAt,
      items: payload.items,
    });
  }),
);

r.post(
  "/auth/whats-new/ack",
  ensureAuth,
  asyncHandler(async (req, res) => {
    const seenAt = new Date(req.body?.seenAt);
    if (Number.isNaN(seenAt.getTime())) {
      return sendError(
        res,
        400,
        "Data de leitura invalida.",
        "INVALID_SEEN_AT",
      );
    }

    await User.updateOne(
      {
        _id: req.user._id,
        $or: [
          { whatsNewLastSeenAt: { $exists: false } },
          { whatsNewLastSeenAt: null },
          { whatsNewLastSeenAt: { $lt: seenAt } },
        ],
      },
      {
        $set: {
          whatsNewLastSeenAt: seenAt,
        },
      },
    );

    const freshUser = await User.findById(req.user._id)
      .select("whatsNewLastSeenAt")
      .lean();

    return res.json({
      ok: true,
      whatsNewLastSeenAt: freshUser?.whatsNewLastSeenAt || seenAt.toISOString(),
    });
  }),
);

export default r;
