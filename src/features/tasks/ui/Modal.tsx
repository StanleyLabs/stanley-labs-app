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
    if (!open) {
      document.body.style.overflow = "";
      return;
    }
    // Prevent background scrolling
    document.body.style.overflow = "hidden";
    
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4 sm:p-6"
    >
      <div 
        ref={overlayRef}
        className="absolute inset-0 z-40"
        onMouseDown={(e) => { mouseDownOnOverlay.current = e.target === overlayRef.current; }}
        onMouseUp={(e) => {
          if (mouseDownOnOverlay.current && e.target === overlayRef.current) onClose();
          mouseDownOnOverlay.current = false;
        }}
      />
      
      <div 
        className={cn(
          "relative z-50 w-full max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-dark-surface shadow-xl animate-scale-in border border-gray-200 dark:border-dark-border", 
          width
        )}
      >
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-dark-border px-6 py-4 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-border hover:text-gray-600 transition-colors">
            <IconX className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
