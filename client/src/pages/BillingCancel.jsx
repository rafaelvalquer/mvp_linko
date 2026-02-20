// src/pages/BillingCancel.jsx
import { Link } from "react-router-dom";

export default function BillingCancel() {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        <div className="text-xl font-semibold text-zinc-900">
          Checkout cancelado
        </div>
        <div className="mt-2 text-sm text-zinc-600">
          Você pode tentar novamente quando quiser.
        </div>

        <div className="mt-5 flex gap-2">
          <Link
            to="/billing/plans"
            className="flex-1 rounded-xl bg-zinc-900 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-zinc-800"
          >
            Ver planos
          </Link>
          <Link
            to="/dashboard"
            className="flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-center text-sm font-medium text-zinc-900 hover:bg-zinc-50"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
