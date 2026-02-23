import { cn } from "../utils";

export function Avatar({ initials, color, size = "sm" }: { initials: string; color: string; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-medium text-white",
        size === "sm" ? "h-6 w-6 text-2xs" : "h-8 w-8 text-xs"
      )}
      style={{ backgroundColor: color }}
    >
      {initials}
    </span>
  );
}
