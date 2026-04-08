import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CreditCard, MessageCircle, Search } from "lucide-react";
import {
  getPublicMyPage,
  resolvePublicMyPagePayment,
} from "../app/myPageApi.js";
import { Input } from "../components/appui/Input.jsx";
import {
  getPublicSelectableCardProps,
  getPublicButtonProps,
  MyPagePublicCard,
  MyPagePublicFooter,
  MyPagePublicHero,
  MyPagePublicScreen,
} from "../components/my-page/MyPagePublicUi.jsx";

export default function PublicMyPagePayV2() {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(null);
  const [input, setInput] = useState("");

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoading(true);
        setErr("");
        const response = await getPublicMyPage(slug);
        if (!active) return;
        setPage(response?.page || null);
      } catch (error) {
        if (!active) return;
        setErr(error?.message || "Nao consegui abrir o pagamento.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [slug]);

  const whatsappButton = (page?.buttons || []).find(
    (button) => button.type === "whatsapp",
  );

  async function handleResolve(event) {
    event.preventDefault();
    try {
      setResolving(true);
      setErr("");
      const response = await resolvePublicMyPagePayment(slug, input);
      if (response?.redirectUrl) {
        window.location.href = response.redirectUrl;
        return;
      }
      throw new Error("Nao encontrei uma proposta valida para continuar.");
    } catch (error) {
      setErr(error?.message || "Nao consegui localizar a proposta.");
    } finally {
      setResolving(false);
    }
  }

  return (
    <MyPagePublicScreen page={page} maxWidth="max-w-3xl">
      {(theme) => (
        <>
          <MyPagePublicCard theme={theme}>
            <MyPagePublicHero
              page={page}
              theme={theme}
              eyebrow="Pagar proposta"
              description="Use o codigo da proposta ou cole o link recebido."
            />
          </MyPagePublicCard>

          {loading ? (
            <MyPagePublicCard theme={theme} className="h-64 animate-pulse" />
          ) : (
            <MyPagePublicCard theme={theme}>
              <form className="space-y-5" onSubmit={handleResolve}>
                <div
                  {...getPublicSelectableCardProps(theme, false, "px-4 py-4 text-sm")}
                >
                  Exemplo: <span className="font-semibold">LPABC123</span>
                </div>

                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
                    style={theme.mutedTextStyle}
                  />
                  <Input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Codigo da proposta ou link recebido"
                    className="h-12 pl-11"
                    style={theme.inputStyle}
                  />
                </div>

                {err ? (
                  <div className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {err}
                  </div>
                ) : null}

                <div className={theme?.layout?.payActionsClassName}>
                  <button
                    type="submit"
                    disabled={resolving || !input.trim()}
                    {...getPublicButtonProps(theme, "primary")}
                  >
                    <CreditCard className="h-4 w-4" />
                    {resolving ? "Buscando..." : "Abrir proposta"}
                  </button>
                  <Link to={`/u/${slug}`} {...getPublicButtonProps(theme, "secondary")}>
                    Voltar para a pagina
                  </Link>
                  {whatsappButton?.targetUrl ? (
                    <button
                      type="button"
                      {...getPublicButtonProps(theme, "secondary")}
                      onClick={() =>
                        window.open(
                          whatsappButton.targetUrl,
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                    >
                      <MessageCircle className="h-4 w-4" />
                      Falar no WhatsApp
                    </button>
                  ) : null}
                </div>
              </form>
            </MyPagePublicCard>
          )}

          <MyPagePublicFooter theme={theme} />
        </>
      )}
    </MyPagePublicScreen>
  );
}
