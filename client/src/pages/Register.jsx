//src/pages/Register.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../app/AuthContext.jsx";
import RegisterEmailCodeModal from "../components/auth/RegisterEmailCodeModal.jsx";

function safeNextPath(value, fallback = "/billing/plans") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//")) return fallback;
  return raw;
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

function getPasswordValidation(value) {
  return {
    minLength: hasMinPasswordLength(value),
    specialChar: hasSpecialPasswordChar(value),
  };
}

function getFieldErrors(values) {
  const errors = {};

  if (!String(values.name || "").trim()) {
    errors.name = "Informe seu nome.";
  } else if (String(values.name || "").trim().length < 2) {
    errors.name = "Seu nome deve ter pelo menos 2 caracteres.";
  }

  if (String(values.workspaceName || "").trim()) {
    if (String(values.workspaceName || "").trim().length < 2) {
      errors.workspaceName =
        "O nome do workspace deve ter pelo menos 2 caracteres.";
    }
  }

  if (!String(values.email || "").trim()) {
    errors.email = "Informe seu e-mail.";
  } else if (!isValidEmail(values.email)) {
    errors.email = "Informe um e-mail válido.";
  }

  const password = String(values.password || "");
  const passwordRules = getPasswordValidation(password);

  if (!password) {
    errors.password = "Informe sua senha.";
  } else if (!passwordRules.minLength || !passwordRules.specialChar) {
    errors.password =
      "Sua senha deve ter no mínimo 8 caracteres e pelo menos 1 caractere especial.";
  }

  return errors;
}

function getApiErrorMessage(
  err,
  fallback = "Falha ao processar seu cadastro.",
) {
  const code = String(err?.data?.code || "")
    .trim()
    .toUpperCase();

  if (code === "EMAIL_IN_USE") return "Este e-mail já está em uso.";
  if (code === "EMAIL_INVALID") return "Informe um e-mail válido.";
  if (code === "NAME_REQUIRED") return "Informe seu nome.";
  if (code === "PASSWORD_TOO_SHORT")
    return "Sua senha deve ter no mínimo 8 caracteres e pelo menos 1 caractere especial.";
  if (code === "WORKSPACE_NAME_REQUIRED")
    return "Informe um nome de workspace válido.";
  if (code === "INVALID_CODE") return "Código inválido.";
  if (code === "CODE_INVALID_FORMAT")
    return "Digite o código de 4 dígitos corretamente.";
  if (code === "CODE_EXPIRED")
    return "O código expirou. Solicite um novo envio.";
  if (code === "NO_PENDING_REGISTRATION")
    return "Não foi encontrado um cadastro pendente para este e-mail.";
  if (code === "TOO_MANY_ATTEMPTS")
    return "Muitas tentativas inválidas. Solicite um novo código.";
  if (code === "RESEND_COOLDOWN") {
    const seconds = Number(err?.data?.retryAfterSeconds || 60);
    return `Aguarde ${seconds}s para reenviar o código.`;
  }

  return err?.message || fallback;
}

function AuthShell({ children, eyebrow, title, subtitle }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.12),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.12),_transparent_32%),linear-gradient(180deg,#fafafa_0%,#f4f4f5_100%)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-90px] top-[-90px] h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute bottom-[-120px] right-[-120px] h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute left-1/2 top-16 h-40 w-40 -translate-x-1/2 rounded-full bg-white/60 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full overflow-hidden rounded-[28px] border border-white/70 bg-white/70 shadow-[0_30px_80px_rgba(24,24,27,0.10)] backdrop-blur xl:grid-cols-[1.1fr_0.9fr]">
          <div className="relative hidden border-r border-zinc-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(244,244,245,0.78))] p-10 xl:flex xl:flex-col xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-3 py-1 text-xs font-medium tracking-[0.18em] text-zinc-600 uppercase shadow-sm">
                Luminor Platform
              </div>

              <div className="mt-10 max-w-xl">
                <div className="text-sm font-semibold tracking-[0.22em] text-zinc-500 uppercase">
                  {eyebrow}
                </div>
                <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-950">
                  {title}
                </h1>
                <p className="mt-5 max-w-lg text-base leading-7 text-zinc-600">
                  {subtitle}
                </p>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                <FeatureCard
                  title="Cadastro validado"
                  text="Crie sua conta com validação clara, confirmação por e-mail e experiência consistente."
                />
                <FeatureCard
                  title="Pronto para o plano"
                  text="Após confirmar o e-mail, o fluxo segue normalmente para o Stripe e ativação do workspace."
                />
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-200/80 bg-white/80 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-zinc-500">
                    Segurança no cadastro
                  </div>
                  <div className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
                    Regras de senha e validação
                  </div>
                </div>
                <div className="rounded-2xl bg-zinc-950 px-3 py-2 text-sm font-medium text-white shadow-lg shadow-zinc-950/15">
                  Secure
                </div>
              </div>
              <div className="mt-4 h-px bg-zinc-200" />
              <div className="mt-4 flex flex-wrap gap-2">
                <Pill>8+ caracteres</Pill>
                <Pill>Especial</Pill>
                <Pill>Email code</Pill>
                <Pill>Stripe flow</Pill>
              </div>
            </div>
          </div>

          <div className="flex min-h-[760px] items-center justify-center p-4 sm:p-6 lg:p-10">
            <div className="w-full max-w-lg">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ title, text }) {
  return (
    <div className="rounded-3xl border border-zinc-200/80 bg-white/75 p-5 shadow-sm">
      <div className="text-sm font-semibold text-zinc-900">{title}</div>
      <div className="mt-2 text-sm leading-6 text-zinc-600">{text}</div>
    </div>
  );
}

