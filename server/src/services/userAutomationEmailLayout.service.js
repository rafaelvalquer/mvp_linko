function normalizeText(value) {
  return String(value || "").trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function nl2br(value) {
  return escapeHtml(value).replace(/\n/g, "<br/>");
}

function chunk(items = [], size = 2) {
  const safeItems = Array.isArray(items) ? items : [];
  const groups = [];

  for (let index = 0; index < safeItems.length; index += size) {
    groups.push(safeItems.slice(index, index + size));
  }

  return groups;
}

const PALETTES = Object.freeze({
  agenda: {
    accent: "#0ea5e9",
    accentSoft: "#e0f2fe",
    accentText: "#075985",
    highlightBg: "#eff6ff",
    highlightBorder: "#bfdbfe",
  },
  cobranca: {
    accent: "#f59e0b",
    accentSoft: "#fef3c7",
    accentText: "#92400e",
    highlightBg: "#fffbeb",
    highlightBorder: "#fcd34d",
  },
  financeiro: {
    accent: "#10b981",
    accentSoft: "#d1fae5",
    accentText: "#065f46",
    highlightBg: "#ecfdf5",
    highlightBorder: "#86efac",
  },
  propostas: {
    accent: "#d946ef",
    accentSoft: "#fae8ff",
    accentText: "#86198f",
    highlightBg: "#fdf4ff",
    highlightBorder: "#f5d0fe",
  },
  resumos: {
    accent: "#6366f1",
    accentSoft: "#e0e7ff",
    accentText: "#3730a3",
    highlightBg: "#eef2ff",
    highlightBorder: "#c7d2fe",
  },
  default: {
    accent: "#0f172a",
    accentSoft: "#e2e8f0",
    accentText: "#334155",
    highlightBg: "#f8fafc",
    highlightBorder: "#cbd5e1",
  },
});

function resolvePalette(accentKey = "") {
  const normalized = normalizeText(accentKey).toLowerCase();
  return PALETTES[normalized] || PALETTES.default;
}

function renderSummaryStats(stats = [], palette) {
  const safeStats = (Array.isArray(stats) ? stats : []).filter(
    (item) => normalizeText(item?.label) && normalizeText(item?.value),
  );
  if (!safeStats.length) return "";

  const rows = chunk(safeStats, 2)
    .map((row) => {
      const cells = row
        .map(
          (item) => `
            <td width="50%" valign="top" style="padding:6px;">
              <div style="border:1px solid #e4e4e7; border-radius:16px; background:#ffffff; padding:16px;">
                <div style="font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#71717a;">
                  ${escapeHtml(item.label)}
                </div>
                <div style="margin-top:8px; font-size:22px; line-height:1.2; font-weight:800; color:#18181b;">
                  ${escapeHtml(item.value)}
                </div>
              </div>
            </td>`,
        )
        .join("");

      const fillCell =
        row.length < 2
          ? `<td width="50%" valign="top" style="padding:6px;"></td>`
          : "";

      return `<tr>${cells}${fillCell}</tr>`;
    })
    .join("");

  return `
    <div style="padding:0 24px 20px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        ${rows}
      </table>
    </div>`;
}

function renderHighlight(highlight = null, palette) {
  if (!highlight || typeof highlight !== "object") return "";

  const eyebrow = normalizeText(highlight.eyebrow || "");
  const title = normalizeText(highlight.title || "");
  const body = normalizeText(highlight.body || "");

  if (!title && !body) return "";

  return `
    <div style="padding:0 24px 20px;">
      <div style="border:1px solid ${palette.highlightBorder}; background:${palette.highlightBg}; border-radius:18px; padding:18px 18px 16px;">
        ${
          eyebrow
            ? `<div style="font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:${palette.accentText};">${escapeHtml(
                eyebrow,
              )}</div>`
            : ""
        }
        ${
          title
            ? `<div style="margin-top:${eyebrow ? "8px" : "0"}; font-size:18px; line-height:1.35; font-weight:800; color:#18181b;">${escapeHtml(
                title,
              )}</div>`
            : ""
        }
        ${
          body
            ? `<div style="margin-top:8px; font-size:14px; line-height:1.7; color:#3f3f46;">${nl2br(
                body,
              )}</div>`
            : ""
        }
      </div>
    </div>`;
}

function renderSectionItem(item = {}) {
  const title = normalizeText(item?.title || "");
  const subtitle = normalizeText(item?.subtitle || "");
  const meta = (Array.isArray(item?.meta) ? item.meta : []).filter(
    (entry) => normalizeText(entry?.label) && normalizeText(entry?.value),
  );

  if (!title && !subtitle && !meta.length) return "";

  return `
    <tr>
      <td style="padding:0 0 12px;">
        <div style="border:1px solid #e4e4e7; border-radius:16px; background:#ffffff; padding:16px;">
          ${
            title
              ? `<div style="font-size:15px; line-height:1.45; font-weight:700; color:#18181b;">${escapeHtml(
                  title,
                )}</div>`
              : ""
          }
          ${
            subtitle
              ? `<div style="margin-top:6px; font-size:13px; line-height:1.65; color:#52525b;">${nl2br(
                  subtitle,
                )}</div>`
              : ""
          }
          ${
            meta.length
              ? `<div style="margin-top:10px; font-size:13px; line-height:1.7; color:#3f3f46;">${meta
                  .map(
                    (entry) =>
                      `<div><strong>${escapeHtml(entry.label)}:</strong> ${escapeHtml(entry.value)}</div>`,
                  )
                  .join("")}</div>`
              : ""
          }
        </div>
      </td>
    </tr>`;
}

function renderSection(section = {}) {
  const title = normalizeText(section?.title || "");
  const intro = normalizeText(section?.intro || "");
  const emptyText = normalizeText(section?.emptyText || "");
  const items = (Array.isArray(section?.items) ? section.items : [])
    .map((item) => renderSectionItem(item))
    .filter(Boolean);

  if (!title && !intro && !items.length && !emptyText) return "";

  return `
    <div style="padding:0 24px 20px;">
      <div style="border:1px solid #e4e4e7; border-radius:20px; background:#fafafa; padding:18px;">
        ${
          title
            ? `<div style="font-size:16px; line-height:1.4; font-weight:800; color:#18181b;">${escapeHtml(
                title,
              )}</div>`
            : ""
        }
        ${
          intro
            ? `<div style="margin-top:6px; font-size:13px; line-height:1.7; color:#52525b;">${nl2br(
                intro,
              )}</div>`
            : ""
        }
        ${
          items.length
            ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:${
                title || intro ? "14px" : "0"
              }; border-collapse:collapse;">${items.join("")}</table>`
            : emptyText
              ? `<div style="margin-top:${title || intro ? "14px" : "0"}; border:1px solid #e4e4e7; border-radius:16px; background:#ffffff; padding:16px; font-size:14px; line-height:1.7; color:#52525b;">${nl2br(
                  emptyText,
                )}</div>`
              : ""
        }
      </div>
    </div>`;
}

export function renderAutomationEmailHtml(model = {}) {
  const headline = normalizeText(model?.headline || "Atualizacao da Lumina");
  const intro = normalizeText(model?.intro || "");
  const categoryLabel = normalizeText(model?.categoryLabel || "Automacao");
  const preheader = normalizeText(model?.preheader || intro || headline);
  const footerNote =
    normalizeText(model?.footerNote || "") ||
    "Esta e uma rotina automatica da Lumina enviada para acompanhar a sua carteira.";
  const palette = resolvePalette(model?.accent || "");
  const sections = (Array.isArray(model?.sections) ? model.sections : [])
    .map((section) => renderSection(section))
    .filter(Boolean)
    .join("");
  const emptyState =
    model?.emptyState && typeof model.emptyState === "object"
      ? model.emptyState
      : null;
  const showEmptyState =
    emptyState &&
    !sections &&
    (normalizeText(emptyState?.title || "") || normalizeText(emptyState?.body || ""));

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(headline)}</title>
  </head>
  <body style="margin:0; padding:0; background:#f4f4f5;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">
      ${escapeHtml(preheader)}
    </div>
    <div style="background:#f4f4f5; padding:24px 12px;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e4e4e7; border-radius:24px; overflow:hidden; font-family:ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#18181b;">
        <div style="padding:20px 24px 0;">
          <span style="display:inline-block; border-radius:999px; background:${palette.accentSoft}; color:${palette.accentText}; padding:6px 12px; font-size:11px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase;">
            Lumina • ${escapeHtml(categoryLabel)}
          </span>
        </div>

        <div style="padding:18px 24px 10px;">
          <div style="font-size:26px; line-height:1.15; font-weight:800; color:#18181b;">
            ${escapeHtml(headline)}
          </div>
          ${
            intro
              ? `<div style="margin-top:10px; font-size:14px; line-height:1.7; color:#52525b;">${nl2br(
                  intro,
                )}</div>`
              : ""
          }
        </div>

        ${renderSummaryStats(model?.summaryStats, palette)}
        ${renderHighlight(model?.highlight, palette)}
        ${
          showEmptyState
            ? `<div style="padding:0 24px 20px;">
                <div style="border:1px solid #e4e4e7; border-radius:18px; background:#fafafa; padding:18px;">
                  ${
                    normalizeText(emptyState?.title || "")
                      ? `<div style="font-size:16px; line-height:1.4; font-weight:800; color:#18181b;">${escapeHtml(
                          emptyState.title,
                        )}</div>`
                      : ""
                  }
                  ${
                    normalizeText(emptyState?.body || "")
                      ? `<div style="margin-top:8px; font-size:14px; line-height:1.7; color:#52525b;">${nl2br(
                          emptyState.body,
                        )}</div>`
                      : ""
                  }
                </div>
              </div>`
            : sections
        }

        <div style="padding:4px 24px 24px; font-size:12px; line-height:1.7; color:#71717a;">
          ${nl2br(footerNote)}
        </div>
      </div>
    </div>
  </body>
</html>`;
}
