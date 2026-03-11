import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  Mail,
  Store,
  User,
} from "lucide-react";

import { useAuth } from "../app/AuthContext.jsx";
import RegisterEmailCodeModal from "../components/auth/RegisterEmailCodeModal.jsx";
import brandLogo from "../assets/brand.png";

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

function getPasswordRules(password) {
  return {
    minLength: hasMinPasswordLength(password),
    specialChar: hasSpecialPasswordChar(password),
  };
}

function getFieldErrors(values) {
  const errors = {};

  const name = String(values.name || "").trim();
  const workspaceName = String(values.workspaceName || "").trim();
  const email = String(values.email || "").trim();
  const password = String(values.password || "");
  const passwordRules = getPasswordRules(password);

  if (!name) {
    errors.name = "Informe seu nome.";
  } else if (name.length < 2) {
    errors.name = "Seu nome deve ter pelo menos 2 caracteres.";
  }

  if (workspaceName && workspaceName.length < 2) {
    errors.workspaceName =
      "O nome do workspace deve ter pelo menos 2 caracteres.";
  }

  if (!email) {
    errors.email = "Informe seu e-mail.";
  } else if (!isValidEmail(email)) {
    errors.email = "Informe um e-mail valido.";
  }

  if (!password) {
    errors.password = "Informe sua senha.";
  } else if (!passwordRules.minLength || !passwordRules.specialChar) {
    errors.password =
      "A senha deve ter no minimo 8 caracteres e pelo menos 1 caractere especial.";
  }

  return errors;
}

function getApiErrorMessage(err, fallback = "Falha ao processar seu cadastro.") {
  const code = String(err?.data?.code || "")
    .trim()
    .toUpperCase();

  if (code === "EMAIL_IN_USE") return "Este e-mail ja esta em uso.";
  if (code === "EMAIL_INVALID") return "Informe um e-mail valido.";
  if (code === "NAME_REQUIRED") return "Informe seu nome.";
  if (code === "PASSWORD_TOO_SHORT") {
    return "A senha deve ter no minimo 8 caracteres e pelo menos 1 caractere especial.";
  }
  if (code === "WORKSPACE_NAME_REQUIRED") {
    return "Informe um nome de workspace valido.";
  }
  if (code === "INVALID_CODE") return "Codigo invalido.";
  if (code === "CODE_INVALID_FORMAT") {
    return "Digite o codigo de 4 digitos corretamente.";
  }
  if (code === "CODE_EXPIRED") {
    return "O codigo expirou. Solicite um novo envio.";
  }
  if (code === "NO_PENDING_REGISTRATION") {
    return "Nao foi encontrado um cadastro pendente para este e-mail.";
  }
  if (code === "TOO_MANY_ATTEMPTS") {
    return "Muitas tentativas invalidas. Solicite um novo codigo.";
  }
  if (code === "RESEND_COOLDOWN") {
    const seconds = Number(err?.data?.retryAfterSeconds || 60);
    return `Aguarde ${seconds}s para reenviar o codigo.`;
  }

  return err?.message || fallback;
}

function AuthBrand() {
  return (
    <Link to="/" className="inline-flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[linear-gradient(135deg,#2563eb,#14b8a6)] shadow-[0_18px_40px_-20px_rgba(37,99,235,0.7)]">
        <img
          src={brandLogo}
          alt="LuminorPay"
          className="h-8 w-8 rounded-xl object-contain"
          draggable="false"
        />
      </div>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">
          Vendas e Pix
        </div>
        <div className="text-lg font-black tracking-tight text-white">
          LuminorPay
        </div>
      </div>
    </Link>
  );
}