function Pill({ children }) {
  return (
    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
      {children}
    </span>
  );
}

function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_20px_60px_rgba(24,24,27,0.10)] backdrop-blur sm:p-8">
      <div className="mb-6">
        <div className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
          Novo workspace
        </div>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-500">{subtitle}</p>
      </div>

      {children}

      {footer ? <div className="mt-6">{footer}</div> : null}
    </div>
  );
}

function Alert({ children }) {
  if (!children) return null;

  return (
    <div className="mb-5 rounded-2xl border border-red-200 bg-[linear-gradient(180deg,#fff1f2_0%,#fff5f5_100%)] px-4 py-3 text-sm text-red-700 shadow-sm">
      <div className="flex gap-3">
        <span className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-red-100 text-[11px] font-bold text-red-700">
          !
        </span>
        <div className="leading-6">{children}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  type = "text",
  value,
  onChange,
  onBlur,
  autoComplete,
  placeholder,
  error,
  hint,
  disabled,
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-zinc-800">
        {label}
      </label>
      <input
        className={[
          "w-full rounded-2xl border bg-white px-4 py-3 text-[15px] text-zinc-950 outline-none transition placeholder:text-zinc-400",
          "shadow-[0_1px_2px_rgba(24,24,27,0.04)]",
          error
            ? "border-red-300 ring-4 ring-red-100/70"
            : "border-zinc-200 focus:border-zinc-300 focus:ring-4 focus:ring-zinc-200/60",
          disabled ? "cursor-not-allowed opacity-70" : "",
        ].join(" ")}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        disabled={disabled}
      />
      {error ? (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-2 text-sm text-zinc-500">{hint}</p>
      ) : null}
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
  const rules = getPasswordValidation(password);

  return (
    <div className="rounded-3xl border border-zinc-200 bg-zinc-50/80 p-4">
      <div className="mb-3">
        <div className="text-sm font-semibold text-zinc-900">
          Regras de senha
        </div>
        <div className="mt-1 text-sm text-zinc-500">
          Sua senha precisa atender aos requisitos abaixo para continuar.
        </div>
      </div>

      <div className="grid gap-3">
        <RuleItem ok={rules.minLength}>Mínimo de 8 caracteres</RuleItem>
        <RuleItem ok={rules.specialChar}>
          Pelo menos 1 caractere especial
        </RuleItem>
      </div>
    </div>
  );
}

function Button({ children, loading, disabled, type = "button" }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3.5 text-sm font-medium text-white shadow-[0_16px_40px_rgba(24,24,27,0.18)] transition hover:-translate-y-0.5 hover:bg-zinc-800 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
          Enviando código...
        </span>
      ) : (
        children
      )}
    </button>
  );
}

