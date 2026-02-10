import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../app/api.js";

export default function PublicPaidGuard({ children }) {
  const { token } = useParams();
  const nav = useNavigate();
  const loc = useLocation();
  const [ready, setReady] = useState(false);

  const bookingId = useMemo(() => {
    const sp = new URLSearchParams(loc.search || "");
    return sp.get("bookingId") || "";
  }, [loc.search]);

  const doneUrl = useMemo(() => {
    const q = bookingId ? `?bookingId=${encodeURIComponent(bookingId)}` : "";
    return `/p/${token}/done${q}`;
  }, [token, bookingId]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const d = await api(`/p/${token}`);
        const st = String(d?.offer?.status || "").toUpperCase();
        const locked = !!d?.locked || st === "PAID" || st === "CONFIRMED";

        if (locked) {
          nav(doneUrl, { replace: true });
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
  }, [token, doneUrl, nav]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-zinc-50 p-6">
        <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-4 text-sm text-zinc-600">
          Carregando…
        </div>
      </div>
    );
  }

  return children;
}
