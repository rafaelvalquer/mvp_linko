const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const PAGE_MARGIN = 40;
const FOOTER_RESERVED = 70;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const CONTENT_BOTTOM = PAGE_HEIGHT - FOOTER_RESERVED;

const LAYOUT = {
  pageTop: 28,
  sectionGap: 18,
  blockGap: 12,
  cardGap: 16,
  cardPaddingX: 16,
  cardPaddingTop: 16,
  cardPaddingBottom: 16,
  headerPaddingTop: 24,
  headerPaddingBottom: 22,
  filterBandPadding: 14,
  filterChipHeight: 24,
  filterChipGap: 10,
  metricAccentHeight: 4,
  tableHeaderHeight: 24,
  minTableRowsPerPage: 4,
};

const COLORS = {
  page: [248, 250, 252],
  ink: [15, 23, 42],
  muted: [100, 116, 139],
  line: [226, 232, 240],
  white: [255, 255, 255],
  blue: [37, 99, 235],
  teal: [20, 184, 166],
  amber: [245, 158, 11],
  green: [34, 197, 94],
  red: [239, 68, 68],
  slate: [148, 163, 184],
  surface: [241, 245, 249],
  softAmber: [254, 243, 199],
  headerBlueTint: [191, 219, 254],
  headerBlueSurface: [30, 41, 59],
  headerGreenTint: [167, 243, 208],
  headerGreenSurface: [22, 101, 52],
};

