import { useEffect } from "react";
import { createPortal } from "react-dom";

let modalScrollLockCount = 0;
let previousBodyOverflow = "";

export default function ModalShell({
  open,
  onClose,
  children,
  locked = false,
  panelClassName = "",
  overlayClassName = "",
  contentClassName = "",
}) {
  useEffect(() => {
    if (!open) return undefined;

    if (modalScrollLockCount === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    modalScrollLockCount += 1;

    function handleKeyDown(event) {
      if (event.key === "Escape" && !locked) onClose?.();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      modalScrollLockCount = Math.max(0, modalScrollLockCount - 1);
      if (modalScrollLockCount === 0) {
        document.body.style.overflow = previousBodyOverflow;
      }
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose, locked]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[120] overflow-y-auto px-4 py-6 sm:py-10 ${contentClassName}`}
      role="dialog"
      aria-modal="true"
      onMouseDown={() => (!locked ? onClose?.() : null)}
    >
      <div
        className={`absolute inset-0 bg-slate-950/40 backdrop-blur-md dark:bg-slate-950/65 ${overlayClassName}`}
      />
      <div className="relative flex min-h-full items-start justify-center sm:items-center">
        <div
          className={`w-full ${panelClassName}`}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