function AuthShell({ children, password }) {
  const steps = [
    "Crie sua conta com nome, e-mail e senha.",
    "Confirme o codigo enviado para o e-mail.",
    "Comece a montar propostas e receber no Pix.",
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[rgb(5,10,24)] text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-120px] top-[-120px] h-80 w-80 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="absolute right-[-120px] top-1/4 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-[-180px] left-1/3 h-[28rem] w-[28rem] rounded-full bg-emerald-400/12 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,10,24,0.92),rgba(8,15,30,0.88))]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <div className="grid w-full overflow-hidden rounded-[32px] border border-white/10 bg-[rgba(10,18,36,0.72)] shadow-[0_28px_80px_-40px_rgba(15,23,42,0.9)] backdrop-blur-2xl lg:grid-cols-[0.92fr_1.08fr]">
          <aside className="hidden border-r border-white/10 bg-[linear-gradient(180deg,rgba(8,15,30,0.9),rgba(10,18,36,0.72))] p-10 lg:flex lg:flex-col lg:justify-between">
            <div>
              <AuthBrand />

              <div className="mt-12 max-w-md">
                <div className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">
                  Criar conta
                </div>
                <h1 className="mt-4 text-4xl font-black tracking-tight text-white">
                  Comece com uma conta simples e pronta para vender.
                </h1>
                <p className="mt-5 text-base leading-7 text-slate-300">
                  Crie seu acesso, confirme o e-mail e organize propostas,
                  pagamentos e agenda na mesma plataforma.
                </p>
              </div>

              <div className="mt-10 space-y-3">
                {steps.map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm leading-6 text-slate-200"
                  >
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-teal-300" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <PasswordRules password={password} compact={false} />
          </aside>

          <div className="flex min-h-[100svh] items-center justify-center p-4 sm:p-6 lg:min-h-[780px] lg:p-10">
            <div className="w-full max-w-lg">
              <div className="mb-6 lg:hidden">
                <AuthBrand />
                <div className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
                    Criar conta
                  </div>
                  <h1 className="mt-3 text-3xl font-black tracking-tight text-white">
                    Crie sua conta e comece a organizar suas vendas.
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    Cadastro claro, rapido e confortavel para preencher no celular.
                  </p>
                </div>
              </div>

              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] p-5 shadow-[0_20px_60px_-32px_rgba(15,23,42,0.45)] sm:p-8">
      <div className="mb-6">
        <span className="inline-flex items-center rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-sky-700">
          Novo cadastro
        </span>
        <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p>
      </div>

      {children}

      {footer ? <div className="mt-6">{footer}</div> : null}
    </div>
  );
}

