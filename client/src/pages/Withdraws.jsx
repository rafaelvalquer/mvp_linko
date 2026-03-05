// src/pages/Withdraws.jsx
import { useEffect, useMemo, useState } from "react";
import Shell from "../components/layout/Shell.jsx";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import { Input } from "../components/appui/Input.jsx";
import Badge from "../components/appui/Badge.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import { getPixSettings, updatePixSettings } from "../app/pixSettingsApi.js";

const PAYOUT_PIX_TYPES = ["CPF", "CNPJ", "PHONE", "EMAIL", "EVP"];

export default function Withdraws() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [payoutPixKeyType, setPayoutPixKeyType] = useState("CPF");
  const [payoutPixKeyMasked, setPayoutPixKeyMasked] = useState("");
  const [payoutPixKeyInput, setPayoutPixKeyInput] = useState("");

  const configured = useMemo(
    () => !!String(payoutPixKeyMasked || "").trim(),
    [payoutPixKeyMasked],
  );

  async function load() {
    try {
      setLoading(true);
      setErr("");
      const d = await getPixSettings();
      setPayoutPixKeyType(String(d?.payoutPixKeyType || "CPF"));
      setPayoutPixKeyMasked(String(d?.payoutPixKeyMasked || ""));
    } catch (e) {
      setErr(e?.message || "Falha ao carregar dados da Conta Pix.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onSave() {
    try {
      setSaving(true);
      setErr("");
      const d = await updatePixSettings({
        payoutPixKeyType,
        payoutPixKey: payoutPixKeyInput,
      });

      setPayoutPixKeyType(String(d?.payoutPixKeyType || payoutPixKeyType));
      setPayoutPixKeyMasked(String(d?.payoutPixKeyMasked || ""));
      setPayoutPixKeyInput("");
    } catch (e) {
      setErr(e?.message || "Falha ao salvar chave Pix.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        <PageHeader
          title="Conta Pix"
          subtitle="Configure a chave Pix que aparecerá no pagamento público (Pix direto, sem saques)."
          right={
            <Button variant="secondary" onClick={load} disabled={loading}>
              Atualizar
            </Button>
          }
        />

        <Card className="border-none shadow-sm ring-1 ring-zinc-200">
          <CardHeader
            title="Chave Pix do recebedor"
            subtitle="Essa chave será exibida no link público após o cliente aceitar a proposta."
            right={
              <Badge tone={configured ? "CONFIRMED" : "PENDING"}>
                {configured ? "Configurada" : "Pendente"}
              </Badge>
            }
          />
          <CardBody className="space-y-4">
            {loading ? (
              <Skeleton className="h-28 w-full rounded-xl" />
            ) : (
              <>
                {err ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    {err}
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-1">
                    <div className="text-xs font-semibold text-zinc-600 mb-1">
                      Tipo
                    </div>
                    <select
                      className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm"
                      value={payoutPixKeyType}
                      onChange={(e) => setPayoutPixKeyType(e.target.value)}
                    >
                      {PAYOUT_PIX_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <div className="text-xs font-semibold text-zinc-600 mb-1">
                      Chave Pix
                    </div>
                    <Input
                      value={payoutPixKeyInput}
                      onChange={(e) => setPayoutPixKeyInput(e.target.value)}
                      placeholder="Digite a chave (CPF/CNPJ/Telefone/E-mail/EVP)"
                      className="h-10"
                    />
                    <div className="mt-2 text-xs text-zinc-500">
                      Atual:{" "}
                      <span className="font-semibold text-zinc-800">
                        {payoutPixKeyMasked || "—"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={onSave}
                    disabled={saving || !String(payoutPixKeyInput || "").trim()}
                    className="h-11 px-5"
                  >
                    {saving ? "Salvando..." : "Salvar chave Pix"}
                  </Button>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
                  <div className="font-semibold text-zinc-900 mb-1">
                    Como funciona agora
                  </div>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>O cliente paga diretamente para sua chave Pix.</li>
                    <li>O cliente anexa o comprovante no link público.</li>
                    <li>
                      Você confirma manualmente o recebimento na proposta.
                    </li>
                  </ul>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </Shell>
  );
}
