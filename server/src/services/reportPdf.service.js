const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const PAGE_MARGIN = 40;

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

function truncateText(text, maxWidth, size = 12) {
  const clean = asciiText(text);
  if (!maxWidth || approxTextWidth(clean, size) <= maxWidth) return clean;

  let output = clean;
  while (output.length > 3 && approxTextWidth(`${output}...`, size) > maxWidth) {
    output = output.slice(0, -1);
  }
  return `${output}...`;
}

function wrapText(text, maxWidth, size = 12) {
  const clean = asciiText(text);
  if (!clean) return [""];
  if (!maxWidth) return [clean];

  const words = clean.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || approxTextWidth(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines.length ? lines : [clean];
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
    } = options;

    const lines = truncate
      ? [truncateText(textValue, width, size)]
      : wrapText(textValue, width, size);

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

function drawHeader(page, { title, subtitle, metaLeft = [], metaRight = [] }) {
  page.rect(PAGE_MARGIN, 28, PAGE_WIDTH - PAGE_MARGIN * 2, 108, {
    fillColor: COLORS.ink,
  });
  page.rect(PAGE_MARGIN + 18, 44, 88, 6, { fillColor: COLORS.blue });
  page.rect(PAGE_MARGIN + 112, 44, 52, 6, { fillColor: COLORS.teal });
  page.text(PAGE_MARGIN + 22, 58, title, {
    font: "F2",
    size: 24,
    color: COLORS.white,
    width: 300,
  });
  page.text(PAGE_MARGIN + 22, 92, subtitle, {
    size: 11,
    color: [203, 213, 225],
    width: 320,
  });

  let metaTop = 58;
  for (const line of metaLeft) {
    page.text(PAGE_MARGIN + 360, metaTop, line, {
      size: 10,
      color: [191, 219, 254],
      width: 170,
      align: "right",
    });
    metaTop += 16;
  }

  metaTop = 58;
  for (const line of metaRight) {
    page.text(PAGE_MARGIN + 360, metaTop + 48, line, {
      size: 10,
      color: [167, 243, 208],
      width: 170,
      align: "right",
    });
    metaTop += 16;
  }
}

function drawCard(page, { x, top, width, height, title, subtitle }) {
  page.rect(x, top, width, height, {
    fillColor: COLORS.white,
    strokeColor: COLORS.line,
  });
  page.rect(x, top, width, 4, { fillColor: COLORS.blue });
  page.text(x + 16, top + 16, title, {
    font: "F2",
    size: 12,
    width: width - 32,
  });
  if (subtitle) {
    page.text(x + 16, top + 34, subtitle, {
      size: 9,
      color: COLORS.muted,
      width: width - 32,
    });
  }
}

function drawMetricCard(page, { x, top, width, height, title, subtitle, value, accent }) {
  page.rect(x, top, width, height, {
    fillColor: COLORS.white,
    strokeColor: COLORS.line,
  });
  page.rect(x, top, width, 4, { fillColor: accent || COLORS.blue });
  page.text(x + 14, top + 14, title, {
    font: "F2",
    size: 11,
    width: width - 28,
  });
  page.text(x + 14, top + 34, value, {
    font: "F2",
    size: 18,
    color: COLORS.ink,
    width: width - 28,
  });
  if (subtitle) {
    page.text(x + 14, top + 60, subtitle, {
      size: 9,
      color: COLORS.muted,
      width: width - 28,
    });
  }
}

function drawFilterBand(page, { top, items }) {
  page.rect(PAGE_MARGIN, top, PAGE_WIDTH - PAGE_MARGIN * 2, 44, {
    fillColor: COLORS.surface,
    strokeColor: COLORS.line,
  });

  let currentX = PAGE_MARGIN + 16;
  for (const item of items) {
    const label = truncateText(item, 150, 10);
    const width = Math.min(160, approxTextWidth(label, 10) + 18);
    page.rect(currentX, top + 10, width, 24, {
      fillColor: COLORS.white,
      strokeColor: COLORS.line,
    });
    page.text(currentX + 9, top + 17, label, {
      size: 10,
      color: COLORS.muted,
      width: width - 18,
      truncate: true,
    });
    currentX += width + 10;
    if (currentX > PAGE_WIDTH - PAGE_MARGIN - 80) break;
  }
}

function drawEmptyChart(page, x, top, width, height, message) {
  page.text(x, top + height / 2 - 8, message, {
    width,
    size: 10,
    color: COLORS.muted,
    align: "center",
  });
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

  drawCard(page, { x, top, width, height, title, subtitle });

  const plot = {
    x: x + 18,
    top: top + 54,
    width: width - 36,
    height: height - 74,
  };

  if (!data.length || !series.length) {
    drawEmptyChart(page, plot.x, plot.top, plot.width, plot.height, "Sem dados no periodo");
    return;
  }

  const values = [];
  for (const row of data) {
    for (const item of series) values.push(Number(row?.[item.key] || 0));
  }
  const maxValue = Math.max(...values, 1);
  const minValue = 0;
  const leftAxisWidth = 48;
  const bottomAxisHeight = 24;
  const chartX = plot.x + leftAxisWidth;
  const chartTop = plot.top + 6;
  const chartWidth = plot.width - leftAxisWidth - 8;
  const chartHeight = plot.height - bottomAxisHeight - 12;

  for (let index = 0; index <= 4; index += 1) {
    const ratio = index / 4;
    const y = chartTop + chartHeight * ratio;
    page.line(chartX, y, chartX + chartWidth, y, COLORS.line, 1);
    const value = Math.round(maxValue - (maxValue - minValue) * ratio);
    page.text(plot.x, y - 6, yFormatter(value), {
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
  const xIndexes = [0, Math.floor((data.length - 1) / 2), data.length - 1]
    .filter((value, index, items) => items.indexOf(value) === index);

  for (const index of xIndexes) {
    const row = data[index];
    const label = row?.label || row?.[xLabelKey] || "-";
    const xPos = chartX + (data.length > 1 ? step * index : chartWidth / 2);
    page.text(xPos - 28, chartTop + chartHeight + 10, label, {
      size: 8,
      color: COLORS.muted,
      width: 56,
      align: "center",
      truncate: true,
    });
  }

  let legendX = x + 18;
  for (const item of series) {
    page.rect(legendX, top + 18, 10, 10, { fillColor: item.color });
    page.text(legendX + 14, top + 16, item.label, {
      size: 8,
      color: COLORS.muted,
      width: 90,
      truncate: true,
    });
    legendX += 100;
  }

  for (const item of series) {
    const points = data.map((row, index) => {
      const value = Number(row?.[item.key] || 0);
      const ratio = value / maxValue;
      return {
        x: chartX + (data.length > 1 ? step * index : chartWidth / 2),
        top: chartTop + chartHeight - chartHeight * ratio,
      };
    });
    page.polyline(points, item.color, 2.2);
  }
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

  drawCard(page, { x, top, width, height, title, subtitle });

  const plot = {
    x: x + 18,
    top: top + 54,
    width: width - 36,
    height: height - 74,
  };

  if (!data.length || !series.length) {
    drawEmptyChart(page, plot.x, plot.top, plot.width, plot.height, "Sem dados no periodo");
    return;
  }

  const values = [];
  for (const row of data) {
    for (const item of series) values.push(Number(row?.[item.key] || 0));
  }
  const maxValue = Math.max(...values, 1);
  const leftAxisWidth = 48;
  const bottomAxisHeight = 24;
  const chartX = plot.x + leftAxisWidth;
  const chartTop = plot.top + 6;
  const chartWidth = plot.width - leftAxisWidth - 8;
  const chartHeight = plot.height - bottomAxisHeight - 12;

  for (let index = 0; index <= 4; index += 1) {
    const ratio = index / 4;
    const y = chartTop + chartHeight * ratio;
    page.line(chartX, y, chartX + chartWidth, y, COLORS.line, 1);
    const value = Math.round(maxValue - maxValue * ratio);
    page.text(plot.x, y - 6, yFormatter(value), {
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
  const totalBarWidth = Math.min(44, Math.max(12, groupWidth - 8));
  const singleBarWidth = Math.max(
    6,
    (totalBarWidth - Math.max(0, (series.length - 1) * 4)) / series.length,
  );

  const labelIndexes = [0, Math.floor((data.length - 1) / 2), data.length - 1]
    .filter((value, index, items) => items.indexOf(value) === index);

  for (const idx of labelIndexes) {
    const row = data[idx];
    const label = row?.[xLabelKey] || row?.label || "-";
    const xPos = chartX + groupWidth * idx + groupWidth / 2;
    page.text(xPos - 28, chartTop + chartHeight + 10, label, {
      size: 8,
      color: COLORS.muted,
      width: 56,
      align: "center",
      truncate: true,
    });
  }

  let legendX = x + 18;
  for (const item of series) {
    page.rect(legendX, top + 18, 10, 10, { fillColor: item.color });
    page.text(legendX + 14, top + 16, item.label, {
      size: 8,
      color: COLORS.muted,
      width: 90,
      truncate: true,
    });
    legendX += 100;
  }

  for (let rowIndex = 0; rowIndex < data.length; rowIndex += 1) {
    const baseX = chartX + groupWidth * rowIndex + (groupWidth - totalBarWidth) / 2;
    for (let seriesIndex = 0; seriesIndex < series.length; seriesIndex += 1) {
      const item = series[seriesIndex];
      const value = Number(data[rowIndex]?.[item.key] || 0);
      const barHeight = (chartHeight * value) / maxValue;
      const xPos = baseX + seriesIndex * (singleBarWidth + 4);
      page.rect(xPos, chartTop + chartHeight - barHeight, singleBarWidth, barHeight, {
        fillColor: item.color,
      });
    }
  }
}

function drawTableCard(page, config) {
  const {
    x,
    top,
    width,
    height,
    title,
    subtitle,
    columns = [],
    rows = [],
    rowHeight = 24,
    note = "",
  } = config;

  drawCard(page, { x, top, width, height, title, subtitle });

  const innerX = x + 14;
  const innerTop = top + 50;
  const innerWidth = width - 28;
  const headerHeight = 24;
  const availableHeight = height - 72;
  const maxRows = Math.max(1, Math.floor((availableHeight - headerHeight) / rowHeight));
  const visibleRows = rows.slice(0, maxRows);
  const scale = innerWidth / columns.reduce((sum, column) => sum + column.width, 0);

  page.rect(innerX, innerTop, innerWidth, headerHeight, {
    fillColor: COLORS.surface,
    strokeColor: COLORS.line,
  });

  let cursorX = innerX + 8;
  for (const column of columns) {
    const cellWidth = column.width * scale;
    page.text(cursorX, innerTop + 7, column.label, {
      font: "F2",
      size: 8,
      color: COLORS.muted,
      width: cellWidth - 10,
      truncate: true,
    });
    cursorX += cellWidth;
  }

  for (let index = 0; index < visibleRows.length; index += 1) {
    const rowTop = innerTop + headerHeight + index * rowHeight;
    page.line(innerX, rowTop, innerX + innerWidth, rowTop, COLORS.line, 1);
    cursorX = innerX + 8;

    for (const column of columns) {
      const cellWidth = column.width * scale;
      const value = column.render(visibleRows[index]);
      page.text(cursorX, rowTop + 7, value, {
        size: 8,
        color: COLORS.ink,
        width: cellWidth - 10,
        truncate: true,
      });
      cursorX += cellWidth;
    }
  }

  if (note) {
    page.text(innerX, top + height - 18, note, {
      size: 8,
      color: COLORS.muted,
      width: innerWidth,
    });
  } else if (rows.length > visibleRows.length) {
    page.text(
      innerX,
      top + height - 18,
      `Mostrando ${visibleRows.length} de ${rows.length} linhas no PDF.`,
      {
        size: 8,
        color: COLORS.muted,
        width: innerWidth,
      },
    );
  }
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

function buildGeneralPages(snapshot) {
  const page1 = new PdfPage();
  page1.fillPage(COLORS.page);
  drawHeader(page1, {
    title: "Relatorios gerais",
    subtitle: "Receita, conversao e desempenho comercial em um painel executivo.",
    metaLeft: [
      `Periodo: ${snapshot.filters.from} a ${snapshot.filters.to}`,
      `Tipo: ${typeLabel(snapshot.filters.type)}`,
    ],
    metaRight: [
      `Escopo: ${snapshot.filters.onlyPaid ? "Somente pagos" : "Todos"}`,
      `Gerado em: ${formatDateTime(new Date())}`,
    ],
  });
  drawFilterBand(page1, {
    top: 154,
    items: [
      `Periodo ${snapshot.filters.from} ate ${snapshot.filters.to}`,
      `Tipo ${typeLabel(snapshot.filters.type)}`,
      snapshot.filters.onlyPaid ? "Filtro pagos ativo" : "Exibindo todos os status",
    ],
  });

  const summary = snapshot.summary || {};
  const metricWidth = (PAGE_WIDTH - PAGE_MARGIN * 2 - 36) / 4;
  const metricTop = 214;
  const metricHeight = 88;
  const metricGap = 12;
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

  metrics.forEach((item, index) => {
    drawMetricCard(page1, {
      x: PAGE_MARGIN + index * (metricWidth + metricGap),
      top: metricTop,
      width: metricWidth,
      height: metricHeight,
      ...item,
    });
  });

  drawLineChartCard(page1, {
    x: PAGE_MARGIN,
    top: 322,
    width: 248,
    height: 242,
    title: "Receita diaria",
    subtitle: "Pagamentos confirmados por dia",
    data: snapshot.revenueDaily || [],
    xLabelKey: "date",
    series: [{ key: "paidRevenueCents", label: "Receita paga", color: COLORS.teal }],
  });

  drawGroupedBarChartCard(page1, {
    x: PAGE_MARGIN + 267,
    top: 322,
    width: 248,
    height: 242,
    title: "Criadas vs pagas",
    subtitle: "Comparativo diario do periodo",
    data: snapshot.createdVsPaidDaily || [],
    xLabelKey: "date",
    yFormatter: (value) => String(Math.round(Number(value || 0))),
    series: [
      { key: "createdCount", label: "Criadas", color: COLORS.slate },
      { key: "paidCount", label: "Pagas", color: COLORS.green },
    ],
  });

  const page2 = new PdfPage();
  page2.fillPage(COLORS.page);
  drawHeader(page2, {
    title: "Clientes, itens e transacoes",
    subtitle: "Leitura comercial detalhada para compartilhamento executivo.",
    metaLeft: [
      `Periodo: ${snapshot.filters.from} a ${snapshot.filters.to}`,
      `Tipo: ${typeLabel(snapshot.filters.type)}`,
    ],
    metaRight: [`Gerado em: ${formatDateTime(new Date())}`],
  });

  drawTableCard(page2, {
    x: PAGE_MARGIN,
    top: 154,
    width: 248,
    height: 224,
    title: "Top clientes",
    subtitle: "Quem mais converteu receita",
    columns: [
      { label: "Cliente", width: 110, render: (row) => row.customerName || "-" },
      { label: "Total pago", width: 70, render: (row) => money(row.paidRevenueCents) },
      { label: "Vendas", width: 40, render: (row) => String(row.paidCount || 0) },
    ],
    rows: snapshot.topClients || [],
  });

  drawTableCard(page2, {
    x: PAGE_MARGIN + 267,
    top: 154,
    width: 248,
    height: 224,
    title: "Top itens",
    subtitle: "Servicos e produtos mais vendidos",
    columns: [
      { label: "Item", width: 110, render: (row) => row.description || "-" },
      { label: "Receita", width: 70, render: (row) => money(row.paidRevenueCents) },
      { label: "Qtd", width: 40, render: (row) => String(row.qty || 0) },
    ],
    rows: snapshot.topItems || [],
  });

  drawTableCard(page2, {
    x: PAGE_MARGIN,
    top: 398,
    width: PAGE_WIDTH - PAGE_MARGIN * 2,
    height: 344,
    title: "Transacoes recentes",
    subtitle: "Amostra operacional do periodo exportado",
    columns: [
      { label: "Data", width: 60, render: (row) => formatDate(row.paidDate) },
      { label: "Cliente", width: 110, render: (row) => row.customerName || "-" },
      { label: "Titulo", width: 120, render: (row) => row.title || "-" },
      { label: "Status", width: 70, render: (row) => row.paymentStatus || row.status || "-" },
      { label: "Valor", width: 60, render: (row) => money(row.paidCents) },
    ],
    rows: snapshot.transactions || [],
    rowHeight: 22,
  });

  return [page1, page2];
}

function buildRecurringPages(dashboard) {
  const page1 = new PdfPage();
  page1.fillPage(COLORS.page);
  drawHeader(page1, {
    title: "Relatorios de recorrencia",
    subtitle: "Saude da carteira recorrente, risco atual e performance de recebimento.",
    metaLeft: [
      `Periodo: ${dashboard.filters.from} a ${dashboard.filters.to}`,
      `Tipo: ${typeLabel(dashboard.filters.type)}`,
    ],
    metaRight: [
      `Status: ${recurringStatusLabel(dashboard.filters.recurringStatus)}`,
      `Gerado em: ${formatDateTime(new Date())}`,
    ],
  });
  drawFilterBand(page1, {
    top: 154,
    items: [
      `Periodo ${dashboard.filters.from} ate ${dashboard.filters.to}`,
      `Tipo ${typeLabel(dashboard.filters.type)}`,
      `Status ${recurringStatusLabel(dashboard.filters.recurringStatus)}`,
    ],
  });

  const summary = dashboard.summary || {};
  const metricWidth = (PAGE_WIDTH - PAGE_MARGIN * 2 - 24) / 3;
  const metricHeight = 78;
  const metricGap = 12;
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

  metrics.forEach((item, index) => {
    const row = Math.floor(index / 3);
    const col = index % 3;
    drawMetricCard(page1, {
      x: PAGE_MARGIN + col * (metricWidth + metricGap),
      top: 214 + row * (metricHeight + 12),
      width: metricWidth,
      height: metricHeight,
      ...item,
    });
  });

  drawLineChartCard(page1, {
    x: PAGE_MARGIN,
    top: 392,
    width: 248,
    height: 196,
    title: "Vencendo vs recebido",
    subtitle: "Valor previsto x valor pago por dia",
    data: dashboard.dueVsPaidDaily || [],
    series: [
      { key: "dueAmountCents", label: "Vencendo", color: COLORS.amber },
      { key: "paidAmountCents", label: "Recebido", color: COLORS.teal },
    ],
  });

  drawGroupedBarChartCard(page1, {
    x: PAGE_MARGIN + 267,
    top: 392,
    width: 248,
    height: 196,
    title: "Carteira em atraso",
    subtitle: "Valor por faixa de aging",
    data: dashboard.overdueAgingBuckets || [],
    xLabelKey: "bucket",
    series: [{ key: "amountCents", label: "Valor em atraso", color: COLORS.red }],
  });

  const page2 = new PdfPage();
  page2.fillPage(COLORS.page);
  drawHeader(page2, {
    title: "Distribuicao e carteira recorrente",
    subtitle: "Cliente, recorrencia e comportamento de pagamento em um resumo executivo.",
    metaLeft: [
      `Periodo: ${dashboard.filters.from} a ${dashboard.filters.to}`,
      `Status: ${recurringStatusLabel(dashboard.filters.recurringStatus)}`,
    ],
    metaRight: [`Gerado em: ${formatDateTime(new Date())}`],
  });

  drawGroupedBarChartCard(page2, {
    x: PAGE_MARGIN,
    top: 154,
    width: PAGE_WIDTH - PAGE_MARGIN * 2,
    height: 174,
    title: "Dias com mais pagamentos",
    subtitle: "Contagem de pagamentos por dia da semana",
    data: dashboard.paymentWeekdayDistribution || [],
    xLabelKey: "label",
    yFormatter: (value) => String(Math.round(Number(value || 0))),
    series: [{ key: "count", label: "Pagamentos", color: COLORS.blue }],
  });

  drawTableCard(page2, {
    x: PAGE_MARGIN,
    top: 348,
    width: PAGE_WIDTH - PAGE_MARGIN * 2,
    height: 168,
    title: "Clientes inadimplentes",
    subtitle: "Quem exige acao de cobranca com maior urgencia",
    columns: [
      { label: "Cliente", width: 100, render: (row) => row.customerName || "-" },
      { label: "Recorr.", width: 44, render: (row) => String(row.recurringCount || 0) },
      { label: "Atraso", width: 44, render: (row) => String(row.overdueCount || 0) },
      { label: "Valor", width: 58, render: (row) => money(row.overdueAmountCents) },
      { label: "Maior atraso", width: 60, render: (row) => `${Number(row.maxDelayDays || 0)} dia(s)` },
      { label: "Ult. lembrete", width: 70, render: (row) => row.lastReminderAt ? formatDateTime(row.lastReminderAt) : "Sem envio" },
    ],
    rows: dashboard.delinquentClients || [],
    rowHeight: 22,
  });

  drawTableCard(page2, {
    x: PAGE_MARGIN,
    top: 536,
    width: PAGE_WIDTH - PAGE_MARGIN * 2,
    height: 236,
    title: "Carteira por recorrencia",
    subtitle: "Resumo das automacoes mais relevantes do periodo",
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
  });

  return [page1, page2];
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