function Alert({ children }) {
  if (!children) return null;

  return (
    <div className="mb-5 rounded-2xl border border-red-200 bg-[linear-gradient(180deg,#fff1f2_0%,#fff7f7_100%)] px-4 py-3 text-sm text-red-700">
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
  icon: Icon,
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-800">
        {label}
      </label>
      <div
        className={[
          "flex min-h-[54px] items-center gap-3 rounded-2xl border bg-white px-4 shadow-[0_4px_18px_-14px_rgba(15,23,42,0.25)] transition",
          error
            ? "border-red-300 ring-4 ring-red-100/80"
            : "border-slate-200 focus-within:border-sky-300 focus-within:ring-4 focus-within:ring-sky-100",
        ].join(" ")}
      >
        {Icon ? <Icon className="h-5 w-5 flex-none text-slate-400" /> : null}
        <input
          className="w-full bg-transparent py-3 text-[15px] text-slate-950 outline-none placeholder:text-slate-400"
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          type={type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          disabled={disabled}
        />
      </div>
      {error ? (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-2 text-sm text-slate-500">{hint}</p>
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
          : "border-slate-200 bg-slate-50 text-slate-600",
      ].join(" ")}
    >
      <span
        className={[
          "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
          ok ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate-400",
        ].join(" ")}
      >
        {ok ? "ok" : "-"}
      </span>
      <span>{children}</span>
    </div>
  );
}

function PasswordRules({ password, compact = false }) {
  const rules = getPasswordRules(password);

  return (
    <div
      className={[
        "rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl",
        compact ? "p-4" : "p-5",
      ].join(" ")}
    >
      <div className="mb-3">
        <div className={compact ? "text-sm font-bold text-slate-900" : "text-sm font-bold text-white"}>
          Regras de senha
        </div>
        <div className={compact ? "mt-1 text-sm text-slate-500" : "mt-1 text-sm text-slate-300"}>
          Use uma senha segura para proteger seu acesso.
        </div>
      </div>

      <div className="grid gap-3">
        <RuleItem ok={rules.minLength}>Minimo de 8 caracteres</RuleItem>
        <RuleItem ok={rules.specialChar}>Pelo menos 1 caractere especial</RuleItem>
      </div>
    </div>
  );
}

function SubmitButton({ loading, disabled }) {
  return (
    <button
      className="inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#2563eb,#14b8a6)] px-4 py-3.5 text-sm font-bold text-white shadow-[0_20px_40px_-20px_rgba(37,99,235,0.55)] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={disabled || loading}
      type="submit"
    >
      {loading ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
          Enviando codigo...
        </>
      ) : (
        <>
          Criar conta
          <ArrowRight className="h-4 w-4" />
        </>
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
    () => getPasswordRules(values.password),
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
    setTouched((previous) => ({ ...previous, [field]: true }));
  }

  function setField(field, value) {
    setValues((previous) => ({ ...previous, [field]: value }));
  }

  function getVisibleError(field) {
    if (!submitAttempted && !touched[field]) return "";
    return fieldErrors[field] || "";
  }

  async function onSubmit(event) {
    event.preventDefault();
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
      throw new Error(getApiErrorMessage(err, "Falha ao confirmar o codigo."));
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
      throw new Error(getApiErrorMessage(err, "Falha ao reenviar o codigo."));
    }
  }

  return (
    <>
      <AuthShell password={values.password}>
        <AuthCard
          title="Criar conta"
          subtitle="Preencha seus dados para abrir seu workspace e confirmar o cadastro por e-mail."
          footer={
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Ja tem conta?{" "}
              <Link
                className="font-semibold text-slate-950 underline underline-offset-4 transition hover:text-slate-700"
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
              onChange={(event) => setField("name", event.target.value)}
              onBlur={() => markTouched("name")}
              autoComplete="name"
              placeholder="Seu nome completo"
              error={getVisibleError("name")}
              disabled={loading}
              icon={User}
            />

            <Field
              label="Nome do workspace"
              value={values.workspaceName}
              onChange={(event) => setField("workspaceName", event.target.value)}
              onBlur={() => markTouched("workspaceName")}
              placeholder="Ex.: Studio Bella"
              hint="Opcional. Pode ser o nome da sua empresa ou da sua marca."
              error={getVisibleError("workspaceName")}
              disabled={loading}
              icon={Store}
            />

            <Field
              label="Email"
              type="email"
              value={values.email}
              onChange={(event) => setField("email", event.target.value)}
              onBlur={() => markTouched("email")}
              autoComplete="email"
              placeholder="voce@empresa.com"
              error={getVisibleError("email")}
              disabled={loading}
              icon={Mail}
            />

            <Field
              label="Senha"
              type="password"
              value={values.password}
              onChange={(event) => setField("password", event.target.value)}
              onBlur={() => markTouched("password")}
              autoComplete="new-password"
              placeholder="Crie uma senha forte"
              error={getVisibleError("password")}
              disabled={loading}
              icon={LockKeyhole}
            />

            <div className="lg:hidden">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <PasswordRules password={values.password} compact />
              </div>
            </div>

            <div className="rounded-2xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm leading-6 text-slate-600">
              Ao continuar, enviaremos um codigo de confirmacao para seu e-mail
              antes de concluir a criacao da conta.
            </div>

            <SubmitButton loading={loading} disabled={!canSubmit} />
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
