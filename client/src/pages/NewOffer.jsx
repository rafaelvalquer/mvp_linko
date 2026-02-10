import Shell from "../components/layout/Shell.jsx";
import { useMemo, useState } from "react";
import { api } from "../app/api.js";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import { Input, Textarea } from "../components/appui/Input.jsx";

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
  const [form, setForm] = useState({
    customerName: "",
    customerWhatsApp: "",

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
    setForm((p) => ({
      ...p,
      items: [
        ...(p.items || []),
        { description: "", qty: 1, unitPrice: "0,00" },
      ],
    }));
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
      const payload = {
        customerName: form.customerName,
        customerWhatsApp: form.customerWhatsApp,

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

        durationMin: clampInt(form.durationMin, 1),

        // optional computed
        subtotalCents: calc.baseCents,
        discountCents: form.discountEnabled ? calc.discountCents : null,
        freightCents: form.freightEnabled ? calc.freightCents : null,
        totalCents: calc.totalCents,

        // optional conditions (only if enabled)
        validityDays: form.validityEnabled
          ? clampInt(form.validityDays, 1)
          : null,
        deliveryText: form.deliveryEnabled
          ? String(form.deliveryText || "").trim()
          : null,
        warrantyText: form.warrantyEnabled
          ? String(form.warrantyText || "").trim()
          : null,
        conditionsNotes: form.notesEnabled
          ? String(form.conditionsNotes || "").trim()
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
            <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-zinc-600">
                  Nome
                </label>
                <Input
                  value={form.customerName}
                  onChange={(e) =>
                    setForm({ ...form, customerName: e.target.value })
                  }
                  placeholder="Nome do cliente"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-600">
                  WhatsApp (opcional)
                </label>
                <Input
                  value={form.customerWhatsApp}
                  onChange={(e) =>
                    setForm({ ...form, customerWhatsApp: e.target.value })
                  }
                  placeholder="+55 11 99999-0000"
                />
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
                <div className="overflow-auto rounded-xl border">
                  <div className="min-w-[820px]">
                    <div className="grid grid-cols-12 gap-2 border-b bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-600">
                      <div className="col-span-6">Descrição</div>
                      <div className="col-span-2">Qtd</div>
                      <div className="col-span-2">Vlr unit.</div>
                      <div className="col-span-2">Total</div>
                    </div>

                    <div className="divide-y">
                      {(form.items || []).map((it, idx) => {
                        const line = calc.lines[idx];
                        const lineTotal = Number.isFinite(line?.lineTotalCents)
                          ? formatBRL(line.lineTotalCents)
                          : "—";

                        return (
                          <div
                            key={idx}
                            className="grid grid-cols-12 gap-2 px-3 py-2"
                          >
                            <div className="col-span-6">
                              <Input
                                value={it.description}
                                onChange={(e) =>
                                  updateItem(idx, {
                                    description: e.target.value,
                                  })
                                }
                                placeholder="Ex.: Parafuso inox 10mm"
                              />
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
                                  updateItem(idx, { unitPrice: e.target.value })
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
                    </div>
                  </div>
                </div>

                <div>
                  <Button type="button" variant="secondary" onClick={addItem}>
                    + Adicionar item
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-2 rounded-xl border bg-zinc-50 p-3 text-sm sm:grid-cols-3">
                  <div>
                    <div className="text-xs font-semibold text-zinc-500">
                      Subtotal
                    </div>
                    <div className="mt-1 font-semibold">
                      {formatBRL(calc.subtotalItemsCents)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-500">
                      Desconto
                    </div>
                    <div className="mt-1 font-semibold">
                      {form.discountEnabled
                        ? `-${formatBRL(calc.discountCents)}`
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-500">
                      Total
                    </div>
                    <div className="mt-1 font-semibold">
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

          {/* Pagamento e duração */}
          <Card>
            <CardHeader
              title="Pagamento e duração"
              subtitle="Valor, sinal e tempo estimado."
            />
            <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* Valor */}
              <div>
                <label className="text-xs font-semibold text-zinc-600">
                  {isProduct ? "Total do orçamento" : "Valor"}
                </label>

                {isProduct ? (
                  <Input value={formatBRL(calc.totalCents)} readOnly disabled />
                ) : (
                  <Input
                    value={form.amount}
                    onChange={(e) =>
                      setForm({ ...form, amount: e.target.value })
                    }
                    placeholder="150,00"
                  />
                )}

                {!isProduct ? (
                  <div className="mt-1 text-xs text-zinc-500">
                    Total:{" "}
                    <span className="font-semibold">
                      {formatBRL(calc.totalCents)}
                    </span>
                  </div>
                ) : null}
              </div>

              {/* Sinal toggle + pct */}
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-xl border p-3">
                  <div>
                    <div className="text-xs font-semibold text-zinc-600">
                      Cobrar sinal?
                    </div>
                    <div className="text-xs text-zinc-500">
                      Habilite para coletar % do total.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.depositEnabled}
                    onChange={(e) =>
                      setForm({ ...form, depositEnabled: e.target.checked })
                    }
                    aria-label="Cobrar sinal"
                  />
                </div>

                {form.depositEnabled ? (
                  <div>
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
                    <div className="mt-1 text-xs text-zinc-500">
                      Sinal:{" "}
                      <span className="font-semibold">
                        {formatBRL(calc.depositCents)}
                      </span>{" "}
                      • Restante:{" "}
                      <span className="font-semibold">
                        {formatBRL(calc.remainingCents)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-zinc-500">
                    Sinal desativado. Total à vista:{" "}
                    <span className="font-semibold">
                      {formatBRL(calc.totalCents)}
                    </span>
                  </div>
                )}
              </div>

              {/* Duração */}
              <div>
                <label className="text-xs font-semibold text-zinc-600">
                  Duração (min)
                </label>
                <Input
                  type="number"
                  value={form.durationMin}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      durationMin: clampInt(e.target.value, 1),
                    })
                  }
                />
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

          {result?.offer ? (
            <Card>
              <CardHeader
                title="Link gerado"
                subtitle="Envie para o cliente e acompanhe o status no painel."
              />
              <CardBody className="space-y-3">
                <div className="rounded-xl border bg-zinc-50 p-3 text-sm">
                  <div className="text-xs font-semibold text-zinc-500">
                    Link público
                  </div>
                  <div className="mt-1 font-mono text-sm text-zinc-900">
                    /p/{result.offer.publicToken}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={async () => {
                      const url =
                        window.location.origin +
                        `/p/${result.offer.publicToken}`;
                      try {
                        await navigator.clipboard.writeText(url);
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
                        `/p/${result.offer.publicToken}`,
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                  >
                    Abrir link público
                  </Button>
                </div>
              </CardBody>
            </Card>
          ) : null}
        </form>
      </div>
    </Shell>
  );
}
