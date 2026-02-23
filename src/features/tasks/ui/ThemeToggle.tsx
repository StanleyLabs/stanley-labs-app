import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme, type ThemeOption } from "../theme";
import { cn } from "../utils";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (dropRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); setOpen(false); }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler, true);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler, true);
    };
  }, [open]);

  function handleToggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setOpen((v) => !v);
  }

  const options: { value: ThemeOption; label: string; icon: React.ReactNode }[] = [
    {
      value: "light",
      label: "Light",
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      ),
    },
    {
      value: "dark",
      label: "Dark",
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
        </svg>
      ),
    },
    {
      value: "system",
      label: "System",
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
        </svg>
      ),
    },
  ];

  const current = options.find((o) => o.value === theme)!;

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="flex items-center justify-center rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-raised p-1.5 text-gray-500 dark:text-gray-400 hover:bg-canvas dark:hover:bg-dark-border hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        title={`Theme: ${current.label}`}
      >
        {current.icon}
      </button>
      {open && createPortal(
        <div
          ref={dropRef}
          className="fixed w-36 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-overlay animate-fade-in overflow-hidden"
          style={{ top: pos.top, right: pos.right, zIndex: 9999 }}
        >
          {options.map((o) => (
            <button
              key={o.value}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-2 text-xs transition-colors",
                o.value === theme
                  ? "bg-accent/10 text-accent-dark dark:text-accent-light font-medium"
                  : "text-gray-700 dark:text-gray-300 hover:bg-canvas dark:hover:bg-dark-raised"
              )}
              onClick={() => { setTheme(o.value); setOpen(false); }}
            >
              {o.icon}
              {o.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
