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
import { authOptional, ensureAuth } from "../middleware/auth.js";
import { sendRegistrationVerificationEmail } from "../services/emailVerification.js";
import {
  normalizePlan,
  ensureWorkspaceCycle,
  summarizeWorkspaceQuota,
  ensurePixMonthlyLimit,
} from "../utils/pixQuota.js";

const r = Router();

const REGISTER_CODE_LENGTH = 4;
const REGISTER_CODE_TTL_MS = 10 * 60 * 1000;
const REGISTER_RESEND_COOLDOWN_MS = 60 * 1000;
const REGISTER_MAX_ATTEMPTS = 10;

r.use(authOptional);

function normEmail(v) {
  return String(v || "")
    .trim()
    .toLowerCase();
}

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || ""));
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
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn || "7d" },
  );
}

function makeCode() {
  return crypto
    .randomInt(0, 10 ** REGISTER_CODE_LENGTH)
    .toString()
    .padStart(REGISTER_CODE_LENGTH, "0");
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

function buildAuthResponse(user, ws) {
  const quota = ws ? summarizeWorkspaceQuota(ws) : null;
  const token = signToken(user);

  return {
    ok: true,
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      workspaceId: user.workspaceId,
      role: user.role,
      status: user.status,
    },
    workspace: ws
      ? {
          _id: ws._id,
          name: ws.name,
          slug: ws.slug,
          plan: normalizePlan(ws.plan),
          planStatus: ws.planStatus || "free",
          subscription: ws.subscription || null,
          pixMonthlyLimit: quota?.limit ?? ws.pixMonthlyLimit,
          cycleKey: quota?.cycleKey ?? "",
          pixUsedThisCycle: quota?.used ?? 0,
          pixRemaining: quota?.remaining ?? 0,
          payoutPixKeyType: ws.payoutPixKeyType || "",
          payoutPixKeyMasked: ws.payoutPixKeyMasked || "",
          autoPayoutEnabled: !!ws.autoPayoutEnabled,
          payoutHoldMinutes: Number(ws.payoutHoldMinutes ?? 0) || 0,
        }
      : null,
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
              pixMonthlyLimit: 0,
              pixUsage: { cycleKey: "", used: 0 },
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

    const ws = await Workspace.findById(workspaceId).lean();
    return res.json(buildAuthResponse(userDoc, ws));
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

    await ensureWorkspaceCycle(user.workspaceId);
    await ensurePixMonthlyLimit(user.workspaceId);

    const ws = await Workspace.findById(user.workspaceId).lean();
    return res.json(buildAuthResponse(user, ws));
  }),
);

r.get(
  "/auth/me",
  ensureAuth,
  asyncHandler(async (req, res) => {
    await ensureWorkspaceCycle(req.user.workspaceId);
    await ensurePixMonthlyLimit(req.user.workspaceId);

    const ws = await Workspace.findById(req.user.workspaceId).lean();
    const quota = ws ? summarizeWorkspaceQuota(ws) : null;

    return res.json({
      ok: true,
      user: {
        _id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        workspaceId: req.user.workspaceId,
        role: req.user.role,
        status: req.user.status,
      },
      workspace: ws
        ? {
            _id: ws._id,
            name: ws.name,
            slug: ws.slug,
            plan: normalizePlan(ws.plan),
            planStatus: ws.planStatus || "free",
            subscription: ws.subscription || null,
            pixMonthlyLimit: quota?.limit ?? ws.pixMonthlyLimit,
            cycleKey: quota?.cycleKey ?? "",
            pixUsedThisCycle: quota?.used ?? 0,
            pixRemaining: quota?.remaining ?? 0,
            payoutPixKeyType: ws.payoutPixKeyType || "",
            payoutPixKeyMasked: ws.payoutPixKeyMasked || "",
            autoPayoutEnabled: !!ws.autoPayoutEnabled,
            payoutHoldMinutes: Number(ws.payoutHoldMinutes ?? 0) || 0,
          }
        : null,
    });
  }),
);

export default r;
