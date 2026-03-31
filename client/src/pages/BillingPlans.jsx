// src/pages/BillingPlans.jsx
import { Check, CreditCard, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../app/api.js";
import { useAuth } from "../app/AuthContext.jsx";
import Badge from "../components/appui/Badge.jsx";
import Button from "../components/appui/Button.jsx";
import Card, { CardBody } from "../components/appui/Card.jsx";
import PageHeader from "../components/appui/PageHeader.jsx";
import Shell from "../components/layout/Shell.jsx";

const PLANS = [
  {
    key: "start",
    title: "Start",
    desc: "Plano para começar",
    badge: "Para começar",
  },
  { key: "pro", title: "Pro", desc: "Mais recursos para crescer", badge: "Mais vendas" },
  {
    key: "business",
    title: "Business",
    desc: "Estrutura para escalar a operação",
    badge: "Escala",
  },
];

export default function BillingPlans() {
  const [loadingPlan, setLoadingPlan] = useState("");
  const [error, setError] = useState("");

  async function subscribe(plan) {
    setError("");
    setLoadingPlan(plan);
    try {
      const data = await api("/billing/stripe/checkout-session", {
        method: "POST",
        body: JSON.stringify({ plan }),
      });

      if (data?.url) window.location.href = data.url;
      else setError("Checkout não retornou URL.");
    } catch (e) {
      setError(e?.data?.error || e?.message || "Falha ao iniciar assinatura.");
    } finally {
      setLoadingPlan("");
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="text-2xl font-semibold text-zinc-900">Planos</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Assine com cartão. A renovação é automática e o gerenciamento da
          assinatura é feito pelo Stripe.
        </p>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.key}
              className="rounded-2xl border bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-zinc-900">
                    {p.title}
                  </div>
                  <div className="mt-1 text-sm text-zinc-600">{p.desc}</div>
                </div>
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                  {p.badge}
                </span>
              </div>

              <button
                className="mt-5 w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
                disabled={!!loadingPlan}
                onClick={() => subscribe(p.key)}
              >
                {loadingPlan === p.key ? "Redirecionando..." : "Assinar"}
              </button>

              <div className="mt-3 text-xs text-zinc-500">
                Pagamento por cartão via Stripe Checkout.
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border bg-white p-5 text-sm text-zinc-700">
          <div className="font-semibold text-zinc-900">Enterprise</div>
          <div className="mt-1 text-zinc-600">
            Plano configurável e contratação manual/offline (fora do Checkout).
          </div>
        </div>
      </div>
    </div>
  );
}