function asciiText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdfText(value) {
  return asciiText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function colorCmd(color, mode = "fill") {
  const [r, g, b] = color.map((value) => (Number(value || 0) / 255).toFixed(3));
  return `${r} ${g} ${b} ${mode === "stroke" ? "RG" : "rg"}`;
}

function money(cents) {
  return (Number(cents || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function compactMoney(cents) {
  const value = Number(cents || 0) / 100;
  if (Math.abs(value) >= 1000) {
    return `R$ ${(value / 1000).toFixed(Math.abs(value) >= 10000 ? 0 : 1)}k`;
  }
  return money(cents);
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function typeLabel(type) {
  if (type === "service") return "Servicos";
  if (type === "product") return "Produtos";
  return "Todos";
}

function recurringStatusLabel(status) {
  if (status === "active") return "Ativas";
  if (status === "paused") return "Pausadas";
  if (status === "ended") return "Encerradas";
  if (status === "error") return "Com erro";
  if (status === "draft") return "Rascunho";
  return "Todas";
}

function portfolioHealthLabel(item = {}) {
  if (Number(item?.overdueCount || 0) > 0) return "Em atraso";
  if (Number(item?.awaitingConfirmationCount || 0) > 0) return "Em analise";
  if (Number(item?.pendingCount || 0) > 0) return "Pendente";
  return "Em dia";
}

function approxTextWidth(text, size = 12) {
  return asciiText(text).length * size * 0.52;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function safeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function truncateText(text, maxWidth, size = 12) {
  const clean = asciiText(text);
  if (!maxWidth || approxTextWidth(clean, size) <= maxWidth) return clean;

  let output = clean;
  while (output.length > 3 && approxTextWidth(`${output}...`, size) > maxWidth) {
    output = output.slice(0, -1);
  }
  return `${output}...`;
}

function wrapText(text, maxWidth, size = 12, maxLines = Number.POSITIVE_INFINITY) {
  const clean = asciiText(text);
  if (!clean) return [""];
  if (!maxWidth) return [clean];

  const words = clean.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const normalizedWord =
      approxTextWidth(word, size) > maxWidth ? truncateText(word, maxWidth, size) : word;
    const candidate = current ? `${current} ${normalizedWord}` : normalizedWord;

    if (!current || approxTextWidth(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }

    lines.push(current);
    current = normalizedWord;
  }

  if (current) lines.push(current);

  if (Number.isFinite(maxLines) && lines.length > maxLines) {
    const visible = lines.slice(0, maxLines);
    visible[maxLines - 1] = truncateText(`${visible[maxLines - 1]}...`, maxWidth, size);
    return visible;
  }

  return lines.length ? lines : [clean];
}

function measureTextBlock(text, options = {}) {
  const {
    width = null,
    size = 12,
    lineHeight = size + 4,
    truncate = false,
    maxLines = Number.POSITIVE_INFINITY,
  } = options;
  const lines = truncate ? [truncateText(text, width, size)] : wrapText(text, width, size, maxLines);
  return {
    lines,
    height: lines.length * lineHeight,
  };
}

function niceCeil(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 1;
  const exponent = 10 ** Math.floor(Math.log10(numeric));
  const fraction = numeric / exponent;
  if (fraction <= 1) return 1 * exponent;
  if (fraction <= 2) return 2 * exponent;
  if (fraction <= 5) return 5 * exponent;
  return 10 * exponent;
}

function shortAxisLabel(value) {
  const raw = asciiText(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [, month, day] = raw.split("-");
    return `${day}/${month}`;
  }
  return truncateText(raw, 42, 8);
}

function pickAxisIndexes(length, maxLabels = 4) {
  if (length <= 0) return [];
  if (length <= maxLabels) return Array.from({ length }, (_, index) => index);
  const indexes = new Set([0, length - 1]);
  for (let step = 1; step < maxLabels - 1; step += 1) {
    indexes.add(Math.round(((length - 1) * step) / (maxLabels - 1)));
  }
  return Array.from(indexes).sort((a, b) => a - b);
}

function buildLegendRows(items, maxWidth, size = 8) {
  const rows = [];
  let currentRow = [];
  let currentWidth = 0;

  for (const item of safeArray(items)) {
    const itemWidth = clamp(approxTextWidth(item.label || "", size) + 28, 68, Math.max(68, maxWidth));
    if (currentRow.length && currentWidth + itemWidth > maxWidth) {
      rows.push(currentRow);
      currentRow = [];
      currentWidth = 0;
    }
    currentRow.push({ ...item, width: itemWidth });
    currentWidth += itemWidth + 14;
  }

  if (currentRow.length) rows.push(currentRow);
  return rows;
}

function measureLegendHeight(items, maxWidth, size = 8) {
  const rows = buildLegendRows(items, maxWidth, size);
  return rows.length ? rows.length * 18 : 0;
}

function buildAutoTableNote(startIndex, renderedRows, totalRows) {
  if (!totalRows) return "Sem dados no periodo exportado.";
  const start = startIndex + 1;
  const end = startIndex + renderedRows;
  if (start === 1 && end === totalRows) {
    return `Total exportado: ${totalRows} linha(s).`;
  }
  return `Linhas ${start} a ${end} de ${totalRows} exportadas no PDF.`;
}

class PdfPage {
  constructor() {
    this.ops = [];
    this.width = PAGE_WIDTH;
    this.height = PAGE_HEIGHT;
  }

  y(top, height = 0) {
    return this.height - top - height;
  }

  push(value) {
    this.ops.push(value);
  }

  fillPage(color) {
    this.rect(PAGE_MARGIN / 2, PAGE_MARGIN / 2, this.width - PAGE_MARGIN, this.height - PAGE_MARGIN, {
      fillColor: color,
    });
  }

  rect(x, top, width, height, options = {}) {
    const { fillColor = null, strokeColor = null, lineWidth = 1 } = options;
    const y = this.y(top, height);
    if (fillColor && strokeColor) {
      this.push(
        `${lineWidth} w ${colorCmd(strokeColor, "stroke")} ${colorCmd(fillColor)} ${x} ${y} ${width} ${height} re B`,
      );
      return;
    }
    if (fillColor) {
      this.push(`${colorCmd(fillColor)} ${x} ${y} ${width} ${height} re f`);
      return;
    }
    if (strokeColor) {
      this.push(
        `${lineWidth} w ${colorCmd(strokeColor, "stroke")} ${x} ${y} ${width} ${height} re S`,
      );
    }
  }

  line(x1, top1, x2, top2, color = COLORS.line, lineWidth = 1) {
    this.push(
      `${lineWidth} w ${colorCmd(color, "stroke")} ${x1} ${this.y(top1)} m ${x2} ${this.y(top2)} l S`,
    );
  }

  polyline(points, color = COLORS.blue, lineWidth = 2) {
    if (!Array.isArray(points) || points.length < 2) return;
    const [first, ...rest] = points;
    const commands = [`${first.x} ${this.y(first.top)} m`];
    for (const point of rest) {
      commands.push(`${point.x} ${this.y(point.top)} l`);
    }
    this.push(
      `${lineWidth} w ${colorCmd(color, "stroke")} ${commands.join(" ")} S`,
    );
  }

  text(x, top, textValue, options = {}) {
    const {
      width = null,
      font = "F1",
      size = 12,
      color = COLORS.ink,
      lineHeight = size + 4,
      align = "left",
      truncate = false,
      maxLines = Number.POSITIVE_INFINITY,
    } = options;

    const lines = truncate
      ? [truncateText(textValue, width, size)]
      : wrapText(textValue, width, size, maxLines);

    let currentTop = top;
    for (const line of lines) {
      const safe = escapePdfText(line);
      const measuredWidth = approxTextWidth(line, size);
      let tx = x;
      if (width && align === "center") {
        tx += Math.max(0, (width - measuredWidth) / 2);
      } else if (width && align === "right") {
        tx += Math.max(0, width - measuredWidth);
      }
      const y = this.y(currentTop) - size;
      this.push(
        `BT ${colorCmd(color)} /${font} ${size} Tf 1 0 0 1 ${tx.toFixed(2)} ${y.toFixed(2)} Tm (${safe}) Tj ET`,
      );
      currentTop += lineHeight;
    }

    return currentTop - top;
  }

  stream() {
    return this.ops.join("\n");
  }
}

function drawMetaStack(page, { x, top, width, items = [], fillColor, textColor }) {
  const lines = safeArray(items);
  let cursor = top;

  for (const line of lines) {
    page.rect(x, cursor, width, 22, {
      fillColor,
      strokeColor: fillColor,
    });
    page.text(x + 10, cursor + 7, line, {
      size: 9,
      color: textColor,
      width: width - 20,
      truncate: true,
    });
    cursor += 28;
  }

  return cursor - top;
}

function measureMetaStackHeight(items = []) {
  return safeArray(items).length * 28;
}

function drawHeader(page, { top = LAYOUT.pageTop, title, subtitle, metaLeft = [], metaRight = [] }) {
  const leftWidth = 296;
  const rightWidth = CONTENT_WIDTH - leftWidth - 34;
  const titleMetrics = measureTextBlock(title, {
    width: leftWidth,
    size: 24,
    lineHeight: 28,
    maxLines: 3,
  });
  const subtitleMetrics = measureTextBlock(subtitle, {
    width: leftWidth,
    size: 11,
    lineHeight: 15,
    maxLines: 3,
  });

  const leftContentHeight =
    titleMetrics.height +
    (subtitle ? 10 + subtitleMetrics.height : 0);
  const metaGap = metaLeft.length && metaRight.length ? 10 : 0;
  const rightContentHeight =
    measureMetaStackHeight(metaLeft) +
    metaGap +
    measureMetaStackHeight(metaRight);
  const contentHeight = Math.max(leftContentHeight, rightContentHeight, 72);
  const height = LAYOUT.headerPaddingTop + contentHeight + LAYOUT.headerPaddingBottom;

  page.rect(PAGE_MARGIN, top, CONTENT_WIDTH, height, {
    fillColor: COLORS.ink,
  });
  page.rect(PAGE_MARGIN + 18, top + 16, 88, 6, { fillColor: COLORS.blue });
  page.rect(PAGE_MARGIN + 112, top + 16, 52, 6, { fillColor: COLORS.teal });

  let leftCursor = top + 30;
  leftCursor += page.text(PAGE_MARGIN + 22, leftCursor, title, {
    font: "F2",
    size: 24,
    color: COLORS.white,
    width: leftWidth,
    lineHeight: 28,
    maxLines: 3,
  });
  if (subtitle) {
    leftCursor += 10;
    page.text(PAGE_MARGIN + 22, leftCursor, subtitle, {
      size: 11,
      color: [203, 213, 225],
      width: leftWidth,
      lineHeight: 15,
      maxLines: 3,
    });
  }

  const rightX = PAGE_MARGIN + CONTENT_WIDTH - rightWidth - 22;
  let metaTop = top + 24;
  metaTop += drawMetaStack(page, {
    x: rightX,
    top: metaTop,
    width: rightWidth,
    items: metaLeft,
    fillColor: COLORS.headerBlueSurface,
    textColor: COLORS.headerBlueTint,
  });
  if (metaLeft.length && metaRight.length) metaTop += 10;
  drawMetaStack(page, {
    x: rightX,
    top: metaTop,
    width: rightWidth,
    items: metaRight,
    fillColor: COLORS.headerGreenSurface,
    textColor: COLORS.headerGreenTint,
  });

  return height;
}

function drawFilterBand(page, { top, items = [] }) {
  const filters = safeArray(items).map((item) => truncateText(item, 180, 10));
  if (!filters.length) return 0;

  const maxInnerWidth = CONTENT_WIDTH - LAYOUT.filterBandPadding * 2;
  const rows = [];
  let currentRow = [];
  let currentWidth = 0;

  for (const item of filters) {
    const chipWidth = clamp(approxTextWidth(item, 10) + 22, 88, 200);
    if (currentRow.length && currentWidth + chipWidth > maxInnerWidth) {
      rows.push(currentRow);
      currentRow = [];
      currentWidth = 0;
    }
    currentRow.push({ label: item, width: chipWidth });
    currentWidth += chipWidth + LAYOUT.filterChipGap;
  }

  if (currentRow.length) rows.push(currentRow);

  const height =
    LAYOUT.filterBandPadding * 2 +
    rows.length * LAYOUT.filterChipHeight +
    Math.max(0, rows.length - 1) * 8;

  page.rect(PAGE_MARGIN, top, CONTENT_WIDTH, height, {
    fillColor: COLORS.surface,
    strokeColor: COLORS.line,
  });

  let cursorTop = top + LAYOUT.filterBandPadding;
  for (const row of rows) {
    let cursorX = PAGE_MARGIN + LAYOUT.filterBandPadding;
    for (const item of row) {
      page.rect(cursorX, cursorTop, item.width, LAYOUT.filterChipHeight, {
        fillColor: COLORS.white,
        strokeColor: COLORS.line,
      });
      page.text(cursorX + 9, cursorTop + 8, item.label, {
        size: 10,
        color: COLORS.muted,
        width: item.width - 18,
        truncate: true,
      });
      cursorX += item.width + LAYOUT.filterChipGap;
    }
    cursorTop += LAYOUT.filterChipHeight + 8;
  }

  return height;
}

function measureCardHeaderHeight({ width, title, subtitle }) {
  const innerWidth = width - LAYOUT.cardPaddingX * 2;
  const titleMetrics = measureTextBlock(title, {
    width: innerWidth,
    size: 12,
    lineHeight: 16,
    maxLines: 3,
  });
  const subtitleMetrics = subtitle
    ? measureTextBlock(subtitle, {
        width: innerWidth,
        size: 9,
        lineHeight: 13,
        maxLines: 3,
      })
    : { height: 0 };

  return (
    LAYOUT.cardPaddingTop +
    titleMetrics.height +
    (subtitle ? 4 + subtitleMetrics.height : 0) +
    14
  );
}

function drawCardShell(page, { x, top, width, height, title, subtitle, accent = COLORS.blue }) {
  page.rect(x, top, width, height, {
    fillColor: COLORS.white,
    strokeColor: COLORS.line,
  });
  page.rect(x, top, width, 4, { fillColor: accent });

  const innerX = x + LAYOUT.cardPaddingX;
  const innerWidth = width - LAYOUT.cardPaddingX * 2;
  let cursor = top + LAYOUT.cardPaddingTop;

  cursor += page.text(innerX, cursor, title, {
    font: "F2",
    size: 12,
    width: innerWidth,
    lineHeight: 16,
    maxLines: 3,
  });

  if (subtitle) {
    cursor += 4;
    cursor += page.text(innerX, cursor, subtitle, {
      size: 9,
      color: COLORS.muted,
      width: innerWidth,
      lineHeight: 13,
      maxLines: 3,
    });
  }

  cursor += 14;

  return {
    innerX,
    innerWidth,
    bodyTop: cursor,
    bodyBottom: top + height - LAYOUT.cardPaddingBottom,
  };
}

function measureMetricCardHeight(item, width) {
  const innerWidth = width - 28;
  const titleHeight = measureTextBlock(item.title, {
    width: innerWidth,
    size: 11,
    lineHeight: 14,
    maxLines: 3,
  }).height;
  const valueHeight = measureTextBlock(item.value, {
    width: innerWidth,
    size: 18,
    lineHeight: 22,
    maxLines: 2,
  }).height;
  const subtitleHeight = item.subtitle
    ? measureTextBlock(item.subtitle, {
        width: innerWidth,
        size: 9,
        lineHeight: 12,
        maxLines: 3,
      }).height
    : 0;

  return Math.max(
    96,
    14 + titleHeight + 10 + valueHeight + (subtitleHeight ? 10 + subtitleHeight : 0) + 16,
  );
}

function drawMetricCard(page, { x, top, width, height, title, subtitle, value, accent }) {
  page.rect(x, top, width, height, {
    fillColor: COLORS.white,
    strokeColor: COLORS.line,
  });
  page.rect(x, top, width, LAYOUT.metricAccentHeight, {
    fillColor: accent || COLORS.blue,
  });

  const innerX = x + 14;
  const innerWidth = width - 28;
  let cursor = top + 14;

  cursor += page.text(innerX, cursor, title, {
    font: "F2",
    size: 11,
    width: innerWidth,
    lineHeight: 14,
    maxLines: 3,
  });
  cursor += 10;
  cursor += page.text(innerX, cursor, value, {
    font: "F2",
    size: 18,
    color: COLORS.ink,
    width: innerWidth,
    lineHeight: 22,
    maxLines: 2,
  });

  if (subtitle) {
    cursor += 10;
    page.text(innerX, cursor, subtitle, {
      size: 9,
      color: COLORS.muted,
      width: innerWidth,
      lineHeight: 12,
      maxLines: 3,
    });
  }

  return height;
}

function drawEmptyChart(page, x, top, width, height, message) {
  page.text(x, top + Math.max(0, height / 2 - 8), message, {
    width,
    size: 10,
    color: COLORS.muted,
    align: "center",
  });
}

function drawLegend(page, { x, top, width, items = [] }) {
  const rows = buildLegendRows(items, width);
  let cursorTop = top;

  for (const row of rows) {
    let cursorX = x;
    for (const item of row) {
      page.rect(cursorX, cursorTop + 3, 10, 10, { fillColor: item.color || COLORS.blue });
      page.text(cursorX + 16, cursorTop, item.label || "", {
        size: 8,
        color: COLORS.muted,
        width: item.width - 16,
        truncate: true,
      });
      cursorX += item.width + 14;
    }
    cursorTop += 18;
  }

  return rows.length ? rows.length * 18 : 0;
}

function measureChartCardHeight(config, width) {
  const legendHeight = measureLegendHeight(config.series, width - LAYOUT.cardPaddingX * 2);
  return (
    measureCardHeaderHeight({ width, title: config.title, subtitle: config.subtitle }) +
    legendHeight +
    (legendHeight ? 10 : 0) +
    Number(config.plotHeight || 150) +
    18
  );
}

function drawLineChartCard(page, config) {
  const {
    x,
    top,
    width,
    height,
    title,
    subtitle,
    data = [],
    series = [],
    xLabelKey = "date",
    yFormatter = compactMoney,
  } = config;

  const shell = drawCardShell(page, {
    x,
    top,
    width,
    height,
    title,
    subtitle,
    accent: series?.[0]?.color || COLORS.blue,
  });

  const legendHeight = drawLegend(page, {
    x: shell.innerX,
    top: shell.bodyTop,
    width: shell.innerWidth,
    items: series,
  });
  const plotTop = shell.bodyTop + legendHeight + (legendHeight ? 10 : 0);
  const plotHeight = Math.max(96, shell.bodyBottom - plotTop);

  if (!data.length || !series.length) {
    drawEmptyChart(page, shell.innerX, plotTop, shell.innerWidth, plotHeight, "Sem dados no periodo");
    return height;
  }

  const values = [];
  for (const row of data) {
    for (const item of series) values.push(Number(row?.[item.key] || 0));
  }

  const maxValue = niceCeil(Math.max(...values, 0));
  const leftAxisWidth = 52;
  const bottomAxisHeight = 24;
  const chartX = shell.innerX + leftAxisWidth;
  const chartTop = plotTop + 6;
  const chartWidth = shell.innerWidth - leftAxisWidth - 8;
  const chartHeight = Math.max(64, plotHeight - bottomAxisHeight - 10);

  for (let index = 0; index <= 4; index += 1) {
    const ratio = index / 4;
    const y = chartTop + chartHeight * ratio;
    page.line(chartX, y, chartX + chartWidth, y, COLORS.line, 1);
    const value = Math.round(maxValue - maxValue * ratio);
    page.text(shell.innerX, y - 6, yFormatter(value), {
      size: 8,
      color: COLORS.muted,
      width: leftAxisWidth - 8,
      align: "right",
      truncate: true,
    });
  }

  page.line(chartX, chartTop, chartX, chartTop + chartHeight, COLORS.line, 1);
  page.line(
    chartX,
    chartTop + chartHeight,
    chartX + chartWidth,
    chartTop + chartHeight,
    COLORS.line,
    1,
  );

  const step = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth / 2;
  for (const index of pickAxisIndexes(data.length, 4)) {
    const row = data[index];
    const label = shortAxisLabel(row?.label || row?.[xLabelKey] || "-");
    const xPos = chartX + (data.length > 1 ? step * index : chartWidth / 2);
    page.text(xPos - 24, chartTop + chartHeight + 10, label, {
      size: 8,
      color: COLORS.muted,
      width: 48,
      align: "center",
      truncate: true,
    });
  }

  for (const item of series) {
    const points = data.map((row, index) => {
      const value = Number(row?.[item.key] || 0);
      const ratio = maxValue > 0 ? value / maxValue : 0;
      return {
        x: chartX + (data.length > 1 ? step * index : chartWidth / 2),
        top: chartTop + chartHeight - chartHeight * ratio,
      };
    });
    page.polyline(points, item.color || COLORS.blue, 2.2);
  }

  return height;
}

function drawGroupedBarChartCard(page, config) {
  const {
    x,
    top,
    width,
    height,
    title,
    subtitle,
    data = [],
    series = [],
    xLabelKey = "label",
    yFormatter = compactMoney,
  } = config;

  const shell = drawCardShell(page, {
    x,
    top,
    width,
    height,
    title,
    subtitle,
    accent: series?.[0]?.color || COLORS.blue,
  });

  const legendHeight = drawLegend(page, {
    x: shell.innerX,
    top: shell.bodyTop,
    width: shell.innerWidth,
    items: series,
  });
  const plotTop = shell.bodyTop + legendHeight + (legendHeight ? 10 : 0);
  const plotHeight = Math.max(96, shell.bodyBottom - plotTop);

  if (!data.length || !series.length) {
    drawEmptyChart(page, shell.innerX, plotTop, shell.innerWidth, plotHeight, "Sem dados no periodo");
    return height;
  }

  const values = [];
  for (const row of data) {
    for (const item of series) values.push(Number(row?.[item.key] || 0));
  }

  const maxValue = niceCeil(Math.max(...values, 0));
  const leftAxisWidth = 52;
  const bottomAxisHeight = 24;
  const chartX = shell.innerX + leftAxisWidth;
  const chartTop = plotTop + 6;
  const chartWidth = shell.innerWidth - leftAxisWidth - 8;
  const chartHeight = Math.max(64, plotHeight - bottomAxisHeight - 10);

  for (let index = 0; index <= 4; index += 1) {
    const ratio = index / 4;
    const y = chartTop + chartHeight * ratio;
    page.line(chartX, y, chartX + chartWidth, y, COLORS.line, 1);
    const value = Math.round(maxValue - maxValue * ratio);
    page.text(shell.innerX, y - 6, yFormatter(value), {
      size: 8,
      color: COLORS.muted,
      width: leftAxisWidth - 8,
      align: "right",
      truncate: true,
    });
  }

  page.line(chartX, chartTop, chartX, chartTop + chartHeight, COLORS.line, 1);
  page.line(
    chartX,
    chartTop + chartHeight,
    chartX + chartWidth,
    chartTop + chartHeight,
    COLORS.line,
    1,
  );

  const groupWidth = chartWidth / Math.max(data.length, 1);
  const totalBarWidth = Math.min(48, Math.max(12, groupWidth - 10));
  const singleBarWidth = Math.max(
    6,
    (totalBarWidth - Math.max(0, (series.length - 1) * 4)) / series.length,
  );

  for (const idx of pickAxisIndexes(data.length, 4)) {
    const row = data[idx];
    const label = shortAxisLabel(row?.[xLabelKey] || row?.label || "-");
    const xPos = chartX + groupWidth * idx + groupWidth / 2;
    page.text(xPos - 24, chartTop + chartHeight + 10, label, {
      size: 8,
      color: COLORS.muted,
      width: 48,
      align: "center",
      truncate: true,
    });
  }

  for (let rowIndex = 0; rowIndex < data.length; rowIndex += 1) {
    const baseX = chartX + groupWidth * rowIndex + (groupWidth - totalBarWidth) / 2;
    for (let seriesIndex = 0; seriesIndex < series.length; seriesIndex += 1) {
      const item = series[seriesIndex];
      const value = Number(data[rowIndex]?.[item.key] || 0);
      const barHeight = maxValue > 0 ? (chartHeight * value) / maxValue : 0;
      const xPos = baseX + seriesIndex * (singleBarWidth + 4);
      page.rect(xPos, chartTop + chartHeight - barHeight, singleBarWidth, barHeight, {
        fillColor: item.color || COLORS.blue,
      });
    }
  }

  return height;
}

function resolveTableNote(config) {
  if (config.note) return asciiText(config.note);
  return buildAutoTableNote(config.startIndex || 0, config.rows?.length || 0, config.totalRows || 0);
}

function measureTableBaseHeight(config) {
  const noteText = resolveTableNote(config);
  const noteHeight = noteText
    ? 10 +
      measureTextBlock(noteText, {
        width: config.width - LAYOUT.cardPaddingX * 2,
        size: 8,
        lineHeight: 11,
        maxLines: 2,
      }).height
    : 0;

  return measureCardHeaderHeight({
    width: config.width,
    title: config.title,
    subtitle: config.subtitle,
  }) + LAYOUT.tableHeaderHeight + noteHeight + 14;
}

function measureTableCardHeight(config) {
  const rowsCount = Array.isArray(config.rows) ? config.rows.length : Number(config.rowsCount || 0);
  const bodyHeight = rowsCount > 0 ? rowsCount * config.rowHeight : 56;
  return measureTableBaseHeight(config) + bodyHeight;
}

function computeTableCapacity(config) {
  const baseHeight = measureTableBaseHeight(config);
  const availableForRows = config.availableHeight - baseHeight;
  if (availableForRows <= 0) return 0;
  return Math.floor(availableForRows / config.rowHeight);
}

function drawTableCard(page, config) {
  const {
    x,
    top,
    width,
    title,
    subtitle,
    columns = [],
    rows = [],
    rowHeight = 24,
    startIndex = 0,
    totalRows = rows.length,
    accent = COLORS.blue,
  } = config;

  const noteText = resolveTableNote({ ...config, rows, startIndex, totalRows });
  const noteMetrics = noteText
    ? measureTextBlock(noteText, {
        width: width - LAYOUT.cardPaddingX * 2,
        size: 8,
        lineHeight: 11,
        maxLines: 2,
      })
    : { height: 0 };

  const height = measureTableCardHeight({
    ...config,
    rows,
    startIndex,
    totalRows,
    note: noteText,
    rowHeight,
  });

  const shell = drawCardShell(page, {
    x,
    top,
    width,
    height,
    title,
    subtitle,
    accent,
  });

  const innerX = shell.innerX;
  const innerWidth = shell.innerWidth;
  let cursor = shell.bodyTop;

  page.rect(innerX, cursor, innerWidth, LAYOUT.tableHeaderHeight, {
    fillColor: COLORS.surface,
    strokeColor: COLORS.line,
  });

  const totalColumnWidth = columns.reduce((sum, column) => sum + column.width, 0) || 1;
  const scale = innerWidth / totalColumnWidth;

  let cursorX = innerX + 8;
  for (const column of columns) {
    const cellWidth = column.width * scale;
    page.text(cursorX, cursor + 8, column.label, {
      font: "F2",
      size: 8,
      color: COLORS.muted,
      width: cellWidth - 10,
      truncate: true,
    });
    cursorX += cellWidth;
  }

  cursor += LAYOUT.tableHeaderHeight;

  if (!rows.length) {
    page.line(innerX, cursor, innerX + innerWidth, cursor, COLORS.line, 1);
    page.text(innerX, cursor + 20, "Sem dados no periodo", {
      width: innerWidth,
      size: 9,
      color: COLORS.muted,
      align: "center",
    });
    cursor += 56;
  } else {
    for (let index = 0; index < rows.length; index += 1) {
      const rowTop = cursor + index * rowHeight;
      page.line(innerX, rowTop, innerX + innerWidth, rowTop, COLORS.line, 1);
      cursorX = innerX + 8;

      for (const column of columns) {
        const cellWidth = column.width * scale;
        const value = column.render(rows[index]);
        page.text(cursorX, rowTop + 8, value, {
          size: 8,
          color: COLORS.ink,
          width: cellWidth - 10,
          truncate: true,
        });
        cursorX += cellWidth;
      }
    }
    cursor += rows.length * rowHeight;
    page.line(innerX, cursor, innerX + innerWidth, cursor, COLORS.line, 1);
  }

  if (noteText) {
    const noteTop = top + height - 14 - noteMetrics.height;
    page.text(innerX, noteTop, noteText, {
      size: 8,
      color: COLORS.muted,
      width: innerWidth,
      lineHeight: 11,
      maxLines: 2,
    });
  }

  return height;
}

function drawFooter(page, pageNumber, totalPages) {
  page.line(PAGE_MARGIN, PAGE_HEIGHT - 44, PAGE_WIDTH - PAGE_MARGIN, PAGE_HEIGHT - 44, COLORS.line, 1);
  page.text(PAGE_MARGIN, PAGE_HEIGHT - 34, "LuminorPay Reports", {
    size: 8,
    color: COLORS.muted,
  });
  page.text(PAGE_WIDTH - PAGE_MARGIN - 120, PAGE_HEIGHT - 34, `Pagina ${pageNumber} de ${totalPages}`, {
    size: 8,
    color: COLORS.muted,
    width: 120,
    align: "right",
  });
}

function buildPdfBuffer(pages) {
  const catalogId = 1;
  const pagesId = 2;
  const fontRegularId = 3;
  const fontBoldId = 4;

  let nextId = 5;
  const contentIds = [];
  const pageIds = [];

  for (let index = 0; index < pages.length; index += 1) {
    contentIds.push(nextId++);
    pageIds.push(nextId++);
  }

  const objects = [];
  objects[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  objects[fontRegularId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[fontBoldId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  for (let index = 0; index < pages.length; index += 1) {
    const stream = pages[index].stream();
    const contentId = contentIds[index];
    const pageId = pageIds[index];
    objects[contentId] = `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`;
    objects[pageId] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`;
  }

  let pdf = "%PDF-1.4\n% Report\n";
  const offsets = [0];

  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = Buffer.byteLength(pdf, "utf8");
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += "0000000000 65535 f \n";

  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

class ReportComposer {
  constructor(defaultPage) {
    this.defaultPage = defaultPage;
    this.pages = [];
    this.page = null;
    this.cursor = 0;
    this.pageBodyTop = 0;
  }

  startPage(overrides = {}) {
    const config = {
      ...this.defaultPage,
      ...overrides,
    };
    const page = new PdfPage();
    page.fillPage(COLORS.page);

    const headerHeight = drawHeader(page, {
      top: LAYOUT.pageTop,
      title: config.title,
      subtitle: config.subtitle,
      metaLeft: config.metaLeft,
      metaRight: config.metaRight,
    });

    let cursor = LAYOUT.pageTop + headerHeight + LAYOUT.sectionGap;
    const filterHeight = drawFilterBand(page, {
      top: cursor,
      items: config.filters,
    });
    cursor += filterHeight + LAYOUT.sectionGap;

    this.pages.push(page);
    this.page = page;
    this.cursor = cursor;
    this.pageBodyTop = cursor;
    return page;
  }

  remainingHeight() {
    return CONTENT_BOTTOM - this.cursor;
  }

  isFreshPage() {
    return Math.abs(this.cursor - this.pageBodyTop) < 0.5;
  }

  ensureSpace(minHeight, pageOverrides = {}) {
    if (!this.page) {
      this.startPage(pageOverrides);
      return;
    }

    if (this.remainingHeight() < minHeight) {
      this.startPage(pageOverrides);
    }
  }

  advance(height, gap = LAYOUT.sectionGap) {
    this.cursor += height + gap;
  }
}

function renderMetricGrid(composer, { metrics, columns, pageConfig }) {
  const gap = 12;
  const cardWidth = (CONTENT_WIDTH - gap * (columns - 1)) / columns;

  for (let start = 0; start < metrics.length; start += columns) {
    const row = metrics.slice(start, start + columns);
    const rowHeight = Math.max(...row.map((item) => measureMetricCardHeight(item, cardWidth)));
    composer.ensureSpace(rowHeight, pageConfig);

    row.forEach((item, index) => {
      drawMetricCard(composer.page, {
        x: PAGE_MARGIN + index * (cardWidth + gap),
        top: composer.cursor,
        width: cardWidth,
        height: rowHeight,
        ...item,
      });
    });

    composer.advance(rowHeight, gap);
  }
}

function renderChartRow(composer, { cards, pageConfig }) {
  const gap = LAYOUT.cardGap;
  const cardWidth = (CONTENT_WIDTH - gap * (cards.length - 1)) / cards.length;
  const heights = cards.map((card) => card.height || measureChartCardHeight(card, cardWidth));
  const rowHeight = Math.max(...heights);

  composer.ensureSpace(rowHeight, pageConfig);

  cards.forEach((card, index) => {
    const x = PAGE_MARGIN + index * (cardWidth + gap);
    const height = card.height || rowHeight;
    const draw = card.kind === "bar" ? drawGroupedBarChartCard : drawLineChartCard;
    draw(composer.page, {
      ...card,
      x,
      top: composer.cursor,
      width: cardWidth,
      height,
    });
  });

  composer.advance(rowHeight);
}

function renderSingleChart(composer, { card, pageConfig }) {
  const width = CONTENT_WIDTH;
  const height = card.height || measureChartCardHeight(card, width);
  composer.ensureSpace(height, pageConfig);

  const draw = card.kind === "bar" ? drawGroupedBarChartCard : drawLineChartCard;
  draw(composer.page, {
    ...card,
    x: PAGE_MARGIN,
    top: composer.cursor,
    width,
    height,
  });

  composer.advance(height);
}

function renderTableSection(composer, { table, pageConfig, continuationPageConfig }) {
  const rows = Array.isArray(table.rows) ? table.rows : [];

  if (!rows.length) {
    const emptyHeight = measureTableCardHeight({
      ...table,
      rows: [],
      rowHeight: table.rowHeight,
    });
    composer.ensureSpace(emptyHeight, pageConfig);
    const height = drawTableCard(composer.page, {
      ...table,
      x: PAGE_MARGIN,
      top: composer.cursor,
      width: table.width || CONTENT_WIDTH,
      rows: [],
    });
    composer.advance(height);
    return;
  }

  let index = 0;
  while (index < rows.length) {
    composer.ensureSpace(
      measureTableCardHeight({
        ...table,
        startIndex: index,
        totalRows: rows.length,
        rowsCount: Math.min(LAYOUT.minTableRowsPerPage, rows.length - index),
      }),
      index === 0 ? pageConfig : continuationPageConfig,
    );

    const availableHeight = composer.remainingHeight();
    const capacity = computeTableCapacity({
      ...table,
      startIndex: index,
      totalRows: rows.length,
      width: table.width || CONTENT_WIDTH,
      availableHeight,
    });
    const remaining = rows.length - index;
    const minimumRows = Math.min(LAYOUT.minTableRowsPerPage, remaining);

    if (capacity < minimumRows && !composer.isFreshPage()) {
      composer.startPage(index === 0 ? pageConfig : continuationPageConfig);
      continue;
    }

    const chunkSize = Math.max(1, Math.min(remaining, capacity || 0));
    const chunk = rows.slice(index, index + chunkSize);
    const title =
      index === 0 ? table.title : `${table.title} (continuacao)`;

    const height = drawTableCard(composer.page, {
      ...table,
      title,
      x: PAGE_MARGIN,
      top: composer.cursor,
      width: table.width || CONTENT_WIDTH,
      rows: chunk,
      startIndex: index,
      totalRows: rows.length,
    });

    composer.advance(height);
    index += chunk.length;

    if (index < rows.length) {
      composer.startPage(continuationPageConfig);
    }
  }
}

function buildGeneralPageOptions(snapshot, generatedAt, subtitle) {
  return {
    title: "Relatorios gerais",
    subtitle,
    metaLeft: [
      `Periodo: ${snapshot.filters.from} a ${snapshot.filters.to}`,
      `Tipo: ${typeLabel(snapshot.filters.type)}`,
    ],
    metaRight: [
      `Escopo: ${snapshot.filters.onlyPaid ? "Somente pagos" : "Todos"}`,
      `Gerado em: ${generatedAt}`,
    ],
    filters: [
      `Periodo ${snapshot.filters.from} ate ${snapshot.filters.to}`,
      `Tipo ${typeLabel(snapshot.filters.type)}`,
      snapshot.filters.onlyPaid ? "Filtro pagos ativo" : "Exibindo todos os status",
    ],
  };
}

function buildRecurringPageOptions(dashboard, generatedAt, subtitle) {
  return {
    title: "Relatorios de recorrencia",
    subtitle,
    metaLeft: [
      `Periodo: ${dashboard.filters.from} a ${dashboard.filters.to}`,
      `Tipo: ${typeLabel(dashboard.filters.type)}`,
    ],
    metaRight: [
      `Status: ${recurringStatusLabel(dashboard.filters.recurringStatus)}`,
      `Gerado em: ${generatedAt}`,
    ],
    filters: [
      `Periodo ${dashboard.filters.from} ate ${dashboard.filters.to}`,
      `Tipo ${typeLabel(dashboard.filters.type)}`,
      `Status ${recurringStatusLabel(dashboard.filters.recurringStatus)}`,
    ],
  };
}

function buildGeneralPages(snapshot) {
  const generatedAt = formatDateTime(new Date());
  const overviewPage = buildGeneralPageOptions(
    snapshot,
    generatedAt,
    "Receita, conversao e desempenho comercial em um painel executivo.",
  );
  const detailPage = buildGeneralPageOptions(
    snapshot,
    generatedAt,
    "Clientes, itens e transacoes em um resumo comercial detalhado.",
  );
  const transactionsPage = buildGeneralPageOptions(
    snapshot,
    generatedAt,
    "Transacoes recentes do periodo exportado.",
  );

  const composer = new ReportComposer(overviewPage);
  composer.startPage();

  const summary = snapshot.summary || {};
  const metrics = [
    {
      title: "Receita paga",
      subtitle: "Valor confirmado no periodo",
      value: money(summary.paidRevenueCents),
      accent: COLORS.teal,
    },
    {
      title: "Vendas pagas",
      subtitle: "Pedidos confirmados",
      value: String(summary.paidCount || 0),
      accent: COLORS.blue,
    },
    {
      title: "Ticket medio",
      subtitle: "Receita por venda paga",
      value: money(summary.avgTicketCents),
      accent: COLORS.amber,
    },
    {
      title: "Conversao",
      subtitle: "Pagas / emitidas",
      value: `${Number(summary.conversionPct || 0).toFixed(1)}%`,
      accent: COLORS.green,
    },
  ];

  renderMetricGrid(composer, {
    metrics,
    columns: 4,
    pageConfig: overviewPage,
  });

  renderChartRow(composer, {
    pageConfig: overviewPage,
    cards: [
      {
        kind: "line",
        title: "Receita diaria",
        subtitle: "Pagamentos confirmados por dia",
        data: snapshot.revenueDaily || [],
        xLabelKey: "date",
        series: [{ key: "paidRevenueCents", label: "Receita paga", color: COLORS.teal }],
        plotHeight: 150,
      },
      {
        kind: "bar",
        title: "Criadas vs pagas",
        subtitle: "Comparativo diario do periodo",
        data: snapshot.createdVsPaidDaily || [],
        xLabelKey: "date",
        yFormatter: (value) => String(Math.round(Number(value || 0))),
        series: [
          { key: "createdCount", label: "Criadas", color: COLORS.slate },
          { key: "paidCount", label: "Pagas", color: COLORS.green },
        ],
        plotHeight: 150,
      },
    ],
  });

  composer.startPage(detailPage);
  const pairedWidth = (CONTENT_WIDTH - LAYOUT.cardGap) / 2;
  const topClientsHeight = measureTableCardHeight({
    width: pairedWidth,
    title: "Top clientes",
    subtitle: "Quem mais converteu receita",
    rows: snapshot.topClients || [],
    rowHeight: 22,
  });
  const topItemsHeight = measureTableCardHeight({
    width: pairedWidth,
    title: "Top itens",
    subtitle: "Servicos e produtos mais vendidos",
    rows: snapshot.topItems || [],
    rowHeight: 22,
  });
  const pairedHeight = Math.max(topClientsHeight, topItemsHeight);
  composer.ensureSpace(pairedHeight, detailPage);

  drawTableCard(composer.page, {
    x: PAGE_MARGIN,
    top: composer.cursor,
    width: pairedWidth,
    title: "Top clientes",
    subtitle: "Quem mais converteu receita",
    columns: [
      { label: "Cliente", width: 110, render: (row) => row.customerName || "-" },
      { label: "Total pago", width: 70, render: (row) => money(row.paidRevenueCents) },
      { label: "Vendas", width: 40, render: (row) => String(row.paidCount || 0) },
    ],
    rows: snapshot.topClients || [],
    rowHeight: 22,
  });

  drawTableCard(composer.page, {
    x: PAGE_MARGIN + pairedWidth + LAYOUT.cardGap,
    top: composer.cursor,
    width: pairedWidth,
    title: "Top itens",
    subtitle: "Servicos e produtos mais vendidos",
    columns: [
      { label: "Item", width: 110, render: (row) => row.description || "-" },
      { label: "Receita", width: 70, render: (row) => money(row.paidRevenueCents) },
      { label: "Qtd", width: 40, render: (row) => String(row.qty || 0) },
    ],
    rows: snapshot.topItems || [],
    rowHeight: 22,
  });

  composer.advance(pairedHeight);

  renderTableSection(composer, {
    pageConfig: transactionsPage,
    continuationPageConfig: transactionsPage,
    table: {
      title: "Transacoes recentes",
      subtitle: "Amostra operacional do periodo exportado",
      width: CONTENT_WIDTH,
      columns: [
        { label: "Data", width: 60, render: (row) => formatDate(row.paidDate) },
        { label: "Cliente", width: 110, render: (row) => row.customerName || "-" },
        { label: "Titulo", width: 120, render: (row) => row.title || "-" },
        { label: "Status", width: 70, render: (row) => row.paymentStatus || row.status || "-" },
        { label: "Valor", width: 60, render: (row) => money(row.paidCents) },
      ],
      rows: snapshot.transactions || [],
      rowHeight: 22,
    },
  });

  return composer.pages;
}

function buildRecurringPages(dashboard) {
  const generatedAt = formatDateTime(new Date());
  const overviewPage = buildRecurringPageOptions(
    dashboard,
    generatedAt,
    "Saude da carteira recorrente, risco atual e performance de recebimento.",
  );
  const detailPage = buildRecurringPageOptions(
    dashboard,
    generatedAt,
    "Distribuicao e carteira recorrente em um resumo executivo.",
  );
  const delinquentPage = buildRecurringPageOptions(
    dashboard,
    generatedAt,
    "Clientes inadimplentes e carteira recorrente em acompanhamento.",
  );
  const portfolioPage = buildRecurringPageOptions(
    dashboard,
    generatedAt,
    "Carteira por recorrencia e comportamento de pagamento.",
  );

  const composer = new ReportComposer(overviewPage);
  composer.startPage();

  const summary = dashboard.summary || {};
  const metrics = [
    {
      title: "Receita recebida",
      subtitle: "Pagamentos confirmados",
      value: money(summary.paidRevenueCents),
      accent: COLORS.teal,
    },
    {
      title: "Cobrancas geradas",
      subtitle: "Parcelas criadas no periodo",
      value: String(summary.generatedCount || 0),
      accent: COLORS.blue,
    },
    {
      title: "Em atraso",
      subtitle: "Parcelas vencidas e abertas",
      value: String(summary.overdueCount || 0),
      accent: COLORS.red,
    },
    {
      title: "Valor em atraso",
      subtitle: "Risco financeiro atual",
      value: money(summary.overdueAmountCents),
      accent: COLORS.amber,
    },
    {
      title: "Clientes inadimplentes",
      subtitle: "Clientes com atraso no periodo",
      value: String(summary.delinquentClientsCount || 0),
      accent: COLORS.softAmber,
    },
    {
      title: "Pagamento no prazo",
      subtitle: "Taxa de pontualidade",
      value: `${Number(summary.onTimeRatePct || 0).toFixed(1)}%`,
      accent: COLORS.green,
    },
  ];

  renderMetricGrid(composer, {
    metrics,
    columns: 3,
    pageConfig: overviewPage,
  });

  renderChartRow(composer, {
    pageConfig: overviewPage,
    cards: [
      {
        kind: "line",
        title: "Vencendo vs recebido",
        subtitle: "Valor previsto x valor pago por dia",
        data: dashboard.dueVsPaidDaily || [],
        series: [
          { key: "dueAmountCents", label: "Vencendo", color: COLORS.amber },
          { key: "paidAmountCents", label: "Recebido", color: COLORS.teal },
        ],
        plotHeight: 132,
      },
      {
        kind: "bar",
        title: "Carteira em atraso",
        subtitle: "Valor por faixa de aging",
        data: dashboard.overdueAgingBuckets || [],
        xLabelKey: "bucket",
        series: [{ key: "amountCents", label: "Valor em atraso", color: COLORS.red }],
        plotHeight: 132,
      },
    ],
  });

  composer.startPage(detailPage);
  renderSingleChart(composer, {
    pageConfig: detailPage,
    card: {
      kind: "bar",
      title: "Dias com mais pagamentos",
      subtitle: "Contagem de pagamentos por dia da semana",
      data: dashboard.paymentWeekdayDistribution || [],
      xLabelKey: "label",
      yFormatter: (value) => String(Math.round(Number(value || 0))),
      series: [{ key: "count", label: "Pagamentos", color: COLORS.blue }],
      plotHeight: 124,
    },
  });

  renderTableSection(composer, {
    pageConfig: delinquentPage,
    continuationPageConfig: delinquentPage,
    table: {
      title: "Clientes inadimplentes",
      subtitle: "Quem exige acao de cobranca com maior urgencia",
      width: CONTENT_WIDTH,
      columns: [
        { label: "Cliente", width: 100, render: (row) => row.customerName || "-" },
        { label: "Recorr.", width: 44, render: (row) => String(row.recurringCount || 0) },
        { label: "Atraso", width: 44, render: (row) => String(row.overdueCount || 0) },
        { label: "Valor", width: 58, render: (row) => money(row.overdueAmountCents) },
        { label: "Maior atraso", width: 60, render: (row) => `${Number(row.maxDelayDays || 0)} dia(s)` },
        {
          label: "Ult. lembrete",
          width: 70,
          render: (row) => (row.lastReminderAt ? formatDateTime(row.lastReminderAt) : "Sem envio"),
        },
      ],
      rows: dashboard.delinquentClients || [],
      rowHeight: 22,
    },
  });

  renderTableSection(composer, {
    pageConfig: portfolioPage,
    continuationPageConfig: portfolioPage,
    table: {
      title: "Carteira por recorrencia",
      subtitle: "Resumo das automacoes mais relevantes do periodo",
      width: CONTENT_WIDTH,
      columns: [
        { label: "Recorrencia", width: 100, render: (row) => row.recurringName || "-" },
        { label: "Cliente", width: 74, render: (row) => row.customerName || "-" },
        { label: "Status", width: 48, render: (row) => row.recurringStatus || "-" },
        { label: "Ger.", width: 30, render: (row) => String(row.generatedCount || 0) },
        { label: "Pag.", width: 30, render: (row) => String(row.paidCount || 0) },
        { label: "Pend.", width: 34, render: (row) => String(row.pendingCount || 0) },
        { label: "Atr.", width: 30, render: (row) => String(row.overdueCount || 0) },
        { label: "Valor", width: 54, render: (row) => money(row.overdueAmountCents) },
        { label: "Carteira", width: 48, render: (row) => portfolioHealthLabel(row) },
        { label: "Prox. venc.", width: 52, render: (row) => formatDate(row.nextDueAt) },
      ],
      rows: dashboard.portfolio || [],
      rowHeight: 22,
    },
  });

  return composer.pages;
}

export function buildGeneralReportPdfBuffer(snapshot) {
  const pages = buildGeneralPages(snapshot);
  pages.forEach((page, index) => drawFooter(page, index + 1, pages.length));
  return buildPdfBuffer(pages);
}

export function buildRecurringReportPdfBuffer(dashboard) {
  const pages = buildRecurringPages(dashboard);
  pages.forEach((page, index) => drawFooter(page, index + 1, pages.length));
  return buildPdfBuffer(pages);
}
