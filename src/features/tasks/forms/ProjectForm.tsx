import { useState } from "react";
import { PROJECT_COLORS } from "../types";
import { cn } from "../utils";

export function ProjectForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initial: { name: string; description: string; color: string };
  onSubmit: (v: { name: string; description: string; color: string }) => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [color, setColor] = useState(initial.color);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name: name.trim(), description: description.trim(), color });
      }}
    >
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">Project name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="block w-full rounded-lg border border-gray-200 dark:border-dark-border bg-raised dark:bg-dark-raised px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
          placeholder="My new project"
          required
          autoFocus
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">Description</span>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="block w-full rounded-lg border border-gray-200 dark:border-dark-border bg-raised dark:bg-dark-raised px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
          placeholder="What's this project about?"
        />
      </label>
      <div>
        <span className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300">Color</span>
        <div className="flex flex-wrap gap-2">
          {PROJECT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                "h-7 w-7 rounded-full border-2 transition-all",
                color === c ? "border-sidebar scale-110 shadow-card" : "border-transparent hover:scale-105"
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-200 dark:border-dark-border bg-raised dark:bg-dark-raised px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-border"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
