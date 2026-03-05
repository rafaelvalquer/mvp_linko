// server/src/middleware/uploadProof.js
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads", "payment-proofs");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "application/pdf"]);

function extForMime(m) {
  if (m === "image/jpeg") return ".jpg";
  if (m === "image/png") return ".png";
  if (m === "application/pdf") return ".pdf";
  return "";
}

function safeId(v) {
  return String(v || "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 64);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const offerId = safeId(req.offerIdForUpload || "");
    const ts = Date.now();
    const rand = crypto.randomBytes(6).toString("hex");
    const ext =
      extForMime(file.mimetype) || path.extname(file.originalname) || "";
    const base = offerId ? `offer_${offerId}` : "offer";
    cb(null, `${base}_${ts}_${rand}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    const err = new Error("Tipo de arquivo inválido. Envie JPG, PNG ou PDF.");
    err.statusCode = 400;
    return cb(err);
  }
  cb(null, true);
}

export const uploadPaymentProof = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});
