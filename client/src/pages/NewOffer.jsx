import Shell from "../components/layout/Shell.jsx";
import { useMemo, useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../app/api.js";
import { createRecurringOffer } from "../app/recurringOffersApi.js";
import { getSettings } from "../app/settingsApi.js";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import { Input, Textarea } from "../components/appui/Input.jsx";
import SummaryAside from "../components/appui/SummaryAside.jsx";
import { useAuth } from "../app/AuthContext.jsx";
import { listClients } from "../app/clientsApi.js";
import { listProducts } from "../app/productsApi.js";
import { canUseRecurringPlan } from "../utils/planFeatures.js";
import {
  canSendWhatsAppRecurringAutoSend,
  getDefaultOfferNotificationFlags,
} from "../utils/notificationSettings.js";

import { AlertTriangle, MessageCircle } from "lucide-react";

function parseMoneyToCents(raw) {
  const s0 = String(raw ?? "").trim();
  if (!s0) return NaN;

  // Accept: "10,50", "10.50", "1.234,56", "1,234.56"
  const hasComma = s0.includes(",");
  const hasDot = s0.includes(".");

  let normalized = s0.replace(/\s/g, "");

  if (hasComma && hasDot) {
    // Decide decimal separator by the last occurrence
    const lastComma = normalized.lastIndexOf(",");
    const lastDot = normalized.lastIndexOf(".");
    const decimalIsComma = lastComma > lastDot;

    if (decimalIsComma) {
      // "1.234,56" -> remove '.' thousands, ',' -> '.'
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      // "1,234.56" -> remove ',' thousands
      normalized = normalized.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    // "1234,56" -> comma decimal
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else {
    // dot decimal or pure digits
    normalized = normalized.replace(/,/g, "");
  }

  const num = Number(normalized);
  if (!Number.isFinite(num)) return NaN;

  return Math.round(num * 100);
}

function centsToMoneyInput(cents) {
  const v = Number.isFinite(cents) ? cents : 0;
  return (v / 100).toFixed(2).replace(".", ",");
}

function onlyDigits(s) {
  return String(s || "").replace(/\D+/g, "");
}

function formatCpfCnpj(raw) {
  const d = onlyDigits(raw).slice(0, 14);
  if (!d) return "";

  // CPF (até 11)
  if (d.length <= 11) {
    const a = d.slice(0, 3);
    const b = d.slice(3, 6);
    const c = d.slice(6, 9);
    const e = d.slice(9, 11);

    let out = a;
    if (b) out += `.${b}`;
    if (c) out += `.${c}`;
    if (e) out += `-${e}`;
    return out;
  }

  // CNPJ (12-14)
  const a = d.slice(0, 2);
  const b = d.slice(2, 5);
  const c = d.slice(5, 8);
  const m = d.slice(8, 12);
  const e = d.slice(12, 14);

  let out = a;
  if (b) out += `.${b}`;
  if (c) out += `.${c}`;
  if (m) out += `/${m}`;
  if (e) out += `-${e}`;
  return out;
}

function isValidCPF(d) {
  if (!/^\d{11}$/.test(d)) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;

  const calc = (base, factor) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += Number(base[i]) * (factor - i);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const d1 = calc(d.slice(0, 9), 10);
  const d2 = calc(d.slice(0, 10), 11);
  return d1 === Number(d[9]) && d2 === Number(d[10]);
}

function isValidCNPJ(d) {
  if (!/^\d{14}$/.test(d)) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;

  const calc = (base, weights) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += Number(base[i]) * weights[i];
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calc(d.slice(0, 12), w1);
  const d2 = calc(d.slice(0, 13), w2);

  return d1 === Number(d[12]) && d2 === Number(d[13]);
}

function getCpfCnpjError(digits, { showIncomplete = false } = {}) {
  const d = onlyDigits(digits);
  if (!d) return "";

  if (d.length === 11) return isValidCPF(d) ? "" : "CPF inválido.";
  if (d.length === 14) return isValidCNPJ(d) ? "" : "CNPJ inválido.";

  if (!showIncomplete) return "";
  return "Informe CPF (11 dígitos) ou CNPJ (14 dígitos).";
}

function formatBRPhone(raw) {
  const d = onlyDigits(raw).slice(0, 11);
  if (!d) return "";

  const ddd = d.slice(0, 2);
  const rest = d.slice(2);

  if (!rest) return ddd;
  if (rest.length <= 5) return `${ddd} ${rest}`;

  const p1 = rest.slice(0, 5);
  const p2 = rest.slice(5, 9);
  return `${ddd} ${p1}${p2 ? `-${p2}` : ""}`;
}

function isValidBRMobile(d) {
  // DDD + 9 + 8 dígitos = 11 (ex: 11 9xxxx-xxxx)
  return /^\d{2}9\d{8}$/.test(d);
}

function getPhoneError(
  digits,
  { required = false, showIncomplete = false } = {},
) {
  const d = onlyDigits(digits);
  if (!d) return required ? "Informe um celular/WhatsApp." : "";

  if (d.length === 11) {
    return isValidBRMobile(d)
      ? ""
      : "Celular inválido. Use DDD + 9 dígitos (ex: 119xxxx-xxxx).";
  }

  if (!showIncomplete) return "";
  return "Celular deve ter 11 dígitos (ex: 119xxxx-xxxx).";
}

function normalizePhoneForWaMe(raw) {
  const digits = onlyDigits(raw);
  if (!digits) return "";

  // Se vier com DDD+numero (10/11 dígitos), assume BR e prefixa 55
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;

  // Se já vier com 55 (12/13 dígitos), mantém
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13))
    return digits;

  // Outros países: mantém somente dígitos
  return digits;
}

function linkTextForWhatsApp(offerUrl) {
  try {
    const u = new URL(offerUrl);
    const host = u.hostname;

    // Se for localhost (sem ponto), force "www.localhost" apenas para linkificar no WhatsApp
    // (OBS: para abrir de verdade no celular, use um domínio real ou IP/Ngrok)
    const isLocalhost = host === "localhost";
    const hostname = isLocalhost
      ? "www.localhost"
      : host.startsWith("www.")
        ? host
        : `www.${host}`;

    const port = u.port ? `:${u.port}` : "";
    return `${hostname}${port}${u.pathname}${u.search}${u.hash}`;
  } catch {
    // fallback simples
    const s = String(offerUrl || "").trim();
    return s.replace(/^https?:\/\//i, "");
  }
}

function buildWaMeLink({ phoneRaw, offerUrl }) {
  const to = normalizePhoneForWaMe(phoneRaw);
  if (!to) return "";

  const waLinkText = linkTextForWhatsApp(offerUrl); // ✅ agora manda "www..."
  const msg = `Segue o link da proposta:\n${waLinkText}`;
  return `https://wa.me/${to}?text=${encodeURIComponent(msg)}`;
}

function formatBRL(cents) {
  const v = Number.isFinite(cents) ? cents : 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v / 100);
}

function clampInt(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  const xi = Math.trunc(x);
  return Math.max(min, max != null ? Math.min(max, xi) : xi);
}

const INTEGER_FIELD_CONFIG = {
  recurringIntervalDays: { min: 1, defaultValue: 30 },
  recurringMaxOccurrences: { min: 1, defaultValue: 12 },
  durationMin: { min: 1, defaultValue: 60 },
  validityDays: { min: 1, defaultValue: 7 },
  depositPct: { min: 0, max: 100, defaultValue: 30 },
};

function sanitizeIntegerInput(raw) {
  return String(raw ?? "").replace(/\D+/g, "");
}

function parseIntegerInput(raw) {
  const digits = sanitizeIntegerInput(raw);
  if (!digits) return null;

  const value = Number.parseInt(digits, 10);
  return Number.isFinite(value) ? value : null;
}

function isIntegerInRange(value, { min = 0, max = null } = {}) {
  if (!Number.isFinite(value)) return false;
  if (value < min) return false;
  if (max != null && value > max) return false;
  return true;
}

function clampIntegerToRange(value, { min = 0, max = null } = {}) {
  return clampInt(value, min, max);
}

function commitIntegerInput(raw, currentValue, config) {
  const fallbackValue = clampIntegerToRange(currentValue, config);
  const parsed = parseIntegerInput(raw);

  if (parsed == null) return fallbackValue;
  if (parsed < config.min) return fallbackValue;

  return clampIntegerToRange(parsed, config);
}

function createOfferItem() {
  return {
    productId: "",
    description: "",
    qty: 1,
    qtyInput: "1",
    qtyPristine: true,
    unitPrice: "0,00",
  };
}

function buildOfferCalc(form) {
  const items = Array.isArray(form.items) ? form.items : [];
  const lines = items.map((it) => {
    const qty = clampInt(it.qty, 1);
    const unitCents = parseMoneyToCents(it.unitPrice);
    const validUnit = Number.isFinite(unitCents) && unitCents > 0;
    const lineTotalCents = validUnit ? qty * unitCents : NaN;
    return {
      description: String(it.description || ""),
      qty,
      unitPrice: String(it.unitPrice || ""),
      unitPriceCents: validUnit ? unitCents : NaN,
      lineTotalCents,
    };
  });

  const subtotalItemsCents = lines.reduce((acc, l) => {
    return acc + (Number.isFinite(l.lineTotalCents) ? l.lineTotalCents : 0);
  }, 0);

  const serviceBaseCents = parseMoneyToCents(form.amount);

  const baseCents =
    form.offerType === "product" ? subtotalItemsCents : serviceBaseCents;

  let discountCents = 0;
  if (form.discountEnabled) {
    if (form.discountType === "pct") {
      const pct = Number(String(form.discountValue).replace(",", "."));
      if (Number.isFinite(pct) && pct > 0) {
        discountCents = Math.round((baseCents * pct) / 100);
      }
    } else {
      const fixed = parseMoneyToCents(form.discountValue);
      if (Number.isFinite(fixed) && fixed > 0) discountCents = fixed;
    }
    if (discountCents < 0) discountCents = 0;
    if (discountCents > baseCents) discountCents = baseCents;
  }

  let freightCents = 0;
  if (form.freightEnabled) {
    const f = parseMoneyToCents(form.freightValue);
    if (Number.isFinite(f) && f > 0) freightCents = f;
  }

  const totalCents = Math.max(0, baseCents - discountCents + freightCents);

  const depositPct = clampInt(form.depositPct, 0, 100);
  const depositCents = form.depositEnabled
    ? Math.round((totalCents * depositPct) / 100)
    : 0;
  const remainingCents = Math.max(0, totalCents - depositCents);

  return {
    lines,
    subtotalItemsCents,
    serviceBaseCents,
    baseCents,
    discountCents,
    freightCents,
    totalCents,
    depositPct,
    depositCents,
    remainingCents,
  };
}

function buildValidationAlertMessage(issues) {
  const uniqueIssues = Array.from(
    new Set(
      (Array.isArray(issues) ? issues : []).filter(
        (issue) => typeof issue === "string" && issue.trim(),
      ),
    ),
  );

  if (!uniqueIssues.length) return "";

  return [
    "Antes de gerar o link, preencha ou corrija os campos abaixo:",
    ...uniqueIssues.map((issue) => `- ${issue}`),
  ].join("\n");
}

function collectOfferValidationIssues(form, calc, creationMode) {
  const issues = [];

  if (!String(form.customerName || "").trim()) {
    issues.push("Nome do cliente");
  }

  if (form.depositEnabled) {
    const pct = clampInt(form.depositPct, 0, 100);
    if (!(pct >= 0 && pct <= 100)) {
      issues.push("Sinal (%)");
    }
  }

  if (form.offerType === "service") {
    if (!String(form.title || "").trim()) {
      issues.push("Titulo do servico");
    }
    if (!Number.isFinite(calc.serviceBaseCents) || calc.serviceBaseCents <= 0) {
      issues.push("Valor do servico");
    }
    if (!Number.isFinite(calc.totalCents) || calc.totalCents <= 0) {
      issues.push("Total do orcamento");
    }

    if (form.durationEnabled) {
      const duration = clampInt(form.durationMin, 1);
      if (!Number.isFinite(duration) || duration <= 0) {
        issues.push("Duracao estimada");
      }
    }
  } else {
    const items = Array.isArray(form.items) ? form.items : [];

    if (items.length < 1) {
      issues.push("Pelo menos 1 item");
    }

    for (let i = 0; i < calc.lines.length; i += 1) {
      const line = calc.lines[i];
      if (!String(line.description || "").trim()) {
        issues.push(`Item ${i + 1}: descricao`);
      }
      if (!(line.qty >= 1)) {
        issues.push(`Item ${i + 1}: quantidade`);
      }
      if (!Number.isFinite(line.unitPriceCents) || line.unitPriceCents <= 0) {
        issues.push(`Item ${i + 1}: valor unitario`);
      }
    }

    if (!Number.isFinite(calc.totalCents) || calc.totalCents <= 0) {
      issues.push("Total do orcamento");
    }
  }

  if (creationMode === "recurring") {
    if (!String(form.recurringName || "").trim()) {
      issues.push("Nome interno da recorrencia");
    }
    if (
      !Number.isFinite(Number(form.recurringIntervalDays)) ||
      Number(form.recurringIntervalDays) < 1
    ) {
      issues.push("Intervalo da recorrencia (dias)");
    }
    if (!String(form.recurringStartDate || "").trim()) {
      issues.push("Data de inicio da recorrencia");
    }
    if (!String(form.recurringTimeOfDay || "").trim()) {
      issues.push("Horario da execucao");
    }
    if (
      form.recurringEndMode === "until_date" &&
      !String(form.recurringEndsAt || "").trim()
    ) {
      issues.push("Data final da recorrencia");
    }
    if (
      form.recurringEndMode === "until_count" &&
      (!Number.isFinite(Number(form.recurringMaxOccurrences)) ||
        Number(form.recurringMaxOccurrences) < 1)
    ) {
      issues.push("Quantidade maxima de cobrancas");
    }
  }

  return issues;
}

function commitNumericDrafts(form) {
  let nextForm = form;

  for (const [field, config] of Object.entries(INTEGER_FIELD_CONFIG)) {
    const inputKey = `${field}Input`;
    const nextValue = commitIntegerInput(form[inputKey], form[field], config);
    const nextInput = String(nextValue);

    if (
      nextValue !== form[field] ||
      nextInput !== String(form[inputKey] ?? "")
    ) {
      if (nextForm === form) nextForm = { ...form };
      nextForm[field] = nextValue;
      nextForm[inputKey] = nextInput;
    }
  }

  if (Array.isArray(form.items)) {
    let items = form.items;
    let itemsChanged = false;

    form.items.forEach((item, idx) => {
      const nextQty = commitIntegerInput(item?.qtyInput, item?.qty, { min: 1 });
      const nextQtyInput = String(nextQty);

      if (
        nextQty !== item?.qty ||
        nextQtyInput !== String(item?.qtyInput ?? "")
      ) {
        if (!itemsChanged) items = [...form.items];
        items[idx] = {
          ...item,
          qty: nextQty,
          qtyInput: nextQtyInput,
        };
        itemsChanged = true;
      }
    });

    if (itemsChanged) {
      if (nextForm === form) nextForm = { ...form };
      nextForm.items = items;
    }
  }

  return nextForm;
}

export default function NewOffer() {
  const { user, perms } = useAuth();
  const [searchParams] = useSearchParams();
  const initialRecurringMode =
    String(searchParams.get("mode") || "")
      .trim()
      .toLowerCase() === "recurring";
  const plan = String(
    perms?.plan || user?.plan || user?.workspace?.plan || "start",
  ).toLowerCase();
  const canUseRecurringFeatures = canUseRecurringPlan(plan);

  // "premium features" agora = pro/business/enterprise (mantém compat com "premium" antigo)
  const isPremium = canUseRecurringFeatures;

  const [form, setForm] = useState({
    creationMode:
      canUseRecurringFeatures && initialRecurringMode ? "recurring" : "single",
    recurringName: "",
    recurringIntervalDays: 30,
    recurringIntervalDaysInput: "30",
    recurringIntervalDaysPristine: true,
    recurringStartDate: new Date().toISOString().slice(0, 10),
    recurringTimeOfDay: "09:00",
    recurringEndMode: "never",
    recurringEndsAt: "",
    recurringMaxOccurrences: 12,
    recurringMaxOccurrencesInput: "12",
    recurringMaxOccurrencesPristine: true,
    recurringGenerateFirstNow: true,
    recurringAutoSendToCustomer: false,
    recurringInitialStatus: "active",

    policyEnabled: false,
    policyText: "",

    customerName: "",
    customerWhatsApp: "",
    notifyWhatsAppOnPaid: false,
    customerId: null,
    customerEmail: "",
    customerDoc: "", // SOMENTE dígitos

    // type
    offerType: "service", // "service" | "product"

    // service fields
    title: "",
    description: "",
    amount: "100.00",

    // product fields
    items: [createOfferItem()],

    // payment
    depositEnabled: true,
    depositPct: 30,
    depositPctInput: "30",
    depositPctPristine: true,
    // ✅ duração opcional (somente service)
    durationEnabled: false,
    durationMin: 60,
    durationMinInput: "60",
    durationMinPristine: true,

    // conditions toggles + values
    validityEnabled: false,
    validityDays: 7,
    validityDaysInput: "7",
    validityDaysPristine: true,

    deliveryEnabled: false,
    deliveryText: "",

    warrantyEnabled: false,
    warrantyText: "",

    notesEnabled: false,
    conditionsNotes: "",

    discountEnabled: false,
    discountType: "fixed", // "fixed" | "pct"
    discountValue: "0,00", // fixed BRL or pct number string

    freightEnabled: false,
    freightValue: "0,00",
  });

  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const [validationIssues, setValidationIssues] = useState([]);
  const [busy, setBusy] = useState(false);

  // Premium: auto-preencher cliente/produto a partir de cadastros
  const [customerDoc, setCustomerDoc] = useState(""); // SOMENTE dígitos
  const [docTouched, setDocTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);

  const docError = useMemo(
    () => getCpfCnpjError(customerDoc, { showIncomplete: docTouched }),
    [customerDoc, docTouched],
  );

  const phoneDigits = onlyDigits(form.customerWhatsApp);
  const phoneError = useMemo(
    () =>
      getPhoneError(phoneDigits, {
        required: !!form.notifyWhatsAppOnPaid,
        showIncomplete: phoneTouched,
      }),
    [phoneDigits, phoneTouched, form.notifyWhatsAppOnPaid],
  );
  const [clientHits, setClientHits] = useState([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);

  const [activeProd, setActiveProd] = useState(null); // { idx, mode: "id"|"name" }
  const [prodHits, setProdHits] = useState([]);
  const [prodLoading, setProdLoading] = useState(false);
  const [prodOpen, setProdOpen] = useState(false);

  const resultRef = useRef(null);
  const notificationPreferenceTouchedRef = useRef({
    notifyWhatsAppOnPaid: false,
    recurringAutoSendToCustomer: false,
  });

  useEffect(() => {
    const nextMode =
      canUseRecurringFeatures && initialRecurringMode ? "recurring" : "single";
    setForm((prev) =>
      prev.creationMode === nextMode
        ? prev
        : { ...prev, creationMode: nextMode },
    );
  }, [canUseRecurringFeatures, initialRecurringMode]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const data = await getSettings();
        if (!alive) return;

        const notificationContext = {
          settings: data?.settings?.notifications || {},
          capabilities: data?.capabilities?.notifications || {},
        };
        const defaultFlags =
          getDefaultOfferNotificationFlags(notificationContext);
        const defaultRecurringAutoSend =
          canSendWhatsAppRecurringAutoSend(notificationContext);

        setForm((prev) => ({
          ...prev,
          notifyWhatsAppOnPaid: notificationPreferenceTouchedRef.current
            .notifyWhatsAppOnPaid
            ? prev.notifyWhatsAppOnPaid
            : defaultFlags.notifyWhatsAppOnPaid,
          recurringAutoSendToCustomer: notificationPreferenceTouchedRef.current
            .recurringAutoSendToCustomer
            ? prev.recurringAutoSendToCustomer
            : defaultRecurringAutoSend,
        }));
      } catch {}
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({
        behavior: "smooth", // Deslize suave
        block: "start", // Alinha no topo da tela
      });
    }
  }, [result]);

  // =========================
  // Premium: auto-preencher Cliente por CPF/CNPJ
  // =========================
  useEffect(() => {
    if (!isPremium) return;

    const q = customerDoc.trim();
    if (onlyDigits(q).length < 6) {
      setClientHits([]);
      return;
    }

    const t = setTimeout(async () => {
      setClientLoading(true);
      try {
        const d = await listClients({ q });
        const items = Array.isArray(d?.items)
          ? d.items
          : Array.isArray(d?.clients)
            ? d.clients
            : [];
        setClientHits(items);

        // match exato por CPF/CNPJ -> auto-preenche
        const qDigits = onlyDigits(q);
        const exact = items.find((c) => {
          const doc = c?.cpfCnpj || c?.cpf_cnpj || c?.doc || c?.document || "";
          return onlyDigits(doc) && onlyDigits(doc) === qDigits;
        });
        if (exact) {
          const id = String(exact?._id || exact?.id || "") || null;

          const name =
            exact?.name || exact?.fullName || exact?.customerName || "";
          const phone =
            exact?.phone || exact?.whatsapp || exact?.customerWhatsApp || "";
          const email = exact?.email || "";
          const docRaw =
            exact?.cpfCnpjDigits ||
            exact?.cpfCnpj ||
            exact?.cpf_cnpj ||
            exact?.doc ||
            exact?.document ||
            "";

          setForm((prev) => ({
            ...prev,
            customerId: id,
            customerName: name || prev.customerName,
            customerWhatsApp: phone || prev.customerWhatsApp,
            customerEmail: String(email || prev.customerEmail || "").trim(),
            customerDoc: onlyDigits(
              docRaw || customerDoc || prev.customerDoc || "",
            ),
          }));
        }
      } catch {
        setClientHits([]);
      } finally {
        setClientLoading(false);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [isPremium, customerDoc]);

  // =========================
  // Premium: sugestões / auto-preencher Produto por ID ou Nome
  // =========================
  useEffect(() => {
    if (!isPremium) return;
    if (!activeProd?.idx && activeProd?.idx !== 0) return;

    const idx = activeProd.idx;
    const mode = activeProd.mode;

    const items = Array.isArray(form.items) ? form.items : [];
    const it = items[idx];
    if (!it) return;

    const qRaw = mode === "id" ? it.productId : it.description;
    const q = String(qRaw || "").trim();

    if ((mode === "id" && q.length < 2) || (mode === "name" && q.length < 3)) {
      setProdHits([]);
      return;
    }

    const t = setTimeout(async () => {
      setProdLoading(true);
      try {
        const d = await listProducts({ q });
        const list = Array.isArray(d?.items)
          ? d.items
          : Array.isArray(d?.products)
            ? d.products
            : [];
        setProdHits(list);

        // buscando por ID: match exato -> auto-preenche
        if (mode === "id") {
          const qn = q.toLowerCase();
          const exact = list.find(
            (p) => String(p?.productId || p?.id || "").toLowerCase() === qn,
          );
          if (exact) {
            pickProductForLine(idx, exact);
          }
        }
      } catch {
        setProdHits([]);
      } finally {
        setProdLoading(false);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [isPremium, activeProd, form.items]);

  const calc = useMemo(() => {
    return buildOfferCalc(form);
  }, [form]);

  function setOfferType(next) {
    setForm((p) => {
      const offerType = next;
      return { ...p, offerType };
    });
  }

  function updateItem(idx, patch) {
    setForm((p) => {
      const items = Array.isArray(p.items) ? [...p.items] : [];
      items[idx] = { ...items[idx], ...patch };
      return { ...p, items };
    });
  }

  function handleStandaloneIntegerFocus(field, event) {
    const pristineKey = `${field}Pristine`;
    if (!form[pristineKey]) return;

    const inputKey = `${field}Input`;
    const defaultValue = INTEGER_FIELD_CONFIG[field]?.defaultValue;

    if (String(form[inputKey] ?? "") === String(defaultValue)) {
      event.target.select();
    }

    setForm((prev) => ({
      ...prev,
      [pristineKey]: false,
    }));
  }

  function handleStandaloneIntegerChange(field, raw) {
    const config = INTEGER_FIELD_CONFIG[field];
    const digits = sanitizeIntegerInput(raw);

    setForm((prev) => {
      const next = {
        ...prev,
        [`${field}Input`]: digits,
        [`${field}Pristine`]: false,
      };
      const parsed = parseIntegerInput(digits);

      if (parsed != null && isIntegerInRange(parsed, config)) {
        next[field] = parsed;
      }

      return next;
    });
  }

  function handleStandaloneIntegerBlur(field) {
    const config = INTEGER_FIELD_CONFIG[field];

    setForm((prev) => {
      const nextValue = commitIntegerInput(
        prev[`${field}Input`],
        prev[field],
        config,
      );

      return {
        ...prev,
        [field]: nextValue,
        [`${field}Input`]: String(nextValue),
      };
    });
  }

  function handleItemQtyFocus(idx, event) {
    const item = form.items?.[idx];
    if (!item?.qtyPristine) return;

    if (String(item.qtyInput ?? item.qty ?? 1) === "1") {
      event.target.select();
    }

    setForm((prev) => {
      const items = Array.isArray(prev.items) ? [...prev.items] : [];
      if (!items[idx]) return prev;

      items[idx] = {
        ...items[idx],
        qtyPristine: false,
      };

      return { ...prev, items };
    });
  }

  function handleItemQtyChange(idx, raw) {
    const digits = sanitizeIntegerInput(raw);

    setForm((prev) => {
      const items = Array.isArray(prev.items) ? [...prev.items] : [];
      const current = items[idx];
      if (!current) return prev;

      const nextItem = {
        ...current,
        qtyInput: digits,
        qtyPristine: false,
      };
      const parsed = parseIntegerInput(digits);

      if (parsed != null && isIntegerInRange(parsed, { min: 1 })) {
        nextItem.qty = parsed;
      }

      items[idx] = nextItem;
      return { ...prev, items };
    });
  }

  function handleItemQtyBlur(idx) {
    setForm((prev) => {
      const items = Array.isArray(prev.items) ? [...prev.items] : [];
      const current = items[idx];
      if (!current) return prev;

      const nextQty = commitIntegerInput(current.qtyInput, current.qty, {
        min: 1,
      });

      items[idx] = {
        ...current,
        qty: nextQty,
        qtyInput: String(nextQty),
      };

      return { ...prev, items };
    });
  }

  function addItem() {
    setForm((prev) => ({
      ...prev,
      items: [...(prev.items || []), createOfferItem()],
    }));
  }

  function pickProductForLine(idx, product) {
    const pid = product?.productId || product?.id || "";
    const name = product?.name || product?.title || product?.description || "";
    const priceCents = Number(product?.priceCents) || 0;

    setForm((prev) => {
      const items = Array.isArray(prev.items) ? [...prev.items] : [];
      const cur = items[idx] || createOfferItem();
      items[idx] = {
        ...cur,
        productId: String(pid || cur.productId || ""),
        description: String(name || cur.description || ""),
        unitPrice: centsToMoneyInput(priceCents),
      };
      return { ...prev, items };
    });

    setProdOpen(false);
  }

  function removeItem(idx) {
    setForm((p) => {
      const items = [...(p.items || [])];
      items.splice(idx, 1);
      return {
        ...p,
        items: items.length ? items : [createOfferItem()],
      };
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setValidationIssues([]);
    setResult(null);
    setBusy(true);

    try {
      const activeForm = commitNumericDrafts(form);
      const activeCalc = buildOfferCalc(activeForm);

      if (activeForm !== form) {
        setForm(activeForm);
      }

      const creationMode = canUseRecurringFeatures
        ? activeForm.creationMode
        : "single";

      const validationIssues = collectOfferValidationIssues(
        activeForm,
        activeCalc,
        creationMode,
      );

      if (validationIssues.length) {
        setValidationIssues(validationIssues);
        return;
      }

      // base validations
      if (!activeForm.customerName.trim())
        throw new Error("Informe o nome do cliente.");

      // deposit validation if enabled
      if (activeForm.depositEnabled) {
        const pct = clampInt(activeForm.depositPct, 0, 100);
        if (!(pct >= 0 && pct <= 100))
          throw new Error("Sinal deve estar entre 0 e 100.");
      }

      // type-specific validations
      if (activeForm.offerType === "service") {
        if (!activeForm.title.trim())
          throw new Error("Informe o título do serviço.");
        if (
          !Number.isFinite(activeCalc.serviceBaseCents) ||
          activeCalc.serviceBaseCents <= 0
        )
          throw new Error("Informe um valor válido.");
        if (
          !Number.isFinite(activeCalc.totalCents) ||
          activeCalc.totalCents <= 0
        )
          throw new Error("Total do orçamento inválido.");

        if (activeForm.durationEnabled) {
          const d = clampInt(activeForm.durationMin, 1);
          if (!Number.isFinite(d) || d <= 0)
            throw new Error("Informe uma duração válida.");
        }
      } else {
        const items = Array.isArray(activeForm.items) ? activeForm.items : [];
        if (items.length < 1) throw new Error("Adicione pelo menos 1 item.");
        for (let i = 0; i < activeCalc.lines.length; i++) {
          const l = activeCalc.lines[i];
          if (!l.description.trim())
            throw new Error(`Item ${i + 1}: informe a descrição.`);
          if (!(l.qty >= 1))
            throw new Error(`Item ${i + 1}: quantidade inválida.`);
          if (!Number.isFinite(l.unitPriceCents) || l.unitPriceCents <= 0)
            throw new Error(`Item ${i + 1}: valor unitário inválido.`);
        }
        if (
          !Number.isFinite(activeCalc.totalCents) ||
          activeCalc.totalCents <= 0
        )
          throw new Error("Total do orçamento inválido.");
      }

      if (creationMode === "recurring") {
        if (!String(activeForm.recurringName || "").trim()) {
          throw new Error("Informe um nome interno para a recorrência.");
        }
        if (
          !Number.isFinite(Number(activeForm.recurringIntervalDays)) ||
          Number(activeForm.recurringIntervalDays) < 1
        ) {
          throw new Error(
            "Informe um intervalo válido em dias para a recorrência.",
          );
        }
        if (!String(activeForm.recurringStartDate || "").trim()) {
          throw new Error("Informe a data de início da recorrência.");
        }
        if (!String(activeForm.recurringTimeOfDay || "").trim()) {
          throw new Error("Informe o horário da execução da recorrência.");
        }
        if (
          activeForm.recurringEndMode === "until_date" &&
          !String(activeForm.recurringEndsAt || "").trim()
        ) {
          throw new Error("Informe a data final da recorrência.");
        }
        if (
          activeForm.recurringEndMode === "until_count" &&
          (!Number.isFinite(Number(activeForm.recurringMaxOccurrences)) ||
            Number(activeForm.recurringMaxOccurrences) < 1)
        ) {
          throw new Error("Informe a quantidade máxima de cobranças.");
        }
      }

      // build payload (send only enabled optional fields)
      const sellerEmail = String(
        user?.email || user?.mail || user?.loginEmail || user?.username || "",
      )
        .trim()
        .toLowerCase();
      const sellerName = String(
        user?.name ||
          user?.fullName ||
          user?.displayName ||
          user?.username ||
          "",
      ).trim();

      const payload = {
        sellerEmail,
        sellerName,
        customerName: activeForm.customerName,
        customerWhatsApp: activeForm.customerWhatsApp,
        notifyWhatsAppOnPaid: !!activeForm.notifyWhatsAppOnPaid,

        // ✅ envia snapshot + vínculo
        customerId: isPremium ? activeForm.customerId || null : null,
        customerEmail: isPremium
          ? String(activeForm.customerEmail || "").trim()
          : "",
        customerDoc: isPremium ? onlyDigits(activeForm.customerDoc) : "",

        offerType: activeForm.offerType,

        // keep compatibility
        title:
          activeForm.offerType === "service"
            ? activeForm.title
            : activeForm.title || "Orçamento",
        description:
          activeForm.offerType === "service"
            ? activeForm.description
            : activeForm.description || "",

        amountCents: activeCalc.totalCents,

        depositEnabled: !!activeForm.depositEnabled,
        // safer compatibility: always a number
        depositPct: activeForm.depositEnabled
          ? clampInt(activeForm.depositPct, 0, 100)
          : 0,

        // ✅ duração (somente service, opcional)
        durationEnabled:
          activeForm.offerType === "service"
            ? !!activeForm.durationEnabled
            : false,
        durationMin:
          activeForm.offerType === "service" && activeForm.durationEnabled
            ? clampInt(activeForm.durationMin, 1)
            : null,

        // optional computed
        subtotalCents: activeCalc.baseCents,
        discountCents: activeForm.discountEnabled
          ? activeCalc.discountCents
          : null,
        freightCents: activeForm.freightEnabled
          ? activeCalc.freightCents
          : null,
        totalCents: activeCalc.totalCents,

        // ✅ condições (com flags + valores)
        validityEnabled: !!activeForm.validityEnabled,
        validityDays: activeForm.validityEnabled
          ? clampInt(activeForm.validityDays, 1)
          : null,

        deliveryEnabled: !!activeForm.deliveryEnabled,
        deliveryText: activeForm.deliveryEnabled
          ? String(activeForm.deliveryText || "").trim()
          : null,

        warrantyEnabled: !!activeForm.warrantyEnabled,
        warrantyText: activeForm.warrantyEnabled
          ? String(activeForm.warrantyText || "").trim()
          : null,

        notesEnabled: !!activeForm.notesEnabled,
        conditionsNotes: activeForm.notesEnabled
          ? String(activeForm.conditionsNotes || "").trim()
          : null,

        discountEnabled: !!activeForm.discountEnabled,
        discountType: activeForm.discountEnabled
          ? activeForm.discountType
          : null,
        discountValue: activeForm.discountEnabled
          ? String(activeForm.discountValue || "")
          : null,

        freightEnabled: !!activeForm.freightEnabled,
        freightValue: activeForm.freightEnabled
          ? String(activeForm.freightValue || "")
          : null,

        discount: activeForm.discountEnabled
          ? {
              type: activeForm.discountType,
              value:
                activeForm.discountType === "pct"
                  ? Number(String(activeForm.discountValue).replace(",", "."))
                  : parseMoneyToCents(activeForm.discountValue),
            }
          : null,

        freight: activeForm.freightEnabled
          ? parseMoneyToCents(activeForm.freightValue)
          : null,
      };

      if (activeForm.offerType === "product") {
        payload.items = activeCalc.lines.map((l) => ({
          description: l.description,
          qty: l.qty,
          unitPriceCents: l.unitPriceCents,
          lineTotalCents: l.lineTotalCents,
        }));
      }

      if (creationMode === "recurring") {
        const startsAt = new Date(
          `${activeForm.recurringStartDate}T${activeForm.recurringTimeOfDay}:00`,
        );

        const recurringPayload = {
          ...payload,
          name: String(activeForm.recurringName || "").trim(),
          status: String(activeForm.recurringInitialStatus || "active")
            .trim()
            .toLowerCase(),
          recurrence: {
            intervalDays: clampInt(activeForm.recurringIntervalDays, 1),
            startsAt: startsAt.toISOString(),
            timeOfDay: String(activeForm.recurringTimeOfDay || "09:00"),
            endMode: String(activeForm.recurringEndMode || "never"),
            endsAt:
              activeForm.recurringEndMode === "until_date" &&
              activeForm.recurringEndsAt
                ? new Date(
                    `${activeForm.recurringEndsAt}T${activeForm.recurringTimeOfDay}:00`,
                  ).toISOString()
                : null,
            maxOccurrences:
              activeForm.recurringEndMode === "until_count"
                ? clampInt(activeForm.recurringMaxOccurrences, 1)
                : null,
          },
          automation: {
            generateFirstNow: !!activeForm.recurringGenerateFirstNow,
            autoSendToCustomer: !!activeForm.recurringAutoSendToCustomer,
          },
        };

        const res = await createRecurringOffer(recurringPayload);
        setResult({ ...res, kind: "recurring" });
      } else {
        const res = await api("/offers", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        setResult({ ...res, kind: "single" });
      }
    } catch (e2) {
      setValidationIssues([]);
      setErr(e2.message || "Erro");
    } finally {
      setBusy(false);
    }
  }

  const isProduct = form.offerType === "product";
  const isRecurring =
    canUseRecurringFeatures && form.creationMode === "recurring";

  const createdRecurring = result?.recurring || null;
  const createdOffer = result?.firstOffer || result?.offer || null;

  const offerPublicUrl = createdOffer?.publicToken
    ? `${window.location.origin}/p/${createdOffer.publicToken}`
    : "";

  const waShareUrl = offerPublicUrl
    ? buildWaMeLink({
        phoneRaw: form.customerWhatsApp,
        offerUrl: offerPublicUrl,
      })
    : "";

  const primaryActionLabel = busy
    ? isRecurring
      ? "Criando recorrencia..."
      : "Gerando..."
    : isRecurring
      ? "Criar recorrencia"
      : "Gerar link";

  function renderValidationAlert() {
    if (!validationIssues.length) return null;

    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
          <div className="min-w-0">
            <div className="text-sm font-semibold">
              Antes de gerar o link, revise os campos abaixo
            </div>
            <ul className="mt-2 space-y-1 text-sm leading-5">
              {validationIssues.map((issue) => (
                <li key={issue}>- {issue}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  function renderProposalActions({ className = "", embedded = false } = {}) {
    return (
      <div
        className={[
          embedded ? "space-y-3" : "surface-panel space-y-3 px-4 py-4",
          className,
        ].join(" ")}
      >
        {renderValidationAlert()}

        {err ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
            {err}
          </div>
        ) : null}

        <div className="grid gap-2">
          <Button
            variant="secondary"
            type="button"
            onClick={() =>
              setForm((p) => ({
                ...p,
                description: "",
                conditionsNotes: "",
              }))
            }
          >
            Limpar textos
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-[1380px] space-y-5">
        <PageHeader
          eyebrow="Nova venda"
          title="Nova proposta"
          subtitle="Crie o orçamento e gere um link único para o cliente aceitar e pagar."
          actions={
            <Button
              variant="secondary"
              size="md"
              type="button"
              onClick={() => history.back()}
            >
              Voltar
            </Button>
          }
        />

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
            <div className="space-y-4 lg:col-span-8 2xl:col-span-9">
              {canUseRecurringFeatures ? (
                <Card>
                  <CardHeader
                    title="Tipo de criação"
                    subtitle="Escolha se deseja gerar uma proposta avulsa ou configurar uma cobrança recorrente."
                  />
                  <CardBody className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            creationMode: "single",
                          }))
                        }
                        className={`rounded-2xl border p-4 text-left transition-colors ${
                          form.creationMode === "single"
                            ? "border-emerald-300 bg-emerald-50"
                            : "border-zinc-200 bg-white hover:bg-zinc-50"
                        }`}
                      >
                        <div className="text-sm font-semibold text-zinc-900">
                          Proposta avulsa
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          Mantém o fluxo atual da plataforma e gera uma única
                          proposta.
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            creationMode: "recurring",
                          }))
                        }
                        className={`rounded-2xl border p-4 text-left transition-colors ${
                          form.creationMode === "recurring"
                            ? "border-emerald-300 bg-emerald-50"
                            : "border-zinc-200 bg-white hover:bg-zinc-50"
                        }`}
                      >
                        <div className="text-sm font-semibold text-zinc-900">
                          Cobrança recorrente
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          Cria uma automação que gera novas propostas ao longo
                          do tempo.
                        </div>
                      </button>
                    </div>
                  </CardBody>
                </Card>
              ) : null}

              {/* Cliente */}
              <Card>
                <CardHeader
                  title="Cliente"
                  subtitle="Dados básicos para identificação e confirmação."
                />
                <CardBody
                  className={[
                    "grid grid-cols-1 gap-3",
                    isPremium ? "sm:grid-cols-3" : "sm:grid-cols-2",
                  ].join(" ")}
                >
                  <div>
                    <label className="text-xs font-semibold text-zinc-600">
                      Nome
                    </label>
                    <Input
                      value={form.customerName}
                      onChange={(e) =>
                        setForm({ ...form, customerName: e.target.value })
                      }
                      placeholder="Ex.: João Silva"
                    />
                  </div>

                  {isPremium ? (
                    <div className="relative">
                      <label className="text-xs font-semibold text-zinc-600">
                        CPF/CNPJ (Premium)
                      </label>
                      <Input
                        value={formatCpfCnpj(customerDoc)}
                        onChange={(e) => {
                          const digits = onlyDigits(e.target.value).slice(
                            0,
                            14,
                          );
                          setCustomerDoc(digits);
                          setClientOpen(true);
                          setForm((prev) => ({ ...prev, customerDoc: digits }));
                        }}
                        onFocus={() => setClientOpen(true)}
                        onBlur={() => {
                          setDocTouched(true);
                          setTimeout(() => setClientOpen(false), 120);
                        }}
                        placeholder="CPF: XXX.XXX.XXX-XX ou CNPJ: XX.XX.XXX/0001-00"
                        inputMode="numeric"
                      />

                      {docError ? (
                        <div className="mt-1 text-xs text-red-600">
                          {docError}
                        </div>
                      ) : null}

                      {clientOpen ? (
                        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
                          <div className="px-3 py-2 text-xs text-zinc-500 border-b border-zinc-100 flex items-center justify-between">
                            <span>Clientes encontrados</span>
                            {clientLoading ? (
                              <span className="animate-pulse">Buscando...</span>
                            ) : null}
                          </div>
                          <div className="max-h-56 overflow-auto">
                            {(clientHits || []).length ? (
                              (clientHits || []).slice(0, 20).map((c) => {
                                const doc =
                                  c?.cpfCnpj ||
                                  c?.cpf_cnpj ||
                                  c?.doc ||
                                  c?.document ||
                                  "";
                                const phone =
                                  c?.phone ||
                                  c?.whatsapp ||
                                  c?.customerWhatsApp ||
                                  "";
                                const name =
                                  c?.name ||
                                  c?.fullName ||
                                  c?.customerName ||
                                  "";
                                const key =
                                  c?._id || c?.id || `${name}-${doc}-${phone}`;
                                return (
                                  <button
                                    key={key}
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                      const id =
                                        String(c?._id || c?.id || "") || null;
                                      const doc =
                                        c?.cpfCnpjDigits ||
                                        c?.cpfCnpj ||
                                        c?.cpf_cnpj ||
                                        c?.doc ||
                                        c?.document ||
                                        "";
                                      const phone =
                                        c?.phone ||
                                        c?.whatsapp ||
                                        c?.customerWhatsApp ||
                                        "";
                                      const name =
                                        c?.name ||
                                        c?.fullName ||
                                        c?.customerName ||
                                        "";
                                      const email = c?.email || "";

                                      setForm((prev) => ({
                                        ...prev,
                                        customerId: id,
                                        customerName: name || prev.customerName,
                                        customerWhatsApp:
                                          phone || prev.customerWhatsApp,
                                        customerEmail: String(
                                          email || prev.customerEmail || "",
                                        ).trim(),
                                        customerDoc: onlyDigits(
                                          doc ||
                                            customerDoc ||
                                            prev.customerDoc ||
                                            "",
                                        ),
                                      }));

                                      setCustomerDoc(
                                        onlyDigits(doc || customerDoc || ""),
                                      );
                                      setClientOpen(false);
                                    }}
                                    className="w-full px-3 py-2 text-left hover:bg-zinc-50"
                                  >
                                    <div className="text-sm font-medium text-zinc-900 truncate">
                                      {name || "—"}
                                    </div>
                                    <div className="text-xs text-zinc-500 flex gap-2">
                                      <span className="font-mono">
                                        {doc || "sem doc"}
                                      </span>
                                      {phone ? (
                                        <span className="truncate">
                                          {phone}
                                        </span>
                                      ) : null}
                                    </div>
                                  </button>
                                );
                              })
                            ) : (
                              <div className="px-3 py-3 text-sm text-zinc-500">
                                {clientLoading
                                  ? "Buscando clientes..."
                                  : "Nenhum cliente encontrado."}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-1 text-[11px] text-zinc-500">
                        Ao digitar um CPF/CNPJ cadastrado, o nome e WhatsApp
                        serão preenchidos.
                      </div>
                    </div>
                  ) : null}

                  <div>
                    <label className="text-xs font-semibold text-zinc-600">
                      WhatsApp (opcional)
                    </label>
                    <Input
                      value={formatBRPhone(form.customerWhatsApp)}
                      onChange={(e) => {
                        const digits = onlyDigits(e.target.value).slice(0, 11);
                        setForm({ ...form, customerWhatsApp: digits });
                      }}
                      onBlur={() => setPhoneTouched(true)}
                      placeholder="11 99999-9999"
                      inputMode="numeric"
                      autoComplete="tel"
                    />

                    {phoneError ? (
                      <div className="mt-1 text-xs text-red-600">
                        {phoneError}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 rounded-xl border bg-zinc-50 p-3">
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 accent-emerald-600"
                        checked={!!form.notifyWhatsAppOnPaid}
                        onChange={(e) => {
                          notificationPreferenceTouchedRef.current.notifyWhatsAppOnPaid = true;
                          setForm({
                            ...form,
                            notifyWhatsAppOnPaid: e.target.checked,
                          });
                        }}
                      />
                      <div>
                        <div className="text-sm font-semibold text-zinc-900">
                          Enviar confirmação de pagamento por WhatsApp
                        </div>
                        <div className="text-xs text-zinc-600">
                          Quando o Pix for confirmado, enviaremos uma mensagem
                          para o cliente.
                        </div>
                        {form.notifyWhatsAppOnPaid &&
                        !onlyDigits(form.customerWhatsApp) ? (
                          <div className="mt-1 text-xs text-amber-700">
                            Para enviar WhatsApp, preencha o WhatsApp do cliente
                            na proposta.
                          </div>
                        ) : null}
                      </div>
                    </label>
                  </div>
                </CardBody>
              </Card>

              {/* Tipo de orçamento */}
              <Card>
                <CardHeader
                  title="Tipo de orçamento"
                  subtitle="Escolha o layout: serviço simples ou itens de produto."
                />
                <CardBody>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="offerType"
                        checked={form.offerType === "service"}
                        onChange={() => setOfferType("service")}
                      />
                      <span className="font-semibold text-zinc-800">
                        Serviço
                      </span>
                    </label>

                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="offerType"
                        checked={form.offerType === "product"}
                        onChange={() => setOfferType("product")}
                      />
                      <span className="font-semibold text-zinc-800">
                        Produto
                      </span>
                    </label>
                  </div>
                </CardBody>
              </Card>

              {/* Serviço (somente service) */}
              {!isProduct ? (
                <Card>
                  <CardHeader
                    title="Serviço"
                    subtitle="O que será feito e observações."
                  />
                  <CardBody className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-zinc-600">
                        Título
                      </label>
                      <Input
                        value={form.title}
                        onChange={(e) =>
                          setForm({ ...form, title: e.target.value })
                        }
                        placeholder="Título do serviço"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-zinc-600">
                        Descrição (opcional)
                      </label>
                      <Textarea
                        className="min-h-[100px]"
                        value={form.description}
                        onChange={(e) =>
                          setForm({ ...form, description: e.target.value })
                        }
                        placeholder="Detalhes, itens/opções, condições específicas…"
                      />
                    </div>
                  </CardBody>
                </Card>
              ) : null}

              {/* Produtos/Itens (somente product) */}
              {isProduct ? (
                <Card>
                  <CardHeader
                    title="Produtos/Itens"
                    subtitle="Adicione itens com quantidade e valor unitário."
                  />
                  <CardBody className="space-y-3">
                    {/* antes era: <div className="overflow-auto rounded-xl border"> */}
                    <div className="rounded-xl border">
                      {/* permite scroll horizontal sem cortar o dropdown na vertical */}
                      <div className="overflow-x-auto overflow-y-visible">
                        {/* dá “respiro” extra para o dropdown */}
                        <div className="min-w-[820px] overflow-visible pb-10">
                          <div className="grid grid-cols-12 gap-2 border-b bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-600">
                            <div className="col-span-6">Descrição</div>
                            <div className="col-span-2">Qtd</div>
                            <div className="col-span-2">Vlr unit.</div>
                            <div className="col-span-2">Total</div>
                          </div>

                          <div className="divide-y">
                            {(form.items || []).map((it, idx) => {
                              const line = calc.lines[idx];
                              const lineTotal = Number.isFinite(
                                line?.lineTotalCents,
                              )
                                ? formatBRL(line.lineTotalCents)
                                : "—";

                              return (
                                <div
                                  key={idx}
                                  className="grid grid-cols-12 gap-2 px-3 py-2"
                                >
                                  {isPremium ? (
                                    <div className="col-span-12 sm:col-span-2 relative">
                                      <Input
                                        value={it.productId || ""}
                                        onChange={(e) =>
                                          updateItem(idx, {
                                            productId: e.target.value,
                                          })
                                        }
                                        onFocus={() => {
                                          setActiveProd({ idx, mode: "id" });
                                          setProdOpen(true);
                                        }}
                                        onBlur={() =>
                                          setTimeout(
                                            () => setProdOpen(false),
                                            120,
                                          )
                                        }
                                        placeholder="ID"
                                      />

                                      {prodOpen &&
                                      activeProd?.idx === idx &&
                                      activeProd?.mode === "id" ? (
                                        <div className="absolute z-[80] mt-1 w-[520px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
                                          <div className="px-3 py-2 text-xs text-zinc-500 border-b border-zinc-100 flex items-center justify-between">
                                            <span>Produtos</span>
                                            {prodLoading ? (
                                              <span className="animate-pulse">
                                                Buscando...
                                              </span>
                                            ) : null}
                                          </div>
                                          <div className="max-h-80 overflow-auto">
                                            {(prodHits || []).length ? (
                                              (prodHits || [])
                                                .slice(0, 20)
                                                .map((p) => {
                                                  const pid =
                                                    p?.productId || p?.id || "";
                                                  const name =
                                                    p?.name ||
                                                    p?.title ||
                                                    p?.description ||
                                                    "—";
                                                  const key =
                                                    p?._id ||
                                                    p?.id ||
                                                    `${pid}-${name}`;
                                                  return (
                                                    <button
                                                      key={key}
                                                      type="button"
                                                      onMouseDown={(e) =>
                                                        e.preventDefault()
                                                      }
                                                      onClick={() =>
                                                        pickProductForLine(
                                                          idx,
                                                          p,
                                                        )
                                                      }
                                                      className="w-full px-3 py-2 text-left hover:bg-zinc-50"
                                                    >
                                                      <div className="text-sm font-semibold text-zinc-900 whitespace-normal break-words">
                                                        {pid ? (
                                                          <span className="font-mono mr-2 text-zinc-600">
                                                            {pid}
                                                          </span>
                                                        ) : null}
                                                        {name}
                                                      </div>
                                                      <div className="text-xs text-zinc-500">
                                                        {formatBRL(
                                                          Number(
                                                            p?.priceCents,
                                                          ) || 0,
                                                        )}
                                                      </div>
                                                    </button>
                                                  );
                                                })
                                            ) : (
                                              <div className="px-3 py-3 text-sm text-zinc-500">
                                                {prodLoading
                                                  ? "Buscando produtos..."
                                                  : "Nenhum produto encontrado."}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : null}

                                  <div
                                    className={[
                                      "col-span-12 relative",
                                      isPremium
                                        ? "sm:col-span-4"
                                        : "sm:col-span-6",
                                    ].join(" ")}
                                  >
                                    <Input
                                      value={it.description}
                                      onChange={(e) =>
                                        updateItem(idx, {
                                          description: e.target.value,
                                        })
                                      }
                                      onFocus={() => {
                                        if (isPremium) {
                                          setActiveProd({ idx, mode: "name" });
                                          setProdOpen(true);
                                        }
                                      }}
                                      onBlur={() =>
                                        setTimeout(
                                          () => setProdOpen(false),
                                          120,
                                        )
                                      }
                                      placeholder="Ex.: Parafuso inox 10mm"
                                    />

                                    {isPremium &&
                                    prodOpen &&
                                    activeProd?.idx === idx &&
                                    activeProd?.mode === "name" ? (
                                      <div className="absolute z-[80] mt-1 w-full min-w-[520px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
                                        <div className="px-3 py-2 text-xs text-zinc-500 border-b border-zinc-100 flex items-center justify-between">
                                          <span>Produtos</span>
                                          {prodLoading ? (
                                            <span className="animate-pulse">
                                              Buscando...
                                            </span>
                                          ) : null}
                                        </div>
                                        <div className="max-h-80 overflow-auto">
                                          {(prodHits || []).length ? (
                                            (prodHits || [])
                                              .slice(0, 20)
                                              .map((p) => {
                                                const pid =
                                                  p?.productId || p?.id || "";
                                                const name =
                                                  p?.name ||
                                                  p?.title ||
                                                  p?.description ||
                                                  "—";
                                                const key =
                                                  p?._id ||
                                                  p?.id ||
                                                  `${pid}-${name}`;
                                                return (
                                                  <button
                                                    key={key}
                                                    type="button"
                                                    onMouseDown={(e) =>
                                                      e.preventDefault()
                                                    }
                                                    onClick={() =>
                                                      pickProductForLine(idx, p)
                                                    }
                                                    className="w-full px-3 py-2 text-left hover:bg-zinc-50"
                                                  >
                                                    <div className="text-sm font-semibold text-zinc-900 whitespace-normal break-words">
                                                      {name}
                                                    </div>

                                                    <div className="text-xs text-zinc-500 flex gap-2">
                                                      {pid ? (
                                                        <span className="font-mono">
                                                          {pid}
                                                        </span>
                                                      ) : null}
                                                      <span>
                                                        {formatBRL(
                                                          Number(
                                                            p?.priceCents,
                                                          ) || 0,
                                                        )}
                                                      </span>
                                                    </div>
                                                  </button>
                                                );
                                              })
                                          ) : (
                                            <div className="px-3 py-3 text-sm text-zinc-500">
                                              {prodLoading
                                                ? "Buscando produtos..."
                                                : "Nenhum produto encontrado."}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>

                                  <div className="col-span-2">
                                    <Input
                                      type="number"
                                      min={1}
                                      inputMode="numeric"
                                      value={it.qtyInput ?? String(it.qty ?? 1)}
                                      onFocus={(e) =>
                                        handleItemQtyFocus(idx, e)
                                      }
                                      onChange={(e) =>
                                        handleItemQtyChange(idx, e.target.value)
                                      }
                                      onBlur={() => handleItemQtyBlur(idx)}
                                    />
                                  </div>
                                  <div className="col-span-2">
                                    <Input
                                      value={it.unitPrice}
                                      onChange={(e) =>
                                        updateItem(idx, {
                                          unitPrice: e.target.value,
                                        })
                                      }
                                      placeholder="10,50"
                                    />
                                  </div>
                                  <div className="col-span-2 flex items-center justify-between gap-2">
                                    <div className="text-sm font-semibold text-zinc-900">
                                      {lineTotal}
                                    </div>
                                    <button
                                      type="button"
                                      className="rounded-lg px-2 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
                                      onClick={() => removeItem(idx)}
                                      aria-label={`Remover item ${idx + 1}`}
                                      title="Remover"
                                    >
                                      Remover
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                            <div
                              aria-hidden="true"
                              className="grid grid-cols-12 gap-2 px-3 py-3 pointer-events-none"
                            >
                              {isPremium ? (
                                <div className="col-span-12 sm:col-span-2 h-10" />
                              ) : null}

                              <div
                                className={[
                                  "col-span-12 h-10",
                                  isPremium ? "sm:col-span-4" : "sm:col-span-6",
                                ].join(" ")}
                              />
                              <div className="col-span-2 h-10" />
                              <div className="col-span-2 h-10" />
                              <div className="col-span-2 h-10" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={addItem}
                      >
                        + Adicionar item
                      </Button>
                    </div>

                    <div
                      className="grid grid-cols-1 gap-2 rounded-xl border border-zinc-200 bg-white p-3 text-sm
  sm:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <div className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800/60">
                        <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                          Subtotal
                        </div>
                        <div className="mt-1 font-semibold text-zinc-900 dark:text-zinc-50">
                          {formatBRL(calc.subtotalItemsCents)}
                        </div>
                      </div>

                      <div className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800/60">
                        <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                          Desconto
                        </div>
                        <div className="mt-1 font-semibold text-zinc-900 dark:text-zinc-50">
                          {form.discountEnabled
                            ? `-${formatBRL(calc.discountCents)}`
                            : "—"}
                        </div>
                      </div>

                      <div className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800/60">
                        <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                          Total
                        </div>
                        <div className="mt-1 font-semibold text-zinc-900 dark:text-zinc-50">
                          {formatBRL(calc.totalCents)}
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ) : null}

              {/* Condições (opcional) */}
              <Card>
                <CardHeader
                  title="Condições (opcional)"
                  subtitle="Habilite apenas as seções que deseja incluir no orçamento."
                />
                <CardBody className="space-y-3">
                  {/* ✅ duração estimada (somente service) */}
                  {!isProduct ? (
                    <>
                      <div className="flex items-start justify-between gap-3 rounded-xl border p-3">
                        <div>
                          <div className="text-sm font-semibold text-zinc-900">
                            Duração estimada
                          </div>
                          <div className="text-xs text-zinc-500">
                            Ex.: 60 min. Só aparece no link do cliente se
                            habilitar.
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={!!form.durationEnabled}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                durationEnabled: e.target.checked,
                              })
                            }
                          />
                          <span className="text-zinc-700">Habilitar</span>
                        </label>
                      </div>

                      {form.durationEnabled ? (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div className="sm:col-span-1">
                            <label className="text-xs font-semibold text-zinc-600">
                              Duração estimada (min)
                            </label>
                            <Input
                              type="number"
                              min={1}
                              inputMode="numeric"
                              value={form.durationMinInput}
                              onFocus={(e) =>
                                handleStandaloneIntegerFocus("durationMin", e)
                              }
                              onChange={(e) =>
                                handleStandaloneIntegerChange(
                                  "durationMin",
                                  e.target.value,
                                )
                              }
                              onBlur={() =>
                                handleStandaloneIntegerBlur("durationMin")
                              }
                            />
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  {/* validade */}
                  <div className="flex items-start justify-between gap-3 rounded-xl border p-3">
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">
                        Validade da proposta
                      </div>
                      <div className="text-xs text-zinc-500">
                        Ex.: válida por 7 dias.
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.validityEnabled}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            validityEnabled: e.target.checked,
                          })
                        }
                      />
                      <span className="text-zinc-700">Habilitar</span>
                    </label>
                  </div>
                  {form.validityEnabled ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="sm:col-span-1">
                        <label className="text-xs font-semibold text-zinc-600">
                          Validade (dias)
                        </label>
                        <Input
                          type="number"
                          min={1}
                          inputMode="numeric"
                          value={form.validityDaysInput}
                          onFocus={(e) =>
                            handleStandaloneIntegerFocus("validityDays", e)
                          }
                          onChange={(e) =>
                            handleStandaloneIntegerChange(
                              "validityDays",
                              e.target.value,
                            )
                          }
                          onBlur={() =>
                            handleStandaloneIntegerBlur("validityDays")
                          }
                        />
                      </div>
                    </div>
                  ) : null}

                  {/* prazo */}
                  <div className="flex items-start justify-between gap-3 rounded-xl border p-3">
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">
                        Prazo de entrega
                      </div>
                      <div className="text-xs text-zinc-500">
                        Ex.: 3 dias úteis após pagamento.
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.deliveryEnabled}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            deliveryEnabled: e.target.checked,
                          })
                        }
                      />
                      <span className="text-zinc-700">Habilitar</span>
                    </label>
                  </div>
                  {form.deliveryEnabled ? (
                    <div>
                      <label className="text-xs font-semibold text-zinc-600">
                        Prazo
                      </label>
                      <Input
                        value={form.deliveryText}
                        onChange={(e) =>
                          setForm({ ...form, deliveryText: e.target.value })
                        }
                        placeholder="Ex.: Entrega em até 3 dias úteis"
                      />
                    </div>
                  ) : null}

                  {/* garantia */}
                  <div className="flex items-start justify-between gap-3 rounded-xl border p-3">
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">
                        Garantia
                      </div>
                      <div className="text-xs text-zinc-500">
                        Ex.: 90 dias para defeitos de fabricação.
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.warrantyEnabled}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            warrantyEnabled: e.target.checked,
                          })
                        }
                      />
                      <span className="text-zinc-700">Habilitar</span>
                    </label>
                  </div>
                  {form.warrantyEnabled ? (
                    <div>
                      <label className="text-xs font-semibold text-zinc-600">
                        Garantia
                      </label>
                      <Input
                        value={form.warrantyText}
                        onChange={(e) =>
                          setForm({ ...form, warrantyText: e.target.value })
                        }
                        placeholder="Ex.: Garantia de 90 dias"
                      />
                    </div>
                  ) : null}

                  {/* observações */}
                  <div className="flex items-start justify-between gap-3 rounded-xl border p-3">
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">
                        Observações/condições
                      </div>
                      <div className="text-xs text-zinc-500">
                        Ex.: política de cancelamento, tolerância etc.
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.notesEnabled}
                        onChange={(e) =>
                          setForm({ ...form, notesEnabled: e.target.checked })
                        }
                      />
                      <span className="text-zinc-700">Habilitar</span>
                    </label>
                  </div>
                  {form.notesEnabled ? (
                    <div>
                      <label className="text-xs font-semibold text-zinc-600">
                        Texto
                      </label>
                      <Textarea
                        className="min-h-[100px]"
                        value={form.conditionsNotes}
                        onChange={(e) =>
                          setForm({ ...form, conditionsNotes: e.target.value })
                        }
                        placeholder="Digite as condições adicionais…"
                      />
                    </div>
                  ) : null}

                  {/* desconto */}
                  <div className="flex items-start justify-between gap-3 rounded-xl border p-3">
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">
                        Desconto
                      </div>
                      <div className="text-xs text-zinc-500">
                        Aplicado no total base.
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.discountEnabled}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            discountEnabled: e.target.checked,
                          })
                        }
                      />
                      <span className="text-zinc-700">Habilitar</span>
                    </label>
                  </div>
                  {form.discountEnabled ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <label className="text-xs font-semibold text-zinc-600">
                          Tipo
                        </label>
                        <select
                          className="w-full rounded-xl border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          value={form.discountType}
                          onChange={(e) =>
                            setForm({ ...form, discountType: e.target.value })
                          }
                        >
                          <option value="fixed">Valor fixo (R$)</option>
                          <option value="pct">Percentual (%)</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs font-semibold text-zinc-600">
                          {form.discountType === "pct"
                            ? "Percentual"
                            : "Valor do desconto"}
                        </label>
                        <Input
                          value={form.discountValue}
                          onChange={(e) =>
                            setForm({ ...form, discountValue: e.target.value })
                          }
                          placeholder={
                            form.discountType === "pct" ? "10" : "20,00"
                          }
                        />
                      </div>
                    </div>
                  ) : null}

                  {/* frete */}
                  <div className="flex items-start justify-between gap-3 rounded-xl border p-3">
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">
                        Frete
                      </div>
                      <div className="text-xs text-zinc-500">
                        Adicionado ao total final.
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.freightEnabled}
                        onChange={(e) =>
                          setForm({ ...form, freightEnabled: e.target.checked })
                        }
                      />
                      <span className="text-zinc-700">Habilitar</span>
                    </label>
                  </div>
                  {form.freightEnabled ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="sm:col-span-1">
                        <label className="text-xs font-semibold text-zinc-600">
                          Valor do frete
                        </label>
                        <Input
                          value={form.freightValue}
                          onChange={(e) =>
                            setForm({ ...form, freightValue: e.target.value })
                          }
                          placeholder="15,00"
                        />
                      </div>
                    </div>
                  ) : null}
                </CardBody>
              </Card>

              {isRecurring ? (
                <Card>
                  <CardHeader
                    title="Configuração da recorrência"
                    subtitle="Defina quando a cobrança será gerada e como a automação deve se comportar."
                  />
                  <CardBody className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold text-zinc-600">
                          Nome interno da recorrência
                        </label>
                        <Input
                          value={form.recurringName}
                          onChange={(e) =>
                            setForm({ ...form, recurringName: e.target.value })
                          }
                          placeholder="Ex.: Mensalidade João • Manutenção"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-zinc-600">
                          Repetir a cada (dias)
                        </label>
                        <Input
                          type="number"
                          min={1}
                          inputMode="numeric"
                          value={form.recurringIntervalDaysInput}
                          onFocus={(e) =>
                            handleStandaloneIntegerFocus(
                              "recurringIntervalDays",
                              e,
                            )
                          }
                          onChange={(e) =>
                            handleStandaloneIntegerChange(
                              "recurringIntervalDays",
                              e.target.value,
                            )
                          }
                          onBlur={() =>
                            handleStandaloneIntegerBlur("recurringIntervalDays")
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <label className="text-xs font-semibold text-zinc-600">
                          Data de início
                        </label>
                        <Input
                          type="date"
                          value={form.recurringStartDate}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              recurringStartDate: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-zinc-600">
                          Horário da execução
                        </label>
                        <Input
                          type="time"
                          value={form.recurringTimeOfDay}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              recurringTimeOfDay: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-zinc-600">
                          Status inicial
                        </label>
                        <select
                          className="w-full rounded-xl border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          value={form.recurringInitialStatus}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              recurringInitialStatus: e.target.value,
                            })
                          }
                        >
                          <option value="active">Ativa</option>
                          <option value="draft">Rascunho</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <label className="text-xs font-semibold text-zinc-600">
                          Término
                        </label>
                        <select
                          className="w-full rounded-xl border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          value={form.recurringEndMode}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              recurringEndMode: e.target.value,
                            })
                          }
                        >
                          <option value="never">Sem término</option>
                          <option value="until_date">Até data</option>
                          <option value="until_count">Até X cobranças</option>
                        </select>
                      </div>

                      {form.recurringEndMode === "until_date" ? (
                        <div>
                          <label className="text-xs font-semibold text-zinc-600">
                            Encerrar em
                          </label>
                          <Input
                            type="date"
                            value={form.recurringEndsAt}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                recurringEndsAt: e.target.value,
                              })
                            }
                          />
                        </div>
                      ) : form.recurringEndMode === "until_count" ? (
                        <div>
                          <label className="text-xs font-semibold text-zinc-600">
                            Máximo de cobranças
                          </label>
                          <Input
                            type="number"
                            min={1}
                            inputMode="numeric"
                            value={form.recurringMaxOccurrencesInput}
                            onFocus={(e) =>
                              handleStandaloneIntegerFocus(
                                "recurringMaxOccurrences",
                                e,
                              )
                            }
                            onChange={(e) =>
                              handleStandaloneIntegerChange(
                                "recurringMaxOccurrences",
                                e.target.value,
                              )
                            }
                            onBlur={() =>
                              handleStandaloneIntegerBlur(
                                "recurringMaxOccurrences",
                              )
                            }
                          />
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-500 sm:col-span-2">
                          A recorrência continuará ativa até você pausar ou
                          encerrar manualmente.
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="flex items-start gap-3 rounded-xl border bg-zinc-50 p-3">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 accent-emerald-600"
                          checked={!!form.recurringGenerateFirstNow}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              recurringGenerateFirstNow: e.target.checked,
                            })
                          }
                        />
                        <div>
                          <div className="text-sm font-semibold text-zinc-900">
                            Gerar primeira cobrança imediatamente
                          </div>
                          <div className="text-xs text-zinc-600">
                            Se marcado, a primeira proposta recorrente já será
                            criada ao salvar.
                          </div>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 rounded-xl border bg-zinc-50 p-3">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 accent-emerald-600"
                          checked={!!form.recurringAutoSendToCustomer}
                          onChange={(e) => {
                            notificationPreferenceTouchedRef.current.recurringAutoSendToCustomer = true;
                            setForm({
                              ...form,
                              recurringAutoSendToCustomer: e.target.checked,
                            });
                          }}
                        />
                        <div>
                          <div className="text-sm font-semibold text-zinc-900">
                            Enviar automaticamente ao cliente
                          </div>
                          <div className="text-xs text-zinc-600">
                            Quando a cobrança for gerada, o sistema tentará
                            enviar o link pelo WhatsApp usando o fluxo já
                            existente.
                          </div>
                        </div>
                      </label>
                    </div>
                  </CardBody>
                </Card>
              ) : null}

              {/* Pagamento */}
              <Card>
                <CardHeader
                  title="Pagamento"
                  subtitle="Valor e sinal (se aplicável)."
                />
                <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                  {/* Coluna: Valor */}
                  <div className="sm:col-span-6">
                    <div className="h-full rounded-2xl border bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold text-zinc-600">
                            {isProduct ? "Total do orçamento" : "Valor"}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {isProduct
                              ? "Calculado automaticamente pelos itens."
                              : "Digite o valor do serviço."}
                          </div>
                        </div>

                        {/* Badge do total (sempre visível) */}
                        <div className="rounded-full border bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700">
                          {formatBRL(calc.totalCents)}
                        </div>
                      </div>

                      <div className="mt-3">
                        {isProduct ? (
                          <Input
                            value={formatBRL(calc.totalCents)}
                            readOnly
                            disabled
                          />
                        ) : (
                          <Input
                            value={form.amount}
                            onChange={(e) =>
                              setForm({ ...form, amount: e.target.value })
                            }
                            placeholder="150,00"
                          />
                        )}
                      </div>

                      {!isProduct ? (
                        <div className="mt-2 text-xs text-zinc-500">
                          Total:{" "}
                          <span className="font-semibold text-zinc-900">
                            {formatBRL(calc.totalCents)}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Coluna: Sinal */}
                  <div className="sm:col-span-6">
                    <div className="h-full rounded-2xl border bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold text-zinc-600">
                            Cobrar sinal?
                          </div>
                          <div className="mt-0.5 text-xs text-zinc-500">
                            Se ativado, cobra uma porcentagem agora e o restante
                            depois.
                          </div>
                        </div>

                        {/* Toggle moderno */}
                        <label className="relative inline-flex cursor-pointer items-center">
                          <input
                            type="checkbox"
                            className="peer sr-only"
                            checked={!!form.depositEnabled}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                depositEnabled: e.target.checked,
                              })
                            }
                            aria-label="Cobrar sinal"
                          />
                          <div className="h-6 w-11 rounded-full bg-zinc-200 ring-1 ring-zinc-300 transition peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 peer-checked:bg-emerald-600">
                            <div className="h-5 w-5 translate-x-0.5 translate-y-0.5 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
                          </div>
                        </label>
                      </div>

                      {form.depositEnabled ? (
                        <>
                          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
                            <div className="sm:col-span-1">
                              <label className="text-xs font-semibold text-zinc-600">
                                Sinal (%)
                              </label>
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                inputMode="numeric"
                                value={form.depositPctInput}
                                onFocus={(e) =>
                                  handleStandaloneIntegerFocus("depositPct", e)
                                }
                                onChange={(e) =>
                                  handleStandaloneIntegerChange(
                                    "depositPct",
                                    e.target.value,
                                  )
                                }
                                onBlur={() =>
                                  handleStandaloneIntegerBlur("depositPct")
                                }
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <div className="rounded-xl border bg-zinc-50 p-3">
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <span className="rounded-full border bg-white px-2 py-1 text-zinc-700">
                                    Sinal:{" "}
                                    <span className="font-semibold text-zinc-900">
                                      {formatBRL(calc.depositCents)}
                                    </span>
                                  </span>
                                  <span className="rounded-full border bg-white px-2 py-1 text-zinc-700">
                                    Restante:{" "}
                                    <span className="font-semibold text-zinc-900">
                                      {formatBRL(calc.remainingCents)}
                                    </span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="mt-4 rounded-xl border bg-zinc-50 p-3 text-xs text-zinc-600">
                          Sinal desativado. Total à vista:{" "}
                          <span className="font-semibold text-zinc-900">
                            {formatBRL(calc.totalCents)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>

              <div className="hidden space-y-3 lg:block lg:pt-1">
                {renderValidationAlert()}

                {err ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
                    {err}
                  </div>
                ) : null}

                <div className="flex justify-end gap-3">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        description: "",
                        conditionsNotes: "",
                      }))
                    }
                  >
                    Limpar textos
                  </Button>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={busy}
                    className="min-w-[200px] rounded-2xl px-6"
                  >
                    {primaryActionLabel}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-4 col-span-12 h-fit self-start sticky top-4 2xl:col-span-3">
              <SummaryAside
                title={
                  isRecurring ? "Resumo da recorrencia" : "Resumo da proposta"
                }
                subtitle="Acompanhe o valor final, validade e forma de envio sem rolar a página inteira."
                className=""
                footer={
                  <div className="hidden">
                    {err ? (
                      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
                        {err}
                      </div>
                    ) : null}

                    <div className="hidden grid gap-2">
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            description: "",
                            conditionsNotes: "",
                          }))
                        }
                      >
                        Limpar textos
                      </Button>
                      <Button
                        type="submit"
                        size="lg"
                        disabled={busy}
                        className="hidden"
                      >
                        {busy
                          ? isRecurring
                            ? "Criando recorrência..."
                            : "Gerando..."
                          : isRecurring
                            ? "Criar recorrência"
                            : "Gerar link"}
                      </Button>
                    </div>
                  </div>
                }
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="surface-quiet px-4 py-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      Modo
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
                      {isRecurring ? "Cobrança recorrente" : "Proposta avulsa"}
                    </div>
                  </div>

                  <div className="surface-quiet px-4 py-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      Cliente
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
                      {form.customerName?.trim() ||
                        "Aguardando nome do cliente"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {form.customerWhatsApp
                        ? formatBRPhone(form.customerWhatsApp)
                        : "Sem WhatsApp informado"}
                    </div>
                  </div>
                </div>

                <div className="grid gap-2">
                  <div className="surface-quiet flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        Total
                      </div>
                      <div className="mt-1 text-lg font-black text-slate-950 dark:text-white">
                        {formatBRL(calc.totalCents)}
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                      {isProduct
                        ? `${form.items?.length || 0} item(ns)`
                        : "Servico avulso"}
                    </div>
                  </div>

                  <div className="surface-quiet grid gap-3 px-4 py-3 sm:grid-cols-2 lg:grid-cols-1">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-500 dark:text-slate-400">
                        Desconto
                      </span>
                      <span className="font-semibold text-slate-950 dark:text-white">
                        {form.discountEnabled
                          ? `-${formatBRL(calc.discountCents)}`
                          : "Nao aplicado"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-500 dark:text-slate-400">
                        Frete
                      </span>
                      <span className="font-semibold text-slate-950 dark:text-white">
                        {form.freightEnabled
                          ? formatBRL(calc.freightCents)
                          : "Nao aplicado"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-500 dark:text-slate-400">
                        Sinal
                      </span>
                      <span className="font-semibold text-slate-950 dark:text-white">
                        {form.depositEnabled
                          ? `${form.depositPct}% • ${formatBRL(calc.depositCents)}`
                          : "Nao cobrar"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-500 dark:text-slate-400">
                        Restante
                      </span>
                      <span className="font-semibold text-slate-950 dark:text-white">
                        {form.depositEnabled
                          ? formatBRL(calc.remainingCents)
                          : formatBRL(calc.totalCents)}
                      </span>
                    </div>
                  </div>

                  <div className="surface-quiet px-4 py-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      Condicoes
                    </div>
                    <div className="mt-2 space-y-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500 dark:text-slate-400">
                          Validade
                        </span>
                        <span className="font-semibold text-slate-950 dark:text-white">
                          {form.validityEnabled
                            ? `${form.validityDays} dia(s)`
                            : "Sem prazo informado"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500 dark:text-slate-400">
                          Notificacao WA
                        </span>
                        <span className="font-semibold text-slate-950 dark:text-white">
                          {form.notifyWhatsAppOnPaid ? "Ativa" : "Desativada"}
                        </span>
                      </div>
                      {isRecurring ? (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500 dark:text-slate-400">
                            Envio automatico
                          </span>
                          <span className="font-semibold text-slate-950 dark:text-white">
                            {form.recurringAutoSendToCustomer
                              ? "Ativo"
                              : "Manual"}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </SummaryAside>

              {renderProposalActions({ className: "lg:hidden" })}
            </div>
          </div>

          {result ? (
            <div ref={resultRef} className="pt-4">
              <Card className="border-emerald-200 bg-emerald-50/50">
                <CardHeader
                  title={
                    result?.kind === "recurring"
                      ? "Recorrência criada com sucesso!"
                      : "Link gerado com sucesso!"
                  }
                  subtitle={
                    result?.kind === "recurring"
                      ? "Sua automação foi salva e passará a gerar novas propostas conforme a configuração definida."
                      : "Envie para o cliente e acompanhe o status no painel."
                  }
                />
                <CardBody className="space-y-3">
                  {result?.kind === "recurring" ? (
                    <>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-emerald-200 bg-white p-3 text-sm shadow-sm">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                            Recorrência
                          </div>
                          <div className="mt-1 font-semibold text-zinc-900 break-all">
                            {createdRecurring?.name || form.recurringName}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            A cada {clampInt(form.recurringIntervalDays, 1)}{" "}
                            dias
                          </div>
                        </div>

                        <div className="rounded-xl border border-emerald-200 bg-white p-3 text-sm shadow-sm">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                            Próxima execução
                          </div>
                          <div className="mt-1 font-semibold text-zinc-900 break-all">
                            {createdRecurring?.recurrence?.nextRunAt
                              ? new Date(
                                  createdRecurring.recurrence.nextRunAt,
                                ).toLocaleString("pt-BR", {
                                  timeZone: "America/Sao_Paulo",
                                })
                              : "Sem próxima execução definida"}
                          </div>
                        </div>
                      </div>

                      {createdOffer?.publicToken ? (
                        <div className="rounded-xl border border-emerald-200 bg-white p-3 text-sm shadow-sm">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                            Primeira proposta gerada
                          </div>
                          <div className="mt-1 font-mono text-sm text-zinc-900 break-all">
                            {window.location.origin}/p/
                            {createdOffer.publicToken}
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="rounded-xl border border-emerald-200 bg-white p-3 text-sm shadow-sm">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                        Link da Proposta
                      </div>
                      <div className="mt-1 font-mono text-sm text-zinc-900 break-all">
                        {window.location.origin}/p/{createdOffer?.publicToken}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {result?.kind === "recurring" && createdRecurring?._id ? (
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={() =>
                          (window.location.href = `/offers/recurring/${createdRecurring._id}`)
                        }
                      >
                        Abrir recorrência
                      </Button>
                    ) : null}

                    {createdOffer?.publicToken ? (
                      <>
                        <Button
                          variant="secondary"
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(
                                offerPublicUrl,
                              );
                              alert("Link copiado!");
                            } catch {}
                          }}
                        >
                          Copiar link
                        </Button>

                        <Button
                          variant="ghost"
                          type="button"
                          onClick={() =>
                            window.open(
                              offerPublicUrl,
                              "_blank",
                              "noopener,noreferrer",
                            )
                          }
                        >
                          Visualizar proposta
                        </Button>

                        <Button
                          variant="secondary"
                          type="button"
                          disabled={!waShareUrl}
                          title={
                            waShareUrl
                              ? "Abrir WhatsApp com a mensagem pronta"
                              : "Preencha o WhatsApp do cliente para usar este botão"
                          }
                          onClick={() =>
                            window.open(
                              waShareUrl,
                              "_blank",
                              "noopener,noreferrer",
                            )
                          }
                        >
                          <span className="inline-flex items-center gap-2">
                            <MessageCircle className="h-4 w-4" />
                            WhatsApp
                          </span>
                        </Button>
                      </>
                    ) : null}
                  </div>
                </CardBody>
              </Card>
            </div>
          ) : null}
        </form>
      </div>
    </Shell>
  );
}
