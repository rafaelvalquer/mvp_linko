import { CalendarDays, CreditCard, FileText, ShoppingBag } from "lucide-react";
import {
  getMyPageButtonProps,
  getMyPageSelectableCardProps,
  getMyPageSurfaceProps,
  getMyPageTheme,
} from "./myPageTheme.js";
import {
  MyPagePublicAvatar,
  MyPagePublicHeroMedia,
} from "./MyPagePublicUi.jsx";

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function PreviewButton({ children, theme, variant = "primary", className = "" }) {
  const buttonProps = getMyPageButtonProps(theme, variant);

  return (
    <div
      className={cls(buttonProps.className, "w-full justify-between", className)}
      style={buttonProps.style}
    >
      {children}
    </div>
  );
}

function PreviewCard({ theme, children, className = "", variant = "default" }) {
  const props = getMyPageSurfaceProps(theme, variant);
  return (
    <section {...props} className={cls(props.className, className)}>
      {children}
    </section>
  );
}

function PreviewSelectable({
  theme,
  children,
  className = "",
  active = false,
}) {
  const props = getMyPageSelectableCardProps(theme, active);
  return (
    <div style={props.style} className={cls(props.className, className)}>
      {children}
    </div>
  );
}

function PreviewField({ theme, className = "", children }) {
  return (
    <div
      className={cls("rounded-[20px] border px-3 py-2 text-xs", className)}
      style={theme.inputStyle}
    >
      {children}
    </div>
  );
}

function PreviewHeader({ page, theme, eyebrow, studio = false }) {
  return (
    <div className="space-y-3">
      <MyPagePublicHeroMedia
        page={page}
        theme={theme}
        className="w-full"
        heightClassName={studio ? "h-28" : "h-24"}
      />

      <div className="flex items-start gap-3">
        {theme.usesHeroLayout ? null : (
          <MyPagePublicAvatar
            page={page}
            theme={theme}
            sizeClassName={studio ? "h-14 w-14 rounded-full" : "h-12 w-12 rounded-full"}
            iconSizeClassName={studio ? "h-6 w-6" : "h-5 w-5"}
          />
        )}
        <div className="min-w-0">
          <div
            className="text-[10px] font-bold uppercase tracking-[0.18em]"
            style={theme.accentTextStyle}
          >
            {eyebrow}
          </div>
          <div className={cls("mt-1 font-black", studio ? "text-base" : "text-sm")}>
            {page?.title || "Minha Pagina"}
          </div>
          <div
            className={cls("mt-1 leading-5", studio ? "text-sm" : "text-xs")}
            style={theme.mutedTextStyle}
          >
            {page?.subtitle || "Seus principais links comerciais em um so lugar."}
          </div>
        </div>
      </div>
    </div>
  );
}

