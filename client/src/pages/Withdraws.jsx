import { useEffect, useMemo, useState } from "react";

import Shell from "../components/layout/Shell.jsx";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import { Input } from "../components/appui/Input.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import EmptyState from "../components/appui/EmptyState.jsx";

import { useAuth } from "../app/AuthContext.jsx";
import { getWithdraw, listWithdraws } from "../app/withdrawApi.js";

function fmtBRL(cents) {
  const v = Number.isFinite(Number(cents)) ? Number(cents) : 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v / 100);
}

function fmtDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function isNonEmpty(v) {
  return String(v || "").trim().length > 0;
}

function Badge({ tone = "zinc", children }) {
  const map = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    zinc: "bg-zinc-50 text-zinc-700 border-zinc-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
        map[tone] || map.zinc
      }`}
    >
      {children}
    </span>
  );
}

function statusTone(status) {
  const s = String(status || "").toUpperCase();
  if (s.includes("COMPLETE") || s.includes("PAID") || s.includes("SUCCESS"))
    return "emerald";
  if (s.includes("PENDING") || s.includes("HOLD") || s.includes("PROCESS"))
    return "amber";
  if (s.includes("CANCEL") || s.includes("EXPIRE") || s.includes("FAIL"))
    return "red";
  return "blue";
}

function safeCopy(text) {
  const t = String(text || "");
  if (!t) return;
  navigator.clipboard?.writeText?.(t).catch(() => {});
}

function Modal({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40"
        onMouseDown={() => onClose?.()}
      />

      <div className="absolute inset-0 flex items-end justify-center p-3 sm:items-center">
        <div
          className="w-full max-w-2xl overflow-hidden rounded-2xl border bg-white shadow-xl"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-zinc-900">
                {title}
              </div>
              <div className="text-xs text-zinc-500">Detalhes do saque</div>
            </div>
            <Button variant="secondary" type="button" onClick={onClose}>
              Fechar
            </Button>
          </div>
          <div className="max-h-[70vh] overflow-auto p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function Withdraws() {
  const { user, perms } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");

  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detail, setDetail] = useState(null);
  const [debugOpen, setDebugOpen] = useState(false);

  const isAdmin =
    !!perms?.admin ||
    !!perms?.isAdmin ||
    String(user?.role || "").toLowerCase() === "admin";

  async function load() {
    setLoading(true);
    setError("");
    try {
      // carrega mais itens e filtra localmente
      const d = await listWithdraws({ limit: 200 });
      const rows = Array.isArray(d?.items)
        ? d.items
        : Array.isArray(d)
          ? d
          : [];
      rows.sort(
        (a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0),
      );
      setItems(rows);
    } catch (e) {
      setError(e?.message || "Falha ao carregar saques.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const needle = String(q || "")
      .trim()
      .toLowerCase();
    if (!needle) return items;
    return (items || []).filter((w) => {
      const ext = String(w?.externalId || "").toLowerCase();
      const st = String(w?.status || "").toLowerCase();
      const prov = String(w?.providerTransactionId || "").toLowerCase();
      return (
        ext.includes(needle) || st.includes(needle) || prov.includes(needle)
      );
    });
  }, [items, q]);

  async function openDetails(externalId) {
    const id = String(externalId || "");
    if (!id) return;
    setOpen(true);
    setActiveId(id);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    setDebugOpen(false);
    try {
      const w = await getWithdraw(id);
      setDetail(w || null);
    } catch (e) {
      setDetailError(e?.message || "Falha ao carregar detalhes.");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  const count = filtered.length;

  return (
    <Shell>
      <div className="space-y-4">
        <PageHeader
          title="Saques"
          subtitle="Histórico de saques via Pix do seu workspace."
          actions={
            <div className="flex items-center gap-2">
              <Button variant="secondary" type="button" onClick={load}>
                Atualizar
              </Button>
            </div>
          }
        />

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}{" "}
            <button className="ml-2 font-semibold underline" onClick={load}>
              Tentar novamente
            </button>
          </div>
        ) : null}

        <Card>
          <CardHeader
            title="Saques"
            subtitle="Pesquise por ID, status ou transação do provedor."
            right={<div className="text-xs text-zinc-500">{count} itens</div>}
          />
          <CardBody className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="w-full max-w-md">
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar (externalId, status, providerTransactionId)"
                />
              </div>
            </div>

            {loading ? (
              <div className="space-y-3">
                <div className="hidden overflow-hidden rounded-xl border sm:block">
                  <div className="grid grid-cols-12 gap-2 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-600">
                    <div className="col-span-5">ID de pagamento</div>
                    <div className="col-span-2 text-right">Valor</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-2">Criação</div>
                    <div className="col-span-1 text-right">Ações</div>
                  </div>
                  <div className="divide-y bg-white">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-12 gap-2 px-3 py-3"
                      >
                        <div className="col-span-5">
                          <Skeleton className="h-4 w-3/4" />
                        </div>
                        <div className="col-span-2">
                          <Skeleton className="ml-auto h-4 w-1/2" />
                        </div>
                        <div className="col-span-2">
                          <Skeleton className="h-6 w-20" />
                        </div>
                        <div className="col-span-2">
                          <Skeleton className="h-4 w-24" />
                        </div>
                        <div className="col-span-1">
                          <Skeleton className="ml-auto h-8 w-20" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:hidden">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-2xl border bg-white p-4">
                      <Skeleton className="h-4 w-3/4" />
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-4 w-28" />
                      </div>
                      <div className="mt-3">
                        <Skeleton className="h-8 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                title="Nenhum saque encontrado"
                description="Quando você solicitar um saque, ele aparecerá aqui."
              />
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden overflow-hidden rounded-xl border sm:block">
                  <div className="grid grid-cols-12 gap-2 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-600">
                    <div className="col-span-5">ID de pagamento</div>
                    <div className="col-span-2 text-right">Valor</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-2">Criação</div>
                    <div className="col-span-1 text-right">Ações</div>
                  </div>

                  <div className="divide-y bg-white">
                    {filtered.map((w) => {
                      const id = w?.externalId || "";
                      const status = w?.status || "—";
                      const value = fmtBRL(
                        w?.netAmountCents ?? w?.grossAmountCents,
                      );
                      const created = fmtDateTime(w?.createdAt);
                      return (
                        <div
                          key={id}
                          className="grid grid-cols-12 gap-2 px-3 py-3 hover:bg-zinc-50"
                        >
                          <div className="col-span-5 min-w-0">
                            <div className="truncate font-mono text-xs text-zinc-900">
                              {id || "—"}
                            </div>
                            {isNonEmpty(w?.providerTransactionId) ? (
                              <div className="mt-0.5 truncate text-[11px] text-zinc-500">
                                Provider: {w.providerTransactionId}
                              </div>
                            ) : null}
                          </div>
                          <div className="col-span-2 text-right font-semibold text-zinc-900">
                            {value}
                          </div>
                          <div className="col-span-2">
                            <Badge tone={statusTone(status)}>{status}</Badge>
                          </div>
                          <div className="col-span-2 text-xs text-zinc-600">
                            {created || "—"}
                          </div>
                          <div className="col-span-1 flex justify-end">
                            <Button
                              variant="secondary"
                              type="button"
                              onClick={() => openDetails(id)}
                            >
                              Detalhes
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Mobile */}
                <div className="grid grid-cols-1 gap-3 sm:hidden">
                  {filtered.map((w) => {
                    const id = w?.externalId || "";
                    const status = w?.status || "—";
                    const value = fmtBRL(
                      w?.netAmountCents ?? w?.grossAmountCents,
                    );
                    const created = fmtDateTime(w?.createdAt);
                    return (
                      <div key={id} className="rounded-2xl border bg-white p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs text-zinc-500">ID</div>
                            <div className="truncate font-mono text-xs text-zinc-900">
                              {id || "—"}
                            </div>
                          </div>
                          <Badge tone={statusTone(status)}>{status}</Badge>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <div className="text-xs text-zinc-500">Valor</div>
                            <div className="font-semibold text-zinc-900">
                              {value}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-zinc-500">Criação</div>
                            <div className="text-sm text-zinc-800">
                              {created || "—"}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3">
                          <Button
                            variant="secondary"
                            type="button"
                            className="w-full"
                            onClick={() => openDetails(id)}
                          >
                            Detalhes
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardBody>
        </Card>

        <Modal
          open={open}
          title={activeId ? `Saque: ${activeId}` : "Detalhes"}
          onClose={() => setOpen(false)}
        >
          {detailLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : detailError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {detailError}{" "}
              <button
                className="ml-2 font-semibold underline"
                onClick={() => openDetails(activeId)}
              >
                Tentar novamente
              </button>
            </div>
          ) : !detail ? (
            <div className="text-sm text-zinc-600">Nenhum detalhe.</div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border bg-zinc-50 p-4">
                  <div className="text-xs font-semibold text-zinc-600">
                    Status
                  </div>
                  <div className="mt-2">
                    <Badge tone={statusTone(detail.status)}>
                      {detail.status}
                    </Badge>
                  </div>
                  <div className="mt-3 text-xs text-zinc-600">
                    Criado:{" "}
                    <span className="font-semibold">
                      {fmtDateTime(detail.createdAt) || "—"}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-zinc-600">
                    Atualizado:{" "}
                    <span className="font-semibold">
                      {fmtDateTime(detail.updatedAt) || "—"}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-xs font-semibold text-zinc-600">
                    Valores
                  </div>
                  <div className="mt-2 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="text-zinc-600">Bruto</div>
                      <div className="font-semibold text-zinc-900">
                        {fmtBRL(detail.grossAmountCents)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-zinc-600">Taxa</div>
                      <div className="font-semibold text-zinc-900">
                        {fmtBRL(detail.feeCents)}
                        {Number.isFinite(Number(detail.feePct)) ? (
                          <span className="ml-2 text-xs text-zinc-500">
                            ({detail.feePct}%)
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t pt-2">
                      <div className="text-zinc-900">Líquido</div>
                      <div className="text-lg font-semibold text-zinc-900">
                        {fmtBRL(detail.netAmountCents)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-4">
                <div className="text-xs font-semibold text-zinc-600">
                  Pagamento
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-zinc-500">Método</div>
                    <div className="mt-0.5 text-sm font-semibold text-zinc-900">
                      {detail.method || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Provedor</div>
                    <div className="mt-0.5 text-sm font-semibold text-zinc-900">
                      {detail.provider || "—"}
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <div className="text-xs text-zinc-500">ID do provedor</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      <span className="rounded-lg border bg-zinc-50 px-2 py-1 font-mono text-xs text-zinc-900">
                        {detail.providerTransactionId || "—"}
                      </span>
                      {isNonEmpty(detail.providerTransactionId) ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-emerald-700 hover:underline"
                          onClick={() => safeCopy(detail.providerTransactionId)}
                        >
                          Copiar
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-4">
                <div className="text-xs font-semibold text-zinc-600">Pix</div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-zinc-500">Tipo</div>
                    <div className="mt-0.5 text-sm font-semibold text-zinc-900">
                      {detail?.pix?.type || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Chave</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      <span className="rounded-lg border bg-zinc-50 px-2 py-1 font-mono text-xs text-zinc-900">
                        {detail?.pix?.key || "—"}
                      </span>
                      {isNonEmpty(detail?.pix?.key) ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-emerald-700 hover:underline"
                          onClick={() => safeCopy(detail.pix.key)}
                        >
                          Copiar
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {isNonEmpty(detail?.pix?.description) ||
                  isNonEmpty(detail?.description) ? (
                    <div className="sm:col-span-2">
                      <div className="text-xs text-zinc-500">Descrição</div>
                      <div className="mt-0.5 text-sm text-zinc-800">
                        {detail?.pix?.description || detail?.description}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-4">
                <div className="text-xs font-semibold text-zinc-600">
                  Outros
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-zinc-500">Dev mode</div>
                    <div className="mt-0.5 text-sm font-semibold text-zinc-900">
                      {detail.devMode ? "Sim" : "Não"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Comprovante</div>
                    {isNonEmpty(detail.receiptUrl) ? (
                      <a
                        className="mt-0.5 inline-flex text-sm font-semibold text-emerald-700 hover:underline"
                        href={detail.receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir comprovante
                      </a>
                    ) : (
                      <div className="mt-0.5 text-sm text-zinc-600">—</div>
                    )}
                  </div>
                </div>
              </div>

              {(isAdmin || detail.devMode) && detail.gateway ? (
                <div className="rounded-2xl border bg-white p-4">
                  <button
                    type="button"
                    onClick={() => setDebugOpen((v) => !v)}
                    className="flex w-full items-center justify-between"
                  >
                    <div className="text-xs font-semibold text-zinc-600">
                      Debug gateway
                    </div>
                    <span className="text-xs text-zinc-500">
                      {debugOpen ? "Ocultar" : "Mostrar"}
                    </span>
                  </button>
                  {debugOpen ? (
                    <pre className="mt-3 overflow-auto rounded-xl border bg-zinc-50 p-3 text-[11px] text-zinc-800">
                      {JSON.stringify(detail.gateway, null, 2)}
                    </pre>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </Modal>
      </div>
    </Shell>
  );
}
