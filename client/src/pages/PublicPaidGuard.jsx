import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../app/api.js";

function stepFromPath(pathname = "") {
  const p = String(pathname || "");
  if (p.endsWith("/done")) return "DONE";
  if (p.endsWith("/pay") || p.endsWith("/payment")) return "PAYMENT";
  if (p.endsWith("/schedule")) return "SCHEDULE";
  return "ACCEPT";
}

function buildUrlForStep({ step, token, bookingId }) {
  const q = bookingId ? `?bookingId=${encodeURIComponent(bookingId)}` : "";
  switch (step) {
    case "SCHEDULE":
      return `/p/${token}/schedule`;
    case "PAYMENT":
      return `/p/${token}/pay${q}`;
    case "DONE":
      return `/p/${token}/done${q}`;
    case "ACCEPT":
    default:
      return `/p/${token}`;
  }
}

export default function PublicPaidGuard({ children }) {
  const { token } = useParams();
  const nav = useNavigate();
  const loc = useLocation();

  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(null);

  const bookingIdFromUrl = useMemo(() => {
    const sp = new URLSearchParams(loc.search || "");
    return sp.get("bookingId") || "";
  }, [loc.search]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setBlocked(null);

        const d = await api(`/p/${token}`);

        const flowStep =
          String(d?.flow?.step || "")
            .trim()
            .toUpperCase() || (d?.locked ? "DONE" : "ACCEPT");

        const flowBookingId =
          String(
            d?.flow?.bookingId || d?.booking?.id || bookingIdFromUrl || "",
          ).trim() || "";

        // EXPIRED / CANCELED: renderiza uma tela simples aqui (caso não exista rota dedicada)
        if (flowStep === "EXPIRED" || flowStep === "CANCELED") {
          if (!alive) return;
          setBlocked({
            title:
              flowStep === "EXPIRED"
                ? "Proposta expirada"
                : "Proposta cancelada",
            msg:
              flowStep === "EXPIRED"
                ? "Este link expirou e não pode mais ser concluído."
                : "Esta proposta foi cancelada e não pode mais ser concluída.",
          });
          setReady(true);
          return;
        }

        const currentStep = stepFromPath(loc.pathname);
        const targetUrl = buildUrlForStep({
          step: flowStep,
          token,
          bookingId: flowBookingId,
        });

        // ✅ idempotência do link: se o passo não for o atual, redireciona
        if (currentStep !== flowStep) {
          nav(targetUrl, { replace: true });
          return;
        }
      } catch {
        // se falhar, não bloqueia navegação
      } finally {
        if (alive) setReady(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, [token, loc.pathname, nav, bookingIdFromUrl]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-zinc-50 p-6">
        <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-4 text-sm text-zinc-600">
          Carregando…
        </div>
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="min-h-screen bg-zinc-50 p-6">
        <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-6">
          <div className="text-lg font-semibold text-zinc-900">
            {blocked.title}
          </div>
          <div className="mt-2 text-sm text-zinc-600">{blocked.msg}</div>
        </div>
      </div>
    );
  }

  return children;
}
