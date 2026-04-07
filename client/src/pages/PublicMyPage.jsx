import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  CalendarDays,
  CreditCard,
  ExternalLink,
  FileText,
  Link2,
  MessageCircle,
  ShoppingBag,
} from "lucide-react";
import { getPublicMyPage, trackPublicMyPageClick } from "../app/myPageApi.js";
import useThemeToggle from "../app/useThemeToggle.js";
import brand from "../assets/brand.png";
import Button from "../components/appui/Button.jsx";

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function iconForType(type) {
  if (type === "whatsapp") return MessageCircle;
  if (type === "public_schedule") return CalendarDays;
  if (type === "public_offer") return FileText;
  if (type === "catalog") return ShoppingBag;
  if (type === "payment_link") return CreditCard;
  return Link2;
}

export default function PublicMyPage() {
  const { slug } = useParams();
  const { isDark } = useThemeToggle();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(null);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoading(true);
        const response = await getPublicMyPage(slug);
        if (!active) return;
        setPage(response?.page || null);
      } catch (error) {
        if (!active) return;
        setErr(error?.message || "Pagina publica nao encontrada.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [slug]);

  const buttons = useMemo(() => page?.buttons || [], [page?.buttons]);
  const socialLinks = useMemo(() => page?.socialLinks || [], [page?.socialLinks]);

  async function handleButtonClick(button) {
    if (!button?.targetUrl) return;
    try {
      await trackPublicMyPageClick(slug, {
        buttonId: button.id,
        referrer: document.referrer || "",
      });
    } catch {}
    window.location.href = button.targetUrl;
  }

  return (
    <div
      className={cls(
        "min-h-screen px-4 py-8 sm:px-5",
        isDark ? "bg-[#050b16] text-white" : "bg-[rgb(244,247,251)] text-slate-950",
      )}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-120px] top-[-120px] h-72 w-72 rounded-full bg-cyan-400/12 blur-3xl" />
        <div className="absolute bottom-[-160px] right-[-120px] h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center">
        <div
          className={cls(
            "w-full rounded-[36px] border p-5 shadow-[0_30px_80px_-44px_rgba(15,23,42,0.28)] sm:p-7",
            isDark
              ? "border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(8,15,30,0.88))]"
              : "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,249,255,0.88))]",
          )}
        >
          <div className="flex flex-col items-center text-center">
            <img
              src={page?.avatarUrl || brand}
              alt={page?.title || "Minha Página"}
              className="h-24 w-24 rounded-[28px] object-cover shadow-[0_18px_42px_-24px_rgba(37,99,235,0.52)]"
            />
            <div className="mt-5 text-3xl font-black tracking-[-0.05em]">
              {page?.title || "Minha Página"}
            </div>
            {page?.subtitle ? (
              <div className="mt-2 text-sm font-semibold text-sky-700 dark:text-sky-200">
                {page.subtitle}
              </div>
            ) : null}
            {page?.description ? (
              <div className="mt-4 max-w-[34ch] text-sm leading-7 text-slate-600 dark:text-slate-300">
                {page.description}
              </div>
            ) : null}
          </div>

          {loading ? (
            <div className="mt-8 text-center text-sm text-slate-500 dark:text-slate-300">
              Carregando sua página...
            </div>
          ) : err ? (
            <div className="mt-8 rounded-[28px] border border-red-200 bg-red-50 p-5 text-center text-sm text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-100">
              {err}
            </div>
          ) : (
            <>
              <div className="mt-8 space-y-3">
                {buttons.map((button) => {
                  const Icon = iconForType(button.type);
                  return (
                    <button
                      key={button.id}
                      type="button"
                      onClick={() => handleButtonClick(button)}
                      className={cls(
                        "flex w-full items-center justify-between gap-4 rounded-[28px] border px-5 py-4 text-left transition",
                        isDark
                          ? "border-white/10 bg-white/[0.04] hover:border-cyan-400/20 hover:bg-white/[0.07]"
                          : "border-slate-200/80 bg-white/92 hover:border-sky-200 hover:bg-white",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <div
                          className={cls(
                            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                            isDark ? "bg-white/10 text-cyan-200" : "bg-sky-50 text-sky-700",
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-base font-semibold">
                            {button.label}
                          </div>
                          <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                            {button.type.replace(/_/g, " ")}
                          </div>
                        </div>
                      </div>

                      <ExternalLink className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-300" />
                    </button>
                  );
                })}
              </div>

              {socialLinks.length ? (
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {socialLinks.map((item) => (
                    <a
                      key={item.id}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className={cls(
                        "rounded-full border px-3 py-2 text-xs font-semibold transition",
                        isDark
                          ? "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                      )}
                    >
                      {item.label || item.platform}
                    </a>
                  ))}
                </div>
              ) : null}
            </>
          )}

          <div className="mt-8 text-center text-xs text-slate-500 dark:text-slate-400">
            Criado com LuminorPay
          </div>
          <div className="mt-3 text-center">
            <Button
              type="button"
              variant="secondary"
              onClick={() => window.open("/", "_self")}
            >
              Conhecer a LuminorPay
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
