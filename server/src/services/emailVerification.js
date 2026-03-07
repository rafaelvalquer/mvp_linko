//server/src/services/emailVerification.js

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const REGISTER_CODE_TTL_MINUTES = 10;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function fmtExpiresAt(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return `${REGISTER_CODE_TTL_MINUTES} minutos`;

  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildVerificationEmail({ name, code, expiresAt }) {
  const firstName =
    String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)[0] || "";
  const greeting = firstName ? `Olá, ${escapeHtml(firstName)}!` : "Olá!";
  const expiresText = fmtExpiresAt(expiresAt);

  const subject = "Confirme seu e-mail";

  const html = `
    <div style="background:#f4f4f5; padding:24px;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e4e4e7; border-radius:18px; overflow:hidden; font-family:ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#18181b;">
        <div style="padding:28px 24px 10px;">
          <div style="font-size:22px; font-weight:800;">Confirme seu e-mail</div>
          <div style="margin-top:10px; font-size:14px; line-height:1.6; color:#52525b;">
            ${greeting}<br/>
            Recebemos uma tentativa de cadastro na plataforma usando este e-mail.
          </div>
        </div>

        <div style="padding:16px 24px 4px;">
          <div style="font-size:13px; color:#71717a; margin-bottom:10px;">Use o código abaixo para confirmar seu e-mail:</div>
          <div style="display:inline-block; padding:16px 22px; border-radius:16px; border:1px solid #d4d4d8; background:#fafafa; font-size:32px; font-weight:800; letter-spacing:10px; color:#09090b;">
            ${escapeHtml(code)}
          </div>
        </div>

        <div style="padding:16px 24px 8px; font-size:14px; line-height:1.7; color:#3f3f46;">
          Este código é válido por até <strong>${REGISTER_CODE_TTL_MINUTES} minutos</strong>.<br/>
          Validade até: <strong>${escapeHtml(expiresText)}</strong>.
        </div>

        <div style="padding:0 24px 24px; font-size:13px; line-height:1.7; color:#71717a;">
          Se você não solicitou este cadastro, pode ignorar este e-mail com segurança.
        </div>
      </div>
    </div>`;

  const text = [
    "Confirme seu e-mail",
    "",
    `Código de confirmação: ${code}`,
    `Validade: ${expiresText}`,
    `O código é válido por ${REGISTER_CODE_TTL_MINUTES} minutos.`,
    "",
    "Se você não solicitou este cadastro, pode ignorar este e-mail.",
  ].join("\n");

  return { subject, html, text };
}

export async function sendRegistrationVerificationEmail({
  to,
  name,
  code,
  expiresAt,
}) {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(process.env.RESEND_FROM || "").trim();
  const recipient = String(to || "").trim();

  if (!apiKey) {
    const err = new Error("RESEND_API_KEY ausente.");
    err.status = 500;
    throw err;
  }

  if (!from) {
    const err = new Error("RESEND_FROM ausente.");
    err.status = 500;
    throw err;
  }

  if (!recipient) {
    const err = new Error("E-mail do destinatário ausente.");
    err.status = 400;
    throw err;
  }

  const { subject, html, text } = buildVerificationEmail({
    name,
    code,
    expiresAt,
  });

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: recipient,
      subject,
      html,
      text,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(
      data?.message || data?.error || `Resend error (${response.status})`,
    );
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return {
    ok: true,
    id: data?.id || data?.data?.id || null,
  };
}
