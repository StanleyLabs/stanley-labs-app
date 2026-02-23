import { useEffect, useRef } from "react";
import { IconX } from "../icons";
import { cn } from "../utils";

export function Modal({
  open,
  title,
  children,
  onClose,
  width = "max-w-lg",
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  width?: string;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const mouseDownOnOverlay = useRef(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) {
        (active as HTMLElement).blur();
        e.stopPropagation();
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-center bg-sidebar/60 backdrop-blur-sm px-4 pt-[15vh] animate-fade-in"
      onMouseDown={(e) => { mouseDownOnOverlay.current = e.target === overlayRef.current; }}
      onMouseUp={(e) => {
        if (mouseDownOnOverlay.current && e.target === overlayRef.current) onClose();
        mouseDownOnOverlay.current = false;
      }}
    >
      <div className={cn("w-full rounded-2xl bg-white dark:bg-dark-surface shadow-overlay animate-scale-in border border-gray-200 dark:border-dark-border", width)}>
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-dark-border px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-border hover:text-gray-600 transition-colors">
            <IconX />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
