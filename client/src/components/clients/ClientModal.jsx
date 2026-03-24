// src/components/clients/ClientModal.jsx
import { useEffect, useMemo, useState } from "react";
import Button from "../appui/Button.jsx";
import ModalShell from "../appui/ModalShell.jsx";

function onlyDigits(v) {
  return String(v || "").replace(/\D+/g, "");
}

export default function ClientModal({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
}) {
  const isEdit = mode === "edit";

  const init = useMemo(() => {
    const c = initial || {};
    return {
      clientId: c.clientId || "",
      fullName: c.fullName || "",
      email: c.email || "",
      cpfCnpj: c.cpfCnpj || "",
      phone: c.phone || "",
    };
  }, [initial]);

  const [fullName, setFullName] = useState(init.fullName);
  const [email, setEmail] = useState(init.email);
  const [cpfCnpj, setCpfCnpj] = useState(init.cpfCnpj);
  const [phone, setPhone] = useState(init.phone);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setErr("");
    setBusy(false);
    setFullName(init.fullName);
    setEmail(init.email);
    setCpfCnpj(init.cpfCnpj);
    setPhone(init.phone);
  }, [open, init]);

  if (!open) return null;

  async function submit(e) {
    e.preventDefault();
    setErr("");

    if (!fullName.trim()) return setErr("Informe o nome completo.");
    if (!email.trim()) return setErr("Informe o e-mail.");
    if (!cpfCnpj.trim()) return setErr("Informe CPF ou CNPJ.");
    if (!phone.trim()) return setErr("Informe o telefone.");

    // validação leve (não bloqueia 100%, só evita vazio)
    if (onlyDigits(cpfCnpj).length < 11) return setErr("CPF/CNPJ inválido.");
    if (onlyDigits(phone).length < 10) return setErr("Telefone inválido.");

    setBusy(true);
    try {
      await onSubmit({
        fullName: fullName.trim(),
        email: email.trim(),
        cpfCnpj: cpfCnpj.trim(),
        phone: phone.trim(),
      });
      onClose?.();
    } catch (e2) {
      setErr(e2?.message || "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      locked={busy}
      panelClassName="max-w-lg"
    >
      <div className="w-full overflow-hidden rounded-[32px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.94))] shadow-[0_32px_80px_-42px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(9,15,28,0.94))] dark:shadow-[0_32px_80px_-42px_rgba(15,23,42,0.82)]">
        <div className="border-b border-slate-200/80 px-5 py-4 dark:border-white/10">
          <div className="text-lg font-bold text-slate-950 dark:text-white">
            {isEdit ? "Editar cliente" : "Cadastrar cliente"}
          </div>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-300">
            {isEdit
              ? "Atualize os dados do cliente do workspace."
              : "Cadastre um cliente para usar nas propostas do workspace."}
          </div>
        </div>

        <form onSubmit={submit} className="px-5 py-4 space-y-3">
          {isEdit ? (
            <div>
              <label className="text-sm text-zinc-700">ID do cliente</label>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700"
                value={init.clientId || ""}
                readOnly
              />
              <div className="mt-1 text-xs text-zinc-500">
                O ID não pode ser alterado.
              </div>
            </div>
          ) : (
            <div className="rounded-xl border bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
              O ID do cliente será gerado automaticamente após o cadastro.
            </div>
          )}

          {err ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {err}
            </div>
          ) : null}

          <div>
            <label className="text-sm text-zinc-700">Nome completo</label>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-300"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Digite o nome completo"
              required
            />
          </div>

          <div>
            <label className="text-sm text-zinc-700">E-mail</label>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-300"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              type="email"
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm text-zinc-700">CPF ou CNPJ</label>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-300"
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(e.target.value)}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                required
              />
            </div>

            <div>
              <label className="text-sm text-zinc-700">Telefone</label>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-300"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(00) 00000-0000"
                required
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={busy}
            >
              Voltar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Salvando…" : isEdit ? "Salvar" : "Cadastrar"}
            </Button>
          </div>
        </form>
      </div>
    </ModalShell>
  );
}
