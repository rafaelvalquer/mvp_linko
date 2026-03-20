// server/src/routes/clients.routes.js
import { Router } from "express";
import crypto from "crypto";
import mongoose from "mongoose";

import { ensureAuth, tenantFromUser } from "../middleware/auth.js";
import { Client } from "../models/Client.js";
import { createClientForWorkspace } from "../services/clients/createClient.service.js";

const r = Router();

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function onlyDigits(v) {
  return String(v || "").replace(/\D+/g, "");
}

function makeClientId() {
  // curto, legível e com baixa chance de colisão
  return `cli_${crypto.randomBytes(6).toString("hex")}`;
}

// LIST / SEARCH
r.get("/clients", ensureAuth, tenantFromUser, async (req, res) => {
  try {
    const qRaw = String(req.query.q || "").trim();
    const qDigits = onlyDigits(qRaw);
    const filter = { workspaceId: req.tenantId };

    if (qRaw) {
      const rx = new RegExp(escapeRegex(qRaw), "i");
      const ors = [{ fullName: rx }, { email: rx }, { clientId: rx }];

      if (qDigits) {
        const rxd = new RegExp(escapeRegex(qDigits), "i");
        ors.push({ cpfCnpjDigits: rxd }, { phoneDigits: rxd });
      }

      filter.$or = ors;
    }

    const items = await Client.find(filter)
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    return res.json({ ok: true, items });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, error: e?.message || "Falha ao listar clientes." });
  }
});

// DETAIL
r.get("/clients/:id", ensureAuth, tenantFromUser, async (req, res) => {
  try {
    const id = String(req.params.id || "");
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, error: "ID inválido." });
    }

    const doc = await Client.findOne({
      _id: id,
      workspaceId: req.tenantId,
    }).lean();
    if (!doc) {
      return res
        .status(404)
        .json({ ok: false, error: "Cliente não encontrado." });
    }

    return res.json({ ok: true, client: doc });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, error: e?.message || "Falha ao buscar cliente." });
  }
});

// CREATE
r.post("/clients", ensureAuth, tenantFromUser, async (req, res) => {
  try {
    const fullName = String(req.body?.fullName || "").trim();
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const cpfCnpj = String(req.body?.cpfCnpj || "").trim();
    const phone = String(req.body?.phone || "").trim();

    if (!fullName)
      return res.status(400).json({ ok: false, error: "fullName required" });
    if (!email)
      return res.status(400).json({ ok: false, error: "email required" });
    if (!cpfCnpj)
      return res.status(400).json({ ok: false, error: "cpfCnpj required" });
    if (!phone)
      return res.status(400).json({ ok: false, error: "phone required" });

    // tenta gerar clientId sem colisão (quase impossível, mas garantimos)
    const doc = await createClientForWorkspace({
      workspaceId: req.tenantId,
      ownerUserId: req.user._id,
      fullName,
      email,
      cpfCnpj,
      phone,
    });

    return res.json({ ok: true, client: doc });
  } catch (e) {
    if (e?.code === 11000) {
      return res
        .status(409)
        .json({ ok: false, error: "Conflito ao criar cliente." });
    }
    return res
      .status(500)
      .json({ ok: false, error: e?.message || "Falha ao criar cliente." });
  }
});

// UPDATE (clientId imutável)
r.put("/clients/:id", ensureAuth, tenantFromUser, async (req, res) => {
  try {
    const id = String(req.params.id || "");
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, error: "ID inválido." });
    }

    const fullName = String(req.body?.fullName || "").trim();
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const cpfCnpj = String(req.body?.cpfCnpj || "").trim();
    const phone = String(req.body?.phone || "").trim();

    if (!fullName)
      return res.status(400).json({ ok: false, error: "fullName required" });
    if (!email)
      return res.status(400).json({ ok: false, error: "email required" });
    if (!cpfCnpj)
      return res.status(400).json({ ok: false, error: "cpfCnpj required" });
    if (!phone)
      return res.status(400).json({ ok: false, error: "phone required" });

    const updated = await Client.findOneAndUpdate(
      { _id: id, workspaceId: req.tenantId },
      { $set: { fullName, email, cpfCnpj, phone } },
      { new: true, runValidators: true },
    ).lean();

    if (!updated) {
      return res
        .status(404)
        .json({ ok: false, error: "Cliente não encontrado." });
    }

    return res.json({ ok: true, client: updated });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, error: e?.message || "Falha ao atualizar cliente." });
  }
});

export default r;
