import { useEffect, useRef, useState } from "react";
import { cn } from "../utils";

export function CustomSelect<T extends string>({
  value,
  onChange,
  options,
  placeholder,
  renderOption,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  placeholder?: string;
  renderOption?: (opt: { value: T; label: string }, isSelected: boolean) => React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); setOpen(false); }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey, true);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey, true);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between rounded-lg border bg-white dark:bg-dark-raised px-3 py-2 text-left text-sm transition-colors",
          className,
          open ? "border-accent ring-2 ring-accent/25" : "border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600"
        )}
      >
        <span className={selected ? "text-gray-900 dark:text-gray-100" : "text-gray-400"}>
          {selected && renderOption ? renderOption(selected, true) : (selected?.label ?? placeholder ?? "Select…")}
        </span>
        <svg className={cn("h-3.5 w-3.5 text-gray-400 transition-transform", open && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-lifted animate-fade-in">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={cn(
                "flex w-full items-center px-3 py-2 text-left text-sm transition-colors",
                o.value === value
                  ? "bg-accent/8 font-medium"
                  : "hover:bg-canvas dark:hover:bg-dark-raised"
              )}
              onClick={() => { onChange(o.value); setOpen(false); }}
            >
              {renderOption ? renderOption(o, o.value === value) : o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
