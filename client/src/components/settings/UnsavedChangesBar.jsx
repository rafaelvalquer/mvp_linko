import { createPortal } from "react-dom";

import Button from "../appui/Button.jsx";
import useThemeToggle from "../../app/useThemeToggle.js";

export default function UnsavedChangesBar({
  visible = false,
  saving = false,
  onDiscard,
  onSave,
  discardLabel = "Descartar",
  saveLabel = "Salvar Agora",
  message = "Voce tem alteracoes nao salvas",
}) {
  const { isDark } = useThemeToggle();

  if (!visible || typeof document === "undefined") return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] px-4 pb-4 sm:pb-6">
      <div className="mx-auto max-w-3xl pointer-events-auto">
        <div
          className={[
            "rounded-[28px] border px-4 py-4 shadow-[0_28px_60px_-32px_rgba(15,23,42,0.45)] backdrop-blur-2xl",
            "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
            isDark
              ? "border-white/10 bg-[rgba(8,15,30,0.92)] text-white"
              : "border-slate-200/80 bg-[rgba(255,255,255,0.96)] text-slate-900",
          ].join(" ")}
        >
          <div className="flex items-center gap-3">
            <div className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span
              className={[
                "text-sm font-semibold",
                isDark ? "text-slate-100" : "text-slate-900",
              ].join(" ")}
            >
              {message}
            </span>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              className={isDark ? "text-slate-300 hover:text-white" : ""}
              onClick={onDiscard}
              disabled={saving}
            >
              {discardLabel}
            </Button>
            <Button type="button" onClick={onSave} disabled={saving}>
              {saving ? "Salvando..." : saveLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
