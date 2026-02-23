import { useEffect, useRef } from "react";
import { IconTrash } from "./icons";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] flex items-start justify-center bg-sidebar/60 backdrop-blur-sm px-4 pt-[20vh] animate-fade-in"
      onMouseDown={(e) => { if (e.target === overlayRef.current) onCancel(); }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-dark-surface shadow-overlay animate-scale-in border border-gray-200 dark:border-dark-border">
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/50">
              <IconTrash className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{message}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4">
          <button
            onClick={onCancel}
            className="rounded-lg border border-gray-200 dark:border-dark-border bg-raised dark:bg-dark-raised px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-border transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
