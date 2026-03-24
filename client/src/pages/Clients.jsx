// src/pages/Clients.jsx
import { useEffect, useMemo, useState } from "react";
import Shell from "../components/layout/Shell.jsx";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import EmptyState from "../components/appui/EmptyState.jsx";
import { Input } from "../components/appui/Input.jsx";
import { useAuth } from "../app/AuthContext.jsx";
import { useNavigate } from "react-router-dom";

import ClientModal from "../components/clients/ClientModal.jsx";
import * as clientsApi from "../app/clientsApi.js";

function fmtDateTimeBR(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR");
}

export default function Clients() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const { signOut } = useAuth();
  const nav = useNavigate();

  async function load(nextQ = q) {
    try {
      setErr("");
      setLoading(true);
      const d = await clientsApi.listClients({ q: nextQ });
      setItems(Array.isArray(d.items) ? d.items : []);
    } catch (e) {
      if (e?.status === 401) {
        signOut();
        nav(`/login?next=${encodeURIComponent("/clients")}`, { replace: true });
        return;
      }
      setErr(e?.message || "Falha ao carregar clientes.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  // debounce simples
  useEffect(() => {
    const t = setTimeout(() => load(q), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasItems = items.length > 0;

  const subtitle = useMemo(() => {
    return "Cadastre e gerencie os clientes do workspace. Busca por nome, e-mail e CPF/CNPJ.";
  }, []);

  async function onCreate(payload) {
    await clientsApi.createClient(payload);
    await load(q);
  }

  async function onUpdate(payload) {
    if (!editTarget?._id) return;
    await clientsApi.updateClient(editTarget._id, payload);
    await load(q);
  }

  return (
    <Shell>
      <div className="space-y-4">
        <PageHeader
          title="Clientes"
          subtitle={subtitle}
          actions={
            <>
              <Button
                variant="secondary"
                onClick={() => load(q)}
                disabled={loading}
              >
                Atualizar
              </Button>
              <Button
                onClick={() => {
                  setEditTarget(null);
                  setModalOpen(true);
                }}
              >
                Cadastrar cliente
              </Button>
            </>
          }
        />

        <Card>
          <CardHeader
            title="Lista de clientes"
            subtitle="Pesquise por nome, e-mail ou CPF/CNPJ em todo o workspace."
            right={
              <div className="w-72 max-w-full">
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Pesquisar por nome, e-mail, CPF/CNPJ..."
                />
              </div>
            }
          />
          <CardBody className="p-0">
            {err ? (
              <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {err}{" "}
                <button
                  className="ml-2 font-semibold underline"
                  onClick={() => load(q)}
                >
                  Tentar novamente
                </button>
              </div>
            ) : null}

            {loading ? (
              <div className="p-5 space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : !hasItems ? (
              <div className="p-5">
                <EmptyState
                  title="Nenhum cliente cadastrado"
                  description="Cadastre o primeiro cliente do workspace para usar nas propostas."
                  ctaLabel="Cadastrar cliente"
                  onCta={() => {
                    setEditTarget(null);
                    setModalOpen(true);
                  }}
                />
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden sm:block overflow-auto">
                  <table className="w-full min-w-[840px]">
                    <thead className="text-left text-xs font-semibold text-zinc-500">
                      <tr>
                        <th className="border-b px-5 py-3">Cliente</th>
                        <th className="border-b px-5 py-3">Documento</th>
                        <th className="border-b px-5 py-3">Telefone</th>
                        <th className="border-b px-5 py-3">Criado em</th>
                        <th className="border-b px-5 py-3">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {items.map((c) => (
                        <tr key={c._id} className="hover:bg-zinc-50">
                          <td className="border-b px-5 py-4">
                            <div className="font-semibold text-zinc-900">
                              {c.fullName}
                            </div>
                            <div className="text-xs text-zinc-500">
                              {c.email}
                            </div>
                            <div className="mt-1 text-[11px] text-zinc-500">
                              ID:{" "}
                              <span className="font-mono">{c.clientId}</span>
                            </div>
                          </td>
                          <td className="border-b px-5 py-4">
                            {c.cpfCnpj || "—"}
                          </td>
                          <td className="border-b px-5 py-4">
                            {c.phone || "—"}
                          </td>
                          <td className="border-b px-5 py-4 text-zinc-600">
                            {fmtDateTimeBR(c.createdAt)}
                          </td>
                          <td className="border-b px-5 py-4">
                            <Button
                              variant="secondary"
                              type="button"
                              onClick={() => {
                                setEditTarget(c);
                                setModalOpen(true);
                              }}
                            >
                              Editar
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="sm:hidden p-4 space-y-3">
                  {items.map((c) => (
                    <div
                      key={c._id}
                      className="rounded-2xl border bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-zinc-900">
                            {c.fullName}
                          </div>
                          <div className="text-xs text-zinc-500">{c.email}</div>
                        </div>
                        <Button
                          variant="secondary"
                          type="button"
                          onClick={() => {
                            setEditTarget(c);
                            setModalOpen(true);
                          }}
                        >
                          Editar
                        </Button>
                      </div>

                      <div className="mt-3 grid gap-2 text-xs text-zinc-600">
                        <div>
                          <span className="font-semibold text-zinc-700">
                            ID:
                          </span>{" "}
                          <span className="font-mono">{c.clientId}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-zinc-700">
                            CPF/CNPJ:
                          </span>{" "}
                          {c.cpfCnpj || "—"}
                        </div>
                        <div>
                          <span className="font-semibold text-zinc-700">
                            Telefone:
                          </span>{" "}
                          {c.phone || "—"}
                        </div>
                        <div>
                          <span className="font-semibold text-zinc-700">
                            Criado:
                          </span>{" "}
                          {fmtDateTimeBR(c.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardBody>
        </Card>

        <ClientModal
          open={modalOpen}
          mode={editTarget ? "edit" : "create"}
          initial={editTarget}
          onClose={() => setModalOpen(false)}
          onSubmit={editTarget ? onUpdate : onCreate}
        />
      </div>
    </Shell>
  );
}
