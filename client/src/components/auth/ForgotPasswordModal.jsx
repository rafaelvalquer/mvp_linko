import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../app/api.js";

function onlyDigits(value) {
  return String(value || "").replace(/\D+/g, "");
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function hasMinPasswordLength(value) {
  return String(value || "").length >= 8;
}

function hasSpecialPasswordChar(value) {
  return /[^A-Za-z0-9]/.test(String(value || ""));
}

function formatRemaining(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function getApiErrorMessage(
  err,
  fallback = "Não foi possível concluir a recuperação de senha.",
) {
  const code = String(err?.data?.code || "")
    .trim()
    .toUpperCase();

  if (code === "EMAIL_INVALID") return "Informe um e-mail válido.";
  if (code === "ACCOUNT_NOT_FOUND")
    return "Nenhuma conta foi encontrada para este e-mail.";
  if (code === "ACCOUNT_DISABLED")
    return "Esta conta não pode redefinir a senha no momento.";
  if (code === "NO_PASSWORD_RESET_REQUEST")
    return "Solicite um novo código para continuar.";
  if (code === "CODE_INVALID_FORMAT")
    return "Digite o código de 4 dígitos corretamente.";
  if (code === "INVALID_CODE") return "Código inválido.";
  if (code === "CODE_EXPIRED")
    return "O código expirou. Solicite um novo envio.";
  if (code === "CODE_ALREADY_USED")
    return "Este código já foi usado. Solicite um novo envio.";
  if (code === "TOO_MANY_ATTEMPTS")
    return "Muitas tentativas inválidas. Solicite um novo código.";
  if (code === "PASSWORD_RULES_INVALID")
    return "A senha deve ter no mínimo 8 caracteres e pelo menos 1 caractere especial.";
  if (code === "RESEND_COOLDOWN") {
    const seconds = Number(err?.data?.retryAfterSeconds || 60);
    return `Aguarde ${seconds}s para reenviar o código.`;
  }

  return err?.message || fallback;
}

function StepPill({ active, done, children }) {
  return (
    <div
      className={[
        "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
        done
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : active
            ? "border-zinc-900 bg-zinc-900 text-white"
            : "border-zinc-200 bg-zinc-50 text-zinc-500",
      ].join(" ")}
    >
      <span
        className={[
          "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold",
          done
            ? "bg-emerald-100 text-emerald-700"
            : active
              ? "bg-white/15 text-white"
              : "bg-white text-zinc-500",
        ].join(" ")}
      >
        {done ? "✓" : "•"}
      </span>
      {children}
    </div>
  );
}

function RuleItem({ ok, children }) {
  return (
    <div
      className={[
        "flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm transition",
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-zinc-200 bg-zinc-50 text-zinc-600",
      ].join(" ")}
    >
      <span
        className={[
          "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
          ok ? "bg-emerald-100 text-emerald-700" : "bg-white text-zinc-400",
        ].join(" ")}
      >
        {ok ? "✓" : "•"}
      </span>
      <span>{children}</span>
    </div>
  );
}

function PasswordRules({ password }) {
  const minLength = hasMinPasswordLength(password);
  const specialChar = hasSpecialPasswordChar(password);

  return (
    <div className="rounded-3xl border border-zinc-200 bg-zinc-50/80 p-4">
      <div className="mb-3">
        <div className="text-sm font-semibold text-zinc-900">Regras da nova senha</div>
        <div className="mt-1 text-sm text-zinc-500">
          Sua nova senha precisa atender aos requisitos abaixo.
        </div>
      </div>

      <div className="grid gap-3">
        <RuleItem ok={minLength}>Mínimo de 8 caracteres</RuleItem>
        <RuleItem ok={specialChar}>Pelo menos 1 caractere especial</RuleItem>
      </div>
    </div>
  );
}

function Field({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled,
  error,
  hint,
  inputRef,
  maxLength,
  inputMode,
  className = "",
  onPaste,
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-zinc-800">
        {label}
      </label>
      <input
        ref={inputRef}
        className={[
          "w-full rounded-2xl border bg-white px-4 py-3 text-[15px] text-zinc-950 shadow-[0_1px_2px_rgba(24,24,27,0.04)] outline-none transition",
          "placeholder:text-zinc-400",
          error
            ? "border-red-300 ring-4 ring-red-100/70"
            : "border-zinc-200 focus:border-zinc-300 focus:ring-4 focus:ring-zinc-200/60",
          disabled ? "cursor-not-allowed opacity-70" : "",
          className,
        ].join(" ")}
        value={value}
        onChange={onChange}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        maxLength={maxLength}
        inputMode={inputMode}
        onPaste={onPaste}
      />
      {error ? (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-2 text-sm text-zinc-500">{hint}</p>
      ) : null}
    </div>
  );
}

export default function ForgotPasswordModal({
  isOpen,
  initialEmail = "",
  onClose,
  onSuccess,
}) {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [serverState, setServerState] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const emailRef = useRef(null);
  const codeRef = useRef(null);
  const passwordRef = useRef(null);

  const canResendAt = serverState?.canResendAt || null;

  const passwordRules = useMemo(
    () => ({
      minLength: hasMinPasswordLength(newPassword),
      specialChar: hasSpecialPasswordChar(newPassword),
    }),
    [newPassword],
  );

  const canSubmitNewPassword =
    passwordRules.minLength &&
    passwordRules.specialChar &&
    newPassword === confirmPassword &&
    confirmPassword.length > 0;

  useEffect(() => {
    if (!isOpen) return;

    setStep("email");
    setEmail(String(initialEmail || "").trim());
    setCode("");
    setNewPassword("");
    setConfirmPassword("");
    setServerState(null);
    setError("");
    setSubmitting(false);
    setResending(false);
    setRemainingSeconds(0);
  }, [isOpen, initialEmail]);

  useEffect(() => {
    if (!isOpen) return;

    const timer = window.setTimeout(() => {
      if (step === "email") emailRef.current?.focus();
      if (step === "code") codeRef.current?.focus();
      if (step === "reset") passwordRef.current?.focus();
    }, 20);

    return () => window.clearTimeout(timer);
  }, [isOpen, step]);

  useEffect(() => {
    if (!isOpen || !canResendAt) {
      setRemainingSeconds(0);
      return undefined;
    }

    const compute = () => {
      const target = new Date(canResendAt).getTime();
      if (Number.isNaN(target)) {
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

  if (!isOpen) return null;

  const resendLocked = remainingSeconds > 0;
  const resendLabel = resending
    ? "Reenviando..."
    : resendLocked
      ? `Reenviar código em ${formatRemaining(remainingSeconds)}`
      : "Reenviar código";

  async function handleRequestCode(event) {
    event.preventDefault();
    const cleanEmail = String(email || "")
      .trim()
      .toLowerCase();

    if (!isValidEmail(cleanEmail)) {
      setError("Informe um e-mail válido.");
      emailRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const data = await api("/auth/forgot-password/request-code", {
        method: "POST",
        body: JSON.stringify({ email: cleanEmail }),
      });

      setEmail(data?.passwordReset?.email || cleanEmail);
      setServerState(data?.passwordReset || null);
      setCode("");
      setStep("code");
    } catch (err) {
      setError(getApiErrorMessage(err, "Não foi possível enviar o código."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyCode(event) {
    event.preventDefault();
    const cleanCode = onlyDigits(code).slice(0, 4);

    if (cleanCode.length !== 4) {
      setError("Digite o código de 4 dígitos.");
      codeRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const data = await api("/auth/forgot-password/verify-code", {
        method: "POST",
        body: JSON.stringify({ email, code: cleanCode }),
      });

      setCode(cleanCode);
      setServerState(data?.passwordReset || serverState);
      setStep("reset");
    } catch (err) {
      setError(getApiErrorMessage(err, "Não foi possível validar o código."));
      codeRef.current?.focus();
      codeRef.current?.select?.();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendCode() {
    if (resendLocked || resending) return;

    setResending(true);
    setError("");

    try {
      const data = await api("/auth/forgot-password/resend-code", {
        method: "POST",
        body: JSON.stringify({ email }),
      });

      setServerState(data?.passwordReset || null);
      setCode("");
      codeRef.current?.focus();
    } catch (err) {
      setError(getApiErrorMessage(err, "Não foi possível reenviar o código."));
    } finally {
      setResending(false);
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    setError("");

    if (!canSubmitNewPassword) {
      if (!passwordRules.minLength || !passwordRules.specialChar) {
        setError(
          "A senha deve ter no mínimo 8 caracteres e pelo menos 1 caractere especial.",
        );
      } else if (newPassword !== confirmPassword) {
        setError("A confirmação da nova senha precisa ser igual.");
      }
      passwordRef.current?.focus();
      return;
    }

    setSubmitting(true);

    try {
      await api("/auth/forgot-password/reset-password", {
        method: "POST",
        body: JSON.stringify({
          email,
          code,
          newPassword,
        }),
      });

      onClose?.();
      onSuccess?.(
        "Senha redefinida com sucesso. Faça login com sua nova senha.",
      );
    } catch (err) {
      setError(getApiErrorMessage(err, "Não foi possível redefinir a senha."));
    } finally {
      setSubmitting(false);
    }
  }

  function handleCodePaste(event) {
    const pasted = onlyDigits(event.clipboardData?.getData("text") || "").slice(
      0,
      4,
    );
    if (!pasted) return;

    event.preventDefault();
    setError("");
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
        className="w-full max-w-xl rounded-[28px] border border-white/80 bg-white/95 p-6 shadow-[0_25px_80px_rgba(15,23,42,0.18)] backdrop-blur sm:p-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="forgot-password-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              Recuperação de senha
            </span>
            <h2
              id="forgot-password-title"
              className="mt-4 text-2xl font-semibold tracking-tight text-zinc-950"
            >
              Esqueceu a senha?
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Informe seu e-mail, valide o código de 4 dígitos e defina uma nova senha.
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

        <div className="mt-6 flex flex-wrap gap-2">
          <StepPill active={step === "email"} done={step !== "email"}>
            E-mail
          </StepPill>
          <StepPill active={step === "code"} done={step === "reset"}>
            Código
          </StepPill>
          <StepPill active={step === "reset"} done={false}>
            Nova senha
          </StepPill>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-[linear-gradient(180deg,#fff1f2_0%,#fff5f5_100%)] px-4 py-3 text-sm text-red-700 shadow-sm">
            <div className="flex gap-3">
              <span className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-red-100 text-[11px] font-bold text-red-700">
                !
              </span>
              <div className="leading-6">{error}</div>
            </div>
          </div>
        ) : null}

        {step === "email" ? (
          <form className="mt-6 space-y-5" onSubmit={handleRequestCode}>
            <Field
              label="E-mail cadastrado"
              type="email"
              value={email}
              onChange={(e) => {
                setError("");
                setEmail(e.target.value);
              }}
              autoComplete="email"
              placeholder="voce@empresa.com"
              disabled={submitting}
              inputRef={emailRef}
              hint="Vamos enviar um código de 4 dígitos para este e-mail."
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3.5 text-sm font-medium text-white shadow-[0_16px_40px_rgba(24,24,27,0.18)] transition hover:-translate-y-0.5 hover:bg-zinc-800 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
                    Enviando código...
                  </>
                ) : (
                  "Enviar código"
                )}
              </button>

              <button
                type="button"
                className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => onClose?.()}
                disabled={submitting}
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : null}

        {step === "code" ? (
          <form className="mt-6 space-y-5" onSubmit={handleVerifyCode}>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm text-zinc-600">
              Enviamos um código para <span className="font-medium text-zinc-900">{email}</span>.
            </div>

            <Field
              label="Código de 4 dígitos"
              value={code}
              onChange={(e) => {
                setError("");
                setCode(onlyDigits(e.target.value).slice(0, 4));
              }}
              placeholder="0000"
              autoComplete="one-time-code"
              disabled={submitting || resending}
              inputRef={codeRef}
              maxLength={4}
              inputMode="numeric"
              onPaste={handleCodePaste}
              hint="O código é válido por 10 minutos."
              className="text-center text-2xl tracking-[0.45em]"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                className="text-sm font-medium text-zinc-600 underline underline-offset-4 transition hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  setError("");
                  setStep("email");
                }}
                disabled={submitting || resending}
              >
                Alterar e-mail
              </button>

              <button
                type="button"
                className="text-sm font-medium text-zinc-600 underline underline-offset-4 transition hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleResendCode}
                disabled={submitting || resending || resendLocked}
              >
                {resendLabel}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3.5 text-sm font-medium text-white shadow-[0_16px_40px_rgba(24,24,27,0.18)] transition hover:-translate-y-0.5 hover:bg-zinc-800 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={submitting || resending}
              >
                {submitting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
                    Validando...
                  </>
                ) : (
                  "Confirmar código"
                )}
              </button>

              <button
                type="button"
                className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => onClose?.()}
                disabled={submitting || resending}
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : null}

        {step === "reset" ? (
          <form className="mt-6 space-y-5" onSubmit={handleResetPassword}>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700">
              Código validado. Agora defina sua nova senha.
            </div>

            <Field
              label="Nova senha"
              type="password"
              value={newPassword}
              onChange={(e) => {
                setError("");
                setNewPassword(e.target.value);
              }}
              autoComplete="new-password"
              placeholder="Crie uma nova senha"
              disabled={submitting}
              inputRef={passwordRef}
            />

            <Field
              label="Confirmar nova senha"
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setError("");
                setConfirmPassword(e.target.value);
              }}
              autoComplete="new-password"
              placeholder="Digite novamente a nova senha"
              disabled={submitting}
              error={
                confirmPassword && newPassword !== confirmPassword
                  ? "A confirmação precisa ser igual à nova senha."
                  : ""
              }
            />

            <PasswordRules password={newPassword} />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3.5 text-sm font-medium text-white shadow-[0_16px_40px_rgba(24,24,27,0.18)] transition hover:-translate-y-0.5 hover:bg-zinc-800 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={submitting || !canSubmitNewPassword}
              >
                {submitting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
                    Salvando...
                  </>
                ) : (
                  "Salvar nova senha"
                )}
              </button>

              <button
                type="button"
                className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => onClose?.()}
                disabled={submitting}
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