export default function Register() {
  const { user, signUp, resendRegisterCode, verifyRegisterCode } = useAuth();

  const [values, setValues] = useState({
    name: "",
    workspaceName: "",
    email: "",
    password: "",
  });
  const [touched, setTouched] = useState({
    name: false,
    workspaceName: false,
    email: false,
    password: false,
  });
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingRegistration, setPendingRegistration] = useState(null);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);

  const nav = useNavigate();
  const loc = useLocation();

  const next = useMemo(
    () => safeNextPath(new URLSearchParams(loc.search).get("next")),
    [loc.search],
  );

  const fieldErrors = useMemo(() => getFieldErrors(values), [values]);
  const passwordRules = useMemo(
    () => getPasswordValidation(values.password),
    [values.password],
  );
  const canSubmit =
    Object.keys(fieldErrors).length === 0 &&
    passwordRules.minLength &&
    passwordRules.specialChar &&
    !loading;

  useEffect(() => {
    if (user) {
      nav(next, { replace: true });
    }
  }, [user, next, nav]);

  if (user) {
    return <Navigate to={next} replace />;
  }

  function markTouched(field) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function setField(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function getVisibleError(field) {
    if (!submitAttempted && !touched[field]) return "";
    return fieldErrors[field] || "";
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitAttempted(true);
    setTouched({
      name: true,
      workspaceName: true,
      email: true,
      password: true,
    });
    setError("");

    if (Object.keys(fieldErrors).length > 0) {
      return;
    }

    setLoading(true);

    try {
      const data = await signUp({
        name: String(values.name || "").trim(),
        email: String(values.email || "")
          .trim()
          .toLowerCase(),
        password: String(values.password || ""),
        workspaceName: String(values.workspaceName || "").trim() || undefined,
      });

      setPendingRegistration(data?.pendingRegistration || null);
      setIsCodeModalOpen(true);
    } catch (err) {
      setError(getApiErrorMessage(err, "Falha ao iniciar o cadastro."));
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmCode(code) {
    const targetEmail =
      pendingRegistration?.email ||
      String(values.email || "")
        .trim()
        .toLowerCase();

    try {
      await verifyRegisterCode({
        email: targetEmail,
        code,
      });
      setIsCodeModalOpen(false);
      nav(next, { replace: true });
    } catch (err) {
      throw new Error(getApiErrorMessage(err, "Falha ao confirmar o código."));
    }
  }

  async function handleResendCode() {
    const targetEmail =
      pendingRegistration?.email ||
      String(values.email || "")
        .trim()
        .toLowerCase();

    try {
      const data = await resendRegisterCode({ email: targetEmail });
      setPendingRegistration(data?.pendingRegistration || null);
    } catch (err) {
      throw new Error(getApiErrorMessage(err, "Falha ao reenviar o código."));
    }
  }

  return (
    <>
      <AuthShell
        eyebrow="Cadastro premium"
        title="Crie sua conta com validação clara e acabamento visual mais profissional."
        subtitle="Configure seu acesso, valide seu e-mail e siga para o fluxo atual de ativação do plano sem quebrar a integração já existente com autenticação, workspace e billing."
      >
        <AuthCard
          title="Criar conta"
          subtitle="Preencha seus dados para iniciar seu workspace. A confirmação por e-mail continua integrada ao fluxo atual da aplicação."
          footer={
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm text-zinc-600">
              Já tem conta?{" "}
              <Link
                className="font-medium text-zinc-950 underline underline-offset-4 transition hover:text-zinc-700"
                to="/login"
              >
                Entrar
              </Link>
            </div>
          }
        >
          <Alert>{error}</Alert>

          <form className="space-y-4" onSubmit={onSubmit}>
            <Field
              label="Nome"
              value={values.name}
              onChange={(e) => setField("name", e.target.value)}
              onBlur={() => markTouched("name")}
              autoComplete="name"
              placeholder="Seu nome completo"
              error={getVisibleError("name")}
              disabled={loading}
            />

            <Field
              label="Nome do workspace"
              value={values.workspaceName}
              onChange={(e) => setField("workspaceName", e.target.value)}
              onBlur={() => markTouched("workspaceName")}
              placeholder="Ex.: Minha Empresa"
              hint="Opcional. Se não preencher, podemos usar seu nome como base."
              error={getVisibleError("workspaceName")}
              disabled={loading}
            />

            <Field
              label="Email"
              type="email"
              value={values.email}
              onChange={(e) => setField("email", e.target.value)}
              onBlur={() => markTouched("email")}
              autoComplete="email"
              placeholder="voce@empresa.com"
              error={getVisibleError("email")}
              disabled={loading}
            />

            <Field
              label="Senha"
              type="password"
              value={values.password}
              onChange={(e) => setField("password", e.target.value)}
              onBlur={() => markTouched("password")}
              autoComplete="new-password"
              placeholder="Crie uma senha forte"
              error={getVisibleError("password")}
              disabled={loading}
            />

            <PasswordRules password={values.password} />

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm text-zinc-500">
              Ao continuar, enviaremos um código de confirmação para seu e-mail
              antes de criar sua conta e seguir para o fluxo de pagamento do
              plano.
            </div>

            <Button type="submit" loading={loading} disabled={!canSubmit}>
              Criar conta
            </Button>
          </form>
        </AuthCard>
      </AuthShell>

      <RegisterEmailCodeModal
        isOpen={isCodeModalOpen}
        email={pendingRegistration?.email || values.email}
        canResendAt={pendingRegistration?.canResendAt}
        onConfirm={handleConfirmCode}
        onResend={handleResendCode}
        onClose={() => setIsCodeModalOpen(false)}
      />
    </>
  );
}
