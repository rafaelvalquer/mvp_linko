import { useEffect, useMemo, useRef, useState } from "react";

function onlyDigits(value) {
  return String(value || "").replace(/\D+/g, "");
}

function formatRemaining(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const minutes = String(Math.floor(safe / 60)).padStart(2, "0");
  const seconds = String(safe % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function RegisterEmailCodeModal({
  isOpen,
  email,
  canResendAt,
  onConfirm,
  onResend,
  onClose,
}) {
  const inputRef = useRef(null);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [localError, setLocalError] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (!isOpen) return undefined;

    setCode("");
    setLocalError("");

    const raf = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select?.();
    });

    return () => window.cancelAnimationFrame(raf);
  }, [isOpen, email]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const compute = () => {
      if (!canResendAt) {
        setRemainingSeconds(0);
        return;
      }

      const target = new Date(canResendAt).getTime();
      if (!Number.isFinite(target)) {
        setRemainingSeconds(0);
        return;
      }

      const diffMs = Math.max(0, target - Date.now());
      setRemainingSeconds(Math.ceil(diffMs / 1000));
    };

    compute();
    const timer = window.setInterval(compute, 1000);
    return () => window.clearInterval(timer);
  }, [isOpen, canResendAt]);

  const errorMessage = localError;
  const resendLocked = remainingSeconds > 0;
  const resendLabel = useMemo(() => {
    if (resending) return "Reenviando...";
    if (resendLocked)
      return `Reenviar e-mail em ${formatRemaining(remainingSeconds)}`;
    return "Reenviar e-mail";
  }, [remainingSeconds, resendLocked, resending]);

  if (!isOpen) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    const clean = onlyDigits(code).slice(0, 4);

    if (clean.length !== 4) {
      setLocalError("Digite o código de 4 dígitos.");
      inputRef.current?.focus();
      return;
    }

    setLocalError("");
    setSubmitting(true);

    try {
      await onConfirm?.(clean);
      setCode("");
    } catch (err) {
      setLocalError(err?.message || "Não foi possível confirmar o código.");
      inputRef.current?.focus();
      inputRef.current?.select?.();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (resendLocked || resending) return;

    setLocalError("");
    setResending(true);

    try {
      await onResend?.();
      inputRef.current?.focus();
      inputRef.current?.select?.();
    } catch (err) {
      setLocalError(err?.message || "Não foi possível reenviar o e-mail.");
    } finally {
      setResending(false);
    }
  }

  function handleCodeChange(event) {
    setLocalError("");
    setCode(onlyDigits(event.target.value).slice(0, 4));
  }

  function handlePaste(event) {
    const pasted = onlyDigits(event.clipboardData?.getData("text") || "").slice(
      0,
      4,
    );
    if (!pasted) return;

    event.preventDefault();
    setLocalError("");
    setCode(pasted);
  }

  function handleBackdropClick(event) {
    if (event.target !== event.currentTarget) return;
    if (submitting || resending) return;
    onClose?.();
  }

  function handleKeyDown(event) {
    if (event.key === "Escape" && !submitting && !resending) {
      onClose?.();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/55 px-4"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-code-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="register-code-title"
              className="text-lg font-semibold text-zinc-900"
            >
              Confirmar e-mail
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-500">
              Enviamos um código de 4 dígitos para{" "}
              <span className="font-medium text-zinc-700">{email}</span>.
            </p>
          </div>

          <button
            type="button"
            className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => onClose?.()}
            disabled={submitting || resending}
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor="register-email-code"
              className="text-sm text-zinc-700"
            >
              Código de confirmação
            </label>
            <input
              id="register-email-code"
              ref={inputRef}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:ring-2 focus:ring-zinc-300"
              value={code}
              onChange={handleCodeChange}
              onPaste={handlePaste}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              placeholder="0000"
            />
            <p className="mt-2 text-xs text-zinc-500">
              O código é válido por 10 minutos.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              className="rounded-lg bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={submitting || resending}
            >
              {submitting ? "Confirmando..." : "Confirmar código"}
            </button>

            <button
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={handleResend}
              disabled={submitting || resending || resendLocked}
            >
              {resendLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
