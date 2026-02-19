//server/src/routes/auth.routes.js

import { Router } from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { asyncHandler } from "../utils/asyncHandler.js";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { Workspace } from "../models/Workspace.js";
import { authOptional, ensureAuth } from "../middleware/auth.js";

import {
  normalizePlan,
  limitForPlan,
  cycleKeySP,
  ensureWorkspaceCycle,
  summarizeWorkspaceQuota,
  ensurePixMonthlyLimit,
} from "../utils/pixQuota.js";

const r = Router();

// ✅ popula req.user quando houver Bearer token (necessário para /auth/me)
r.use(authOptional);

function normEmail(v) {
  return String(v || "")
    .trim()
    .toLowerCase();
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
  for (let i = 0; i < 10; i++) {
    const s = i === 0 ? s0 : `${s0}-${Math.random().toString(16).slice(2, 6)}`;
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

r.post(
  "/auth/register",
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name || "").trim();
    const email = normEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const workspaceName =
      String(req.body?.workspaceName || "").trim() ||
      (name ? `${name}` : "Meu Workspace");

    // ✅ novo plano (com compat)
    const plan = normalizePlan(req.body?.plan);

    // enterprise pode mandar limite configurável (>0)
    const enterpriseLimit = Number(req.body?.pixMonthlyLimit);
    const pixMonthlyLimit = limitForPlan(plan, enterpriseLimit);

    if (!email)
      return res.status(400).json({ ok: false, error: "email required" });
    if (!password || password.length < 6)
      return res.status(400).json({ ok: false, error: "password min 6 chars" });

    if (plan === "enterprise") {
      if (!Number.isFinite(pixMonthlyLimit) || pixMonthlyLimit <= 0) {
        return res.status(400).json({
          ok: false,
          error: "enterprise requer pixMonthlyLimit > 0",
        });
      }
    }

    const exists = await User.exists({ email });
    if (exists)
      return res.status(409).json({ ok: false, error: "email already in use" });

    const session = await mongoose.startSession();
    let userDoc;
    let wsSlug;
    let workspaceId;

    await session.withTransaction(async () => {
      const userId = new mongoose.Types.ObjectId();
      workspaceId = new mongoose.Types.ObjectId();

      const passwordHash = await bcrypt.hash(password, 10);
      wsSlug = await uniqueWorkspaceSlug(workspaceName);

      await Workspace.create(
        [
          {
            _id: workspaceId,
            name: workspaceName,
            slug: wsSlug,
            ownerUserId: userId,
            plan,
            pixMonthlyLimit,
            pixUsage: { cycleKey: cycleKeySP(), used: 0 },
          },
        ],
        { session },
      );

      const createdUsers = await User.create(
        [
          {
            _id: userId,
            name,
            email,
            passwordHash,
            workspaceId,
            role: "owner",
            status: "active",
          },
        ],
        { session },
      );

      userDoc = createdUsers?.[0];
    });

    session.endSession();

    const ws = await Workspace.findById(workspaceId).lean();
    const quota = ws ? summarizeWorkspaceQuota(ws) : null;

    const token = signToken(userDoc);
    return res.json({
      ok: true,
      token,
      user: {
        _id: userDoc._id,
        name: userDoc.name,
        email: userDoc.email,
        workspaceId: userDoc.workspaceId,
        role: userDoc.role,
        status: userDoc.status,
      },
      workspace: ws
        ? {
            _id: ws._id,
            name: ws.name,
            slug: ws.slug,
            plan: normalizePlan(ws.plan),
            pixMonthlyLimit: quota?.limit ?? ws.pixMonthlyLimit,
            cycleKey: quota?.cycleKey ?? "",
            pixUsedThisCycle: quota?.used ?? 0,
            pixRemaining: quota?.remaining ?? 0,
          }
        : null,
    });
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

    // ✅ garante ciclo correto e limite preenchido
    await ensureWorkspaceCycle(user.workspaceId);
    await ensurePixMonthlyLimit(user.workspaceId);

    const ws = await Workspace.findById(user.workspaceId).lean();
    const quota = ws ? summarizeWorkspaceQuota(ws) : null;

    const token = signToken(user);
    return res.json({
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
            pixMonthlyLimit: quota?.limit ?? ws.pixMonthlyLimit,
            cycleKey: quota?.cycleKey ?? "",
            pixUsedThisCycle: quota?.used ?? 0,
            pixRemaining: quota?.remaining ?? 0,
          }
        : null,
    });
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
            pixMonthlyLimit: quota?.limit ?? ws.pixMonthlyLimit,
            cycleKey: quota?.cycleKey ?? "",
            pixUsedThisCycle: quota?.used ?? 0,
            pixRemaining: quota?.remaining ?? 0,
          }
        : null,
    });
  }),
);

export default r;
