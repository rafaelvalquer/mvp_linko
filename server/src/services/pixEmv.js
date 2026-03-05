// server/src/services/pixEmv.js
// Gerador EMV "copia e cola" Pix (estático), com CRC16 correto.

function onlyAsciiUpper(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clampStr(s, max, fallback = "") {
  const v = onlyAsciiUpper(s);
  if (!v) return fallback;
  return v.length <= max ? v : v.slice(0, max);
}

function txidAlnum(txid) {
  const t = String(txid || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();
  const out = t.slice(0, 25);
  return out || "LUMINOR";
}

function field(id, value) {
  const v = String(value ?? "");
  const len = String(v.length).padStart(2, "0");
  return `${id}${len}${v}`;
}

function crc16ccitt(str) {
  // CRC16-CCITT (0x1021), init 0xFFFF
  let crc = 0xffff;
  const buf = Buffer.from(str, "utf8");

  for (const b of buf) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) {
      if (crc & 0x8000) crc = ((crc << 1) ^ 0x1021) & 0xffff;
      else crc = (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * buildPixBrCode
 * @param {object} p
 * @param {string} p.pixKey - chave pix (raw)
 * @param {number} p.amountCents
 * @param {string} p.receiverName - até 25, ASCII/UPPER
 * @param {string} p.receiverCity - até 15, ASCII/UPPER
 * @param {string} p.txid - 1..25, alfanumérico
 * @param {string} [p.description] - opcional
 */
export function buildPixBrCode({
  pixKey,
  amountCents,
  receiverName,
  receiverCity,
  txid,
  description,
}) {
  const key = String(pixKey || "").trim();
  if (!key) throw new Error("pixKey ausente");

  const name = clampStr(receiverName, 25, "RECEBEDOR");
  const city = clampStr(receiverCity, 15, "SAO PAULO");

  const amount = (Number(amountCents || 0) / 100).toFixed(2);
  const tx = txidAlnum(txid);

  // Merchant Account Info (26)
  const gui = field("00", "BR.GOV.BCB.PIX");
  const k = field("01", key);
  const desc = description ? field("02", String(description).slice(0, 50)) : "";
  const mai = field("26", `${gui}${k}${desc}`);

  const payload =
    field("00", "01") + // payload format indicator
    field("01", "11") + // point of initiation method (11=static)
    mai +
    field("52", "0000") + // merchant category code
    field("53", "986") + // currency BRL
    field("54", amount) +
    field("58", "BR") +
    field("59", name) +
    field("60", city) +
    field("62", field("05", tx));

  // CRC (63) — precisa calcular com "6304" no final
  const withCrcId = payload + "6304";
  const crc = crc16ccitt(withCrcId);

  return withCrcId + crc;
}
