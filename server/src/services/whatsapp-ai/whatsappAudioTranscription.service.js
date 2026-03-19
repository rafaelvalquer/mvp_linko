import { spawn, spawnSync } from "node:child_process";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { getOpenAIClient, getTranscriptionModel } from "./openai.client.js";

const MAX_TRANSCRIPTION_BYTES = 25 * 1024 * 1024;
const DIRECT_MIME_EXTENSION = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "mp4",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "webm",
};

let ffmpegAvailable = null;

function normalizeMimeType(mimeType) {
  return String(mimeType || "")
    .trim()
    .toLowerCase()
    .split(";")[0];
}

function ensureFfmpegAvailable() {
  if (ffmpegAvailable === null) {
    const result = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
    ffmpegAvailable = result.status === 0;
  }

  if (ffmpegAvailable) return;

  const err = new Error("ffmpeg nao esta disponivel para transcrever audio.");
  err.code = "FFMPEG_UNAVAILABLE";
  throw err;
}

function convertToMp3(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-i",
      inputPath,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-b:a",
      "64k",
      outputPath,
    ];

    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      const err = new Error(stderr.trim() || "Falha ao converter audio com ffmpeg.");
      err.code = "FFMPEG_CONVERSION_FAILED";
      reject(err);
    });
  });
}

export async function transcribeWhatsAppAudio({ audioBase64, mimeType }) {
  const normalizedMimeType = normalizeMimeType(mimeType);
  const buffer = Buffer.from(String(audioBase64 || ""), "base64");

  if (!buffer.length) {
    const err = new Error("Audio recebido em formato invalido.");
    err.code = "INVALID_AUDIO_PAYLOAD";
    throw err;
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "whatsapp-ai-"));
  const inputExtension = DIRECT_MIME_EXTENSION[normalizedMimeType] || "bin";
  const inputPath = path.join(tempDir, `input.${inputExtension}`);

  try {
    await fs.writeFile(inputPath, buffer);

    let transcriptionPath = inputPath;
    if (!DIRECT_MIME_EXTENSION[normalizedMimeType]) {
      ensureFfmpegAvailable();
      transcriptionPath = path.join(tempDir, "audio.mp3");
      await convertToMp3(inputPath, transcriptionPath);
    }

    const stats = await fs.stat(transcriptionPath);
    if (stats.size > MAX_TRANSCRIPTION_BYTES) {
      const err = new Error("Audio acima do limite suportado para transcricao.");
      err.code = "AUDIO_TOO_LARGE";
      throw err;
    }

    const client = getOpenAIClient();
    const transcript = await client.audio.transcriptions.create({
      model: getTranscriptionModel(),
      file: createReadStream(transcriptionPath),
    });

    const text = String(transcript?.text || "").trim();
    if (!text) {
      const err = new Error("Nao foi possivel transcrever o audio recebido.");
      err.code = "EMPTY_AUDIO_TRANSCRIPT";
      throw err;
    }

    return text;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