function DeviceShell({ theme, studio = false, children }) {
  const screenStyle = {
    ...theme.rootStyle,
    minHeight: studio ? "760px" : "600px",
    backgroundAttachment: "scroll",
  };

  return (
    <div className={cls("mx-auto w-full", studio ? "max-w-[430px]" : "max-w-[344px]")}>
      <div
        className={cls(
          "rounded-[42px] border border-slate-950/80 bg-slate-950 p-2.5",
          studio
            ? "shadow-[0_44px_90px_-40px_rgba(15,23,42,0.7)]"
            : "shadow-[0_32px_72px_-42px_rgba(15,23,42,0.65)]",
        )}
      >
        <div className="flex justify-center pb-2">
          <div className="h-1.5 w-20 rounded-full bg-white/20" />
        </div>
        <div className="overflow-hidden rounded-[30px] border border-white/10" style={screenStyle}>
          <div className={cls("space-y-4", studio ? "p-5" : "p-4")}>{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function MyPageMobilePreview({
  page,
  mode = "home",
  variant = "default",
}) {
  const theme = getMyPageTheme(page || {});
  const isStudio = variant === "studio";
  const buttons = (page?.buttons || [])
    .filter((button) => button.enabled)
    .slice(0, isStudio ? 4 : 3);
  const shopCount = Number(page?.summary?.selectedProductsCount || 0);

  return (
    <DeviceShell theme={theme} studio={isStudio}>
      {mode === "catalog" ? (
          <PreviewCard theme={theme} className={cls(isStudio ? "p-5" : "p-4")}>
            <div className="space-y-3">
              <PreviewHeader page={page} theme={theme} eyebrow="Catalogo" studio={isStudio} />
            {Array.from({ length: Math.max(shopCount || 2, 2) })
              .slice(0, 2)
              .map((_, index) => (
                <PreviewSelectable
                  key={`catalog:${index}`}
                  theme={theme}
                  className={cls(isStudio ? "p-4" : "p-3")}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cls(
                        "flex items-center justify-center border",
                        theme.buttonIconRadiusClassName,
                        isStudio ? "h-14 w-14" : "h-12 w-12",
                      )}
                      style={theme.softSurfaceStyle}
                    >
                      <ShoppingBag className={cls(isStudio ? "h-6 w-6" : "h-5 w-5")} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={cls("truncate font-semibold", isStudio ? "text-base" : "text-sm")}>
                        Produto do shop
                      </div>
                      <div className="mt-1 text-xs" style={theme.mutedTextStyle}>
                        Item publico
                      </div>
                    </div>
                  </div>
                </PreviewSelectable>
              ))}
            <PreviewButton theme={theme}>
              <span className="inline-flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                Pedir orcamento
              </span>
            </PreviewButton>
          </div>
        </PreviewCard>
      ) : null}

      {mode === "quote" ? (
        <PreviewCard theme={theme} className={cls(isStudio ? "p-5" : "p-4")}>
          <div className="space-y-3">
            <PreviewHeader page={page} theme={theme} eyebrow="Pedir orcamento" studio={isStudio} />
            <PreviewCard theme={theme} variant="soft" className={cls("space-y-2", isStudio ? "p-4" : "p-3")}>
              <PreviewField theme={theme}>
                Nome
              </PreviewField>
              <PreviewField theme={theme}>
                WhatsApp
              </PreviewField>
              <PreviewField theme={theme} className="py-3">
                Conte o que voce precisa
              </PreviewField>
            </PreviewCard>
            <PreviewCard theme={theme} variant="soft" className={cls(isStudio ? "p-4" : "p-3")}>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em]" style={theme.accentTextStyle}>
                Produtos
              </div>
              <div className="mt-2 text-xs" style={theme.mutedTextStyle}>
                {shopCount ? `${shopCount} item(ns)` : "Pedido geral"}
              </div>
            </PreviewCard>
            <PreviewButton theme={theme}>
              <span className="inline-flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Enviar solicitacao
              </span>
            </PreviewButton>
          </div>
        </PreviewCard>
      ) : null}

      {mode === "schedule" ? (
        <PreviewCard theme={theme} className={cls(isStudio ? "p-5" : "p-4")}>
          <div className="space-y-3">
            <PreviewHeader page={page} theme={theme} eyebrow="Agendar atendimento" studio={isStudio} />
            <div className="grid grid-cols-2 gap-2">
              {["09:00", "10:30", "14:00", "16:00"].map((slot) => (
                <PreviewSelectable
                  key={slot}
                  theme={theme}
                  className="px-3 py-3 text-center text-xs font-semibold"
                >
                  {slot}
                </PreviewSelectable>
              ))}
            </div>
            <PreviewButton theme={theme}>
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Confirmar horario
              </span>
            </PreviewButton>
          </div>
        </PreviewCard>
      ) : null}

      {mode === "pay" ? (
        <PreviewCard theme={theme} className={cls(isStudio ? "p-5" : "p-4")}>
          <div className="space-y-3">
            <PreviewHeader page={page} theme={theme} eyebrow="Pagar proposta" studio={isStudio} />
            <PreviewCard theme={theme} variant="soft" className={cls("space-y-2", isStudio ? "p-4" : "p-3")}>
              <div className="text-xs" style={theme.mutedTextStyle}>
                Digite o codigo publico ou cole o link recebido.
              </div>
              <PreviewField theme={theme}>
                LPABC123
              </PreviewField>
            </PreviewCard>
            <PreviewButton theme={theme}>
              <span className="inline-flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Abrir proposta
              </span>
            </PreviewButton>
          </div>
        </PreviewCard>
      ) : null}

      {mode === "home" ? (
        <PreviewCard theme={theme} className={cls(isStudio ? "p-6" : "p-4")}>
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center">
              <MyPagePublicHeroMedia
                page={page}
                theme={theme}
                className="mb-4 w-full"
                heightClassName={isStudio ? "h-[180px]" : "h-28"}
              />
              {theme.usesHeroLayout ? null : (
                <MyPagePublicAvatar
                  page={page}
                  theme={theme}
                  sizeClassName={isStudio ? "h-20 w-20 rounded-full" : "h-16 w-16 rounded-full"}
                  iconSizeClassName={isStudio ? "h-8 w-8" : "h-6 w-6"}
                />
              )}
              <div className={cls("mt-3 font-black tracking-[-0.05em]", isStudio ? "text-2xl" : "text-lg")}>
                {page?.title || "Minha Pagina"}
              </div>
              {page?.subtitle ? (
                <div className="mt-2 text-sm font-semibold" style={theme.accentTextStyle}>
                  {page.subtitle}
                </div>
              ) : null}
              <div
                className={cls("mt-2 leading-6", isStudio ? "max-w-[30ch] text-sm" : "text-xs")}
                style={theme.mutedTextStyle}
              >
                {page?.description || "Centralize seus principais links."}
              </div>
            </div>

            <div className="space-y-2">
              {buttons.length ? (
                buttons.map((button) => (
                  <PreviewButton
                    key={button.id}
                    theme={theme}
                    variant={button.type === "whatsapp" ? "primary" : "secondary"}
                  >
                    <span className="truncate">{button.label}</span>
                  </PreviewButton>
                ))
              ) : (
                <PreviewCard theme={theme} variant="soft" className="p-3 text-center text-xs">
                  Ative pelo menos um CTA em Links.
                </PreviewCard>
              )}
            </div>

            <div className="pt-2 text-center text-[11px]" style={theme.mutedTextStyle}>
              Criado com LuminorPay
            </div>
          </div>
        </PreviewCard>
      ) : null}
    </DeviceShell>
  );
}
