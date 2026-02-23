import type { TaskPriority } from "../types";
import { PRIORITY_CONFIG } from "../types";
import { cn } from "../utils";

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const styles: Record<TaskPriority, string> = {
    urgent: "bg-pri-urgent/10 text-pri-urgent border-pri-urgent/20",
    high: "bg-pri-high/10 text-pri-high border-pri-high/20",
    medium: "bg-pri-medium/10 text-pri-medium border-pri-medium/20",
    low: "bg-gray-100 dark:bg-dark-border text-gray-500 dark:text-gray-400 border-gray-200 dark:border-dark-border",
  };
  const config = PRIORITY_CONFIG[priority];
  return (
    <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-2xs font-medium", styles[priority])}>
      {config.label}
    </span>
  );
}
