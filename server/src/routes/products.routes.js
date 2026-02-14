import { Router } from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import multer from "multer";
import mongoose from "mongoose";

import { ensureAuth, tenantFromUser } from "../middleware/auth.js";
import { Product } from "../models/Product.js";

const r = Router();

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toInt(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

// ============ Upload (local) ============
const uploadDir = path.resolve(process.cwd(), "uploads", "products");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    const name = crypto.randomBytes(16).toString("hex") + ext;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype || "");
    cb(ok ? null : new Error("Formato de imagem inválido."), ok);
  },
});

// ============ Endpoints ============

// LISTAR / FILTRAR
r.get("/products", ensureAuth, tenantFromUser, async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const filter = { workspaceId: req.tenantId };

    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ productId: rx }, { name: rx }];
    }

    const items = await Product.find(filter)
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    return res.json({ ok: true, items });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, error: e?.message || "Falha ao listar produtos." });
  }
});

// DETALHE
r.get("/products/:id", ensureAuth, tenantFromUser, async (req, res) => {
  try {
    const id = String(req.params.id || "");
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, error: "ID inválido." });
    }

    const doc = await Product.findOne({
      _id: id,
      workspaceId: req.tenantId,
    }).lean();
    if (!doc)
      return res
        .status(404)
        .json({ ok: false, error: "Produto não encontrado." });

    return res.json({ ok: true, product: doc });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, error: e?.message || "Falha ao buscar produto." });
  }
});

// CRIAR
r.post(
  "/products",
  ensureAuth,
  tenantFromUser,
  upload.single("image"),
  async (req, res) => {
    try {
      const productId = String(req.body?.productId || "").trim();
      const name = String(req.body?.name || "").trim();
      const description = String(req.body?.description || "").trim();
      const priceCents = toInt(req.body?.priceCents, -1);

      if (!productId)
        return res.status(400).json({ ok: false, error: "productId required" });
      if (!name)
        return res.status(400).json({ ok: false, error: "name required" });
      if (!Number.isFinite(priceCents) || priceCents < 0)
        return res.status(400).json({ ok: false, error: "priceCents invalid" });

      const imageUrl = req.file ? `/uploads/products/${req.file.filename}` : "";

      const doc = await Product.create({
        workspaceId: req.tenantId,
        ownerUserId: req.user._id,
        productId,
        name,
        description,
        priceCents,
        imageUrl,
      });

      return res.json({ ok: true, product: doc });
    } catch (e) {
      // conflito de unique index
      if (e?.code === 11000) {
        return res
          .status(409)
          .json({
            ok: false,
            error: "ID do produto já existe neste workspace.",
          });
      }
      return res
        .status(500)
        .json({ ok: false, error: e?.message || "Falha ao criar produto." });
    }
  },
);

// EDITAR (ID imutável)
r.put(
  "/products/:id",
  ensureAuth,
  tenantFromUser,
  upload.single("image"),
  async (req, res) => {
    try {
      const id = String(req.params.id || "");
      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ ok: false, error: "ID inválido." });
      }

      const name = String(req.body?.name || "").trim();
      const description = String(req.body?.description || "").trim();
      const priceCents = toInt(req.body?.priceCents, -1);

      if (!name)
        return res.status(400).json({ ok: false, error: "name required" });
      if (!Number.isFinite(priceCents) || priceCents < 0)
        return res.status(400).json({ ok: false, error: "priceCents invalid" });

      const patch = { name, description, priceCents };

      if (req.file) {
        patch.imageUrl = `/uploads/products/${req.file.filename}`;
      }

      const updated = await Product.findOneAndUpdate(
        { _id: id, workspaceId: req.tenantId },
        { $set: patch },
        { new: true },
      ).lean();

      if (!updated)
        return res
          .status(404)
          .json({ ok: false, error: "Produto não encontrado." });

      return res.json({ ok: true, product: updated });
    } catch (e) {
      return res
        .status(500)
        .json({
          ok: false,
          error: e?.message || "Falha ao atualizar produto.",
        });
    }
  },
);

export default r;
