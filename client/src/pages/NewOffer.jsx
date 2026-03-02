import Shell from "../components/layout/Shell.jsx";
import { useMemo, useState, useEffect, useRef } from "react";
import { api } from "../app/api.js";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import { Input, Textarea } from "../components/appui/Input.jsx";
import { useAuth } from "../app/AuthContext.jsx";
import { listClients } from "../app/clientsApi.js";
import { listProducts } from "../app/productsApi.js";

import { MessageCircle } from "lucide-react";

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

export default function NewOffer() {
  const { user, perms } = useAuth();
  const plan = String(
    perms?.plan || user?.plan || user?.workspace?.plan || "start",
  ).toLowerCase();

  // "premium features" agora = pro/business/enterprise (mantém compat com "premium" antigo)
  const isPremium = ["pro", "business", "enterprise"].includes(plan);

  const [form, setForm] = useState({
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
    items: [{ description: "", qty: 1, unitPrice: "0,00" }],

    // payment
    depositEnabled: true,
    depositPct: 30,
    // ✅ duração opcional (somente service)
    durationEnabled: false,
    durationMin: 60,

    // conditions toggles + values
    validityEnabled: false,
    validityDays: 7,

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

    // discount
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

    // freight
    let freightCents = 0;
    if (form.freightEnabled) {
      const f = parseMoneyToCents(form.freightValue);
      if (Number.isFinite(f) && f > 0) freightCents = f;
    }

    const totalCents = Math.max(0, baseCents - discountCents + freightCents);

    // deposit summary
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

  function addItem() {
    setForm((prev) => ({
      ...prev,
      items: [
        ...(prev.items || []),
        { productId: "", description: "", qty: 1, unitPrice: "0,00" },
      ],
    }));
  }

  function pickProductForLine(idx, product) {
    const pid = product?.productId || product?.id || "";
    const name = product?.name || product?.title || product?.description || "";
    const priceCents = Number(product?.priceCents) || 0;

    setForm((prev) => {
      const items = Array.isArray(prev.items) ? [...prev.items] : [];
      const cur = items[idx] || {
        productId: "",
        description: "",
        qty: 1,
        unitPrice: "0,00",
      };
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
        items: items.length
          ? items
          : [{ description: "", qty: 1, unitPrice: "0,00" }],
      };
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setResult(null);
    setBusy(true);

    try {
      // base validations
      if (!form.customerName.trim())
        throw new Error("Informe o nome do cliente.");

      // deposit validation if enabled
      if (form.depositEnabled) {
        const pct = clampInt(form.depositPct, 0, 100);
        if (!(pct >= 0 && pct <= 100))
          throw new Error("Sinal deve estar entre 0 e 100.");
      }

      // type-specific validations
      if (form.offerType === "service") {
        if (!form.title.trim()) throw new Error("Informe o título do serviço.");
        if (
          !Number.isFinite(calc.serviceBaseCents) ||
          calc.serviceBaseCents <= 0
        )
          throw new Error("Informe um valor válido.");
        if (!Number.isFinite(calc.totalCents) || calc.totalCents <= 0)
          throw new Error("Total do orçamento inválido.");

        if (form.durationEnabled) {
          const d = clampInt(form.durationMin, 1);
          if (!Number.isFinite(d) || d <= 0)
            throw new Error("Informe uma duração válida.");
        }
      } else {
        const items = Array.isArray(form.items) ? form.items : [];
        if (items.length < 1) throw new Error("Adicione pelo menos 1 item.");
        for (let i = 0; i < calc.lines.length; i++) {
          const l = calc.lines[i];
          if (!l.description.trim())
            throw new Error(`Item ${i + 1}: informe a descrição.`);
          if (!(l.qty >= 1))
            throw new Error(`Item ${i + 1}: quantidade inválida.`);
          if (!Number.isFinite(l.unitPriceCents) || l.unitPriceCents <= 0)
            throw new Error(`Item ${i + 1}: valor unitário inválido.`);
        }
        if (!Number.isFinite(calc.totalCents) || calc.totalCents <= 0)
          throw new Error("Total do orçamento inválido.");
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
        customerName: form.customerName,
        customerWhatsApp: form.customerWhatsApp,
        notifyWhatsAppOnPaid: !!form.notifyWhatsAppOnPaid,

        // ✅ envia snapshot + vínculo
        customerId: isPremium ? form.customerId || null : null,
        customerEmail: isPremium ? String(form.customerEmail || "").trim() : "",
        customerDoc: isPremium ? onlyDigits(form.customerDoc) : "",

        offerType: form.offerType,

        // keep compatibility
        title:
          form.offerType === "service" ? form.title : form.title || "Orçamento",
        description:
          form.offerType === "service"
            ? form.description
            : form.description || "",

        amountCents: calc.totalCents,

        depositEnabled: !!form.depositEnabled,
        // safer compatibility: always a number
        depositPct: form.depositEnabled ? clampInt(form.depositPct, 0, 100) : 0,

        // ✅ duração (somente service, opcional)
        durationEnabled:
          form.offerType === "service" ? !!form.durationEnabled : false,
        durationMin:
          form.offerType === "service" && form.durationEnabled
            ? clampInt(form.durationMin, 1)
            : null,

        // optional computed
        subtotalCents: calc.baseCents,
        discountCents: form.discountEnabled ? calc.discountCents : null,
        freightCents: form.freightEnabled ? calc.freightCents : null,
        totalCents: calc.totalCents,

        // ✅ condições (com flags + valores)
        validityEnabled: !!form.validityEnabled,
        validityDays: form.validityEnabled
          ? clampInt(form.validityDays, 1)
          : null,

        deliveryEnabled: !!form.deliveryEnabled,
        deliveryText: form.deliveryEnabled
          ? String(form.deliveryText || "").trim()
          : null,

        warrantyEnabled: !!form.warrantyEnabled,
        warrantyText: form.warrantyEnabled
          ? String(form.warrantyText || "").trim()
          : null,

        notesEnabled: !!form.notesEnabled,
        conditionsNotes: form.notesEnabled
          ? String(form.conditionsNotes || "").trim()
          : null,

        discountEnabled: !!form.discountEnabled,
        discountType: form.discountEnabled ? form.discountType : null,
        discountValue: form.discountEnabled
          ? String(form.discountValue || "")
          : null,

        freightEnabled: !!form.freightEnabled,
        freightValue: form.freightEnabled
          ? String(form.freightValue || "")
          : null,

        discount: form.discountEnabled
          ? {
              type: form.discountType,
              value:
                form.discountType === "pct"
                  ? Number(String(form.discountValue).replace(",", "."))
                  : parseMoneyToCents(form.discountValue),
            }
          : null,

        freight: form.freightEnabled
          ? parseMoneyToCents(form.freightValue)
          : null,
      };

      if (form.offerType === "product") {
        payload.items = calc.lines.map((l) => ({
          description: l.description,
          qty: l.qty,
          unitPriceCents: l.unitPriceCents,
          lineTotalCents: l.lineTotalCents,
        }));
      }

      const res = await api("/offers", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setResult(res);
    } catch (e2) {
      setErr(e2.message || "Erro");
    } finally {
      setBusy(false);
    }
  }

  const isProduct = form.offerType === "product";

  const offerPublicUrl = result?.offer?.publicToken
    ? `${window.location.origin}/p/${result.offer.publicToken}`
    : "";

  const waShareUrl = offerPublicUrl
    ? buildWaMeLink({
        phoneRaw: form.customerWhatsApp,
        offerUrl: offerPublicUrl,
      })
    : "";

  return (
    <Shell>
      <div className="space-y-4">
        <PageHeader
          title="Nova proposta"
          subtitle="Crie o orçamento e gere um link único para o cliente aceitar e pagar."
          actions={
            <Button
              variant="secondary"
              type="button"
              onClick={() => history.back()}
            >
              Voltar
            </Button>
          }
        />

        <form onSubmit={onSubmit} className="space-y-4">
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
                      const digits = onlyDigits(e.target.value).slice(0, 14);
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
                    <div className="mt-1 text-xs text-red-600">{docError}</div>
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
                              c?.name || c?.fullName || c?.customerName || "";
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
                                    <span className="truncate">{phone}</span>
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
                    Ao digitar um CPF/CNPJ cadastrado, o nome e WhatsApp serão
                    preenchidos.
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
                  <div className="mt-1 text-xs text-red-600">{phoneError}</div>
                ) : null}
              </div>

              <div className="mt-3 rounded-xl border bg-zinc-50 p-3">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-emerald-600"
                    checked={!!form.notifyWhatsAppOnPaid}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        notifyWhatsAppOnPaid: e.target.checked,
                      })
                    }
                  />
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      Enviar confirmação de pagamento por WhatsApp
                    </div>
                    <div className="text-xs text-zinc-600">
                      Quando o Pix for confirmado, enviaremos uma mensagem para
                      o cliente.
                    </div>
                    {form.notifyWhatsAppOnPaid &&
                    !onlyDigits(form.customerWhatsApp) ? (
                      <div className="mt-1 text-xs text-amber-700">
                        Para enviar WhatsApp, preencha o WhatsApp do cliente na
                        proposta.
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
                  <span className="font-semibold text-zinc-800">Serviço</span>
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="offerType"
                    checked={form.offerType === "product"}
                    onChange={() => setOfferType("product")}
                  />
                  <span className="font-semibold text-zinc-800">Produto</span>
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
                                      setTimeout(() => setProdOpen(false), 120)
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
                                                    pickProductForLine(idx, p)
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
                                                      Number(p?.priceCents) ||
                                                        0,
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
                                  isPremium ? "sm:col-span-4" : "sm:col-span-6",
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
                                    setTimeout(() => setProdOpen(false), 120)
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
                                                      Number(p?.priceCents) ||
                                                        0,
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
                                  value={it.qty}
                                  onChange={(e) =>
                                    updateItem(idx, {
                                      qty: clampInt(e.target.value, 1),
                                    })
                                  }
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
                  <Button type="button" variant="secondary" onClick={addItem}>
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
                        Ex.: 60 min. Só aparece no link do cliente se habilitar.
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
                          value={form.durationMin}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              durationMin: clampInt(e.target.value, 1),
                            })
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
                      setForm({ ...form, validityEnabled: e.target.checked })
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
                      value={form.validityDays}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          validityDays: clampInt(e.target.value, 1),
                        })
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
                      setForm({ ...form, deliveryEnabled: e.target.checked })
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
                      setForm({ ...form, warrantyEnabled: e.target.checked })
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
                      setForm({ ...form, discountEnabled: e.target.checked })
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
                      placeholder={form.discountType === "pct" ? "10" : "20,00"}
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
                          setForm({ ...form, depositEnabled: e.target.checked })
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
                            value={form.depositPct}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                depositPct: clampInt(e.target.value, 0, 100),
                              })
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

          {err ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {err}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2">
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
            <Button type="submit" disabled={busy}>
              {busy ? "Gerando…" : "Gerar link"}
            </Button>
          </div>

          {/* Adicionamos a div com o ref para o scroll encontrar este lugar */}
          {result?.offer ? (
            <div ref={resultRef} className="pt-4">
              <Card className="border-emerald-200 bg-emerald-50/50">
                <CardHeader
                  title="Link gerado com sucesso!"
                  subtitle="Envie para o cliente e acompanhe o status no painel."
                />
                <CardBody className="space-y-3">
                  <div className="rounded-xl border border-emerald-200 bg-white p-3 text-sm shadow-sm">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                      Link da Proposta
                    </div>
                    <div className="mt-1 font-mono text-sm text-zinc-900 break-all">
                      {window.location.origin}/p/{result.offer.publicToken}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(offerPublicUrl);
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
                      Visualizar Proposta
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
                        window.open(waShareUrl, "_blank", "noopener,noreferrer")
                      }
                    >
                      <span className="inline-flex items-center gap-2">
                        <MessageCircle className="h-4 w-4" />
                        WhatsApp
                      </span>
                    </Button>
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
