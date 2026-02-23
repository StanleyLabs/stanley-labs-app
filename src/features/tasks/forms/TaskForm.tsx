import { useEffect, useMemo, useRef, useState } from "react";
import type { TaskPriority, TaskStatus } from "../types";
import { STATUS_COLUMNS, PRIORITY_CONFIG } from "../types";
import { CustomSelect, Avatar } from "../ui";
import { IconX } from "../icons";
import { AVATAR_COLORS, cn, nameToInitials } from "../utils";

export type KnownAssignee = { name: string; initials: string; color: string };

export function TaskForm({
  initial,
  knownAssignees,
  knownTags,
  onSubmit,
  onCancel,
}: {
  initial: { title: string; description: string; priority: TaskPriority; status: TaskStatus; tags: string[]; assignee: string; assigneeColor: string };
  knownAssignees: KnownAssignee[];
  knownTags: string[];
  onSubmit: (v: { title: string; description: string; priority: TaskPriority; status: TaskStatus; tags: string[]; assignee: string; assigneeColor: string }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [priority, setPriority] = useState<TaskPriority>(initial.priority);
  const [status, setStatus] = useState<TaskStatus>(initial.status);
  const [tags, setTags] = useState<string[]>(initial.tags);
  const [tagInput, setTagInput] = useState("");
  const [tagFocused, setTagFocused] = useState(false);
  const tagRef = useRef<HTMLDivElement>(null);
  const [assignee, setAssignee] = useState(initial.assignee);
  const [assigneeColor, setAssigneeColor] = useState(initial.assigneeColor || AVATAR_COLORS[0]);
  const [assigneeFocused, setAssigneeFocused] = useState(false);
  const assigneeRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    if (!assignee.trim()) return knownAssignees;
    const q = assignee.toLowerCase();
    return knownAssignees.filter((a) => a.name.toLowerCase().includes(q));
  }, [assignee, knownAssignees]);

  const showSuggestions = assigneeFocused && suggestions.length > 0;

  const tagSuggestions = useMemo(() => {
    const available = knownTags.filter((t) => !tags.includes(t));
    if (!tagInput.trim()) return available;
    const q = tagInput.toLowerCase();
    return available.filter((t) => t.toLowerCase().includes(q));
  }, [tagInput, knownTags, tags]);

  const showTagSuggestions = tagFocused && tagSuggestions.length > 0;

  function addTag(tag: string) {
    const t = tag.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  useEffect(() => {
    if (!showTagSuggestions) return;
    const handler = (e: MouseEvent) => {
      if (tagRef.current && !tagRef.current.contains(e.target as Node)) setTagFocused(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showTagSuggestions]);

  useEffect(() => {
    if (!showSuggestions) return;
    const handler = (e: MouseEvent) => {
      if (assigneeRef.current && !assigneeRef.current.contains(e.target as Node)) {
        setAssigneeFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSuggestions]);

  function selectAssignee(a: KnownAssignee) {
    setAssignee(a.name);
    setAssigneeColor(a.color);
    setAssigneeFocused(false);
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          title: title.trim(),
          description: description.trim(),
          priority,
          status,
          tags,
          assignee: assignee.trim(),
          assigneeColor,
        });
      }}
    >
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="block w-full rounded-lg border border-gray-200 dark:border-dark-border bg-raised dark:bg-dark-raised px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
          placeholder="What needs to be done?"
          required
          autoFocus
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="block w-full rounded-lg border border-gray-200 dark:border-dark-border bg-raised dark:bg-dark-raised px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
          placeholder="Add more detail…"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <div className="block">
          <span className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">Status</span>
          <CustomSelect
            value={status}
            onChange={setStatus}
            options={STATUS_COLUMNS.map((c) => ({ value: c.key, label: c.label }))}
            renderOption={(opt) => {
              const col = STATUS_COLUMNS.find((c) => c.key === opt.value);
              return (
                <span className="flex items-center gap-2">
                  <span className="text-xs">{col?.icon}</span>
                  <span>{opt.label}</span>
                </span>
              );
            }}
          />
        </div>
        <div className="block">
          <span className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">Priority</span>
          <CustomSelect
            value={priority}
            onChange={setPriority}
            options={[
              { value: "urgent" as TaskPriority, label: "Urgent" },
              { value: "high" as TaskPriority, label: "High" },
              { value: "medium" as TaskPriority, label: "Medium" },
              { value: "low" as TaskPriority, label: "Low" },
            ]}
            renderOption={(opt) => {
              const cfg = PRIORITY_CONFIG[opt.value as TaskPriority];
              return (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: cfg.dot }} />
                  <span>{opt.label}</span>
                </span>
              );
            }}
          />
        </div>
      </div>
      <div className="block" ref={assigneeRef}>
        <span className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">Assignee</span>
        <div className="flex items-center gap-2">
          {assignee.trim() && (
            <Avatar initials={nameToInitials(assignee)} color={assigneeColor} />
          )}
          <div className="relative flex-1">
            <input
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              onFocus={() => setAssigneeFocused(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && assigneeFocused) { e.stopPropagation(); setAssigneeFocused(false); (e.target as HTMLElement).blur(); }
              }}
              className="block w-full rounded-lg border border-gray-200 dark:border-dark-border bg-raised dark:bg-dark-raised px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
              placeholder="Type a name…"
            />
            {showSuggestions && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-lifted animate-fade-in">
                {suggestions.map((a) => (
                  <button
                    key={a.name}
                    type="button"
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-900 dark:text-gray-100 hover:bg-canvas dark:hover:bg-dark-raised transition-colors"
                    onMouseDown={(e) => { e.preventDefault(); selectAssignee(a); }}
                  >
                    <Avatar initials={a.initials} color={a.color} />
                    <span>{a.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {assignee.trim() && (
            <button
              type="button"
              onClick={() => { setAssignee(""); setAssigneeFocused(false); }}
              className="rounded-md p-1 text-gray-400 hover:text-gray-600"
              title="Clear assignee"
            >
              <IconX className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {assignee.trim() && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-2xs text-gray-500 dark:text-gray-400">Color:</span>
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setAssigneeColor(c)}
                className={cn(
                  "h-5 w-5 rounded-full border-2 transition-all",
                  assigneeColor === c ? "border-sidebar scale-110" : "border-transparent hover:scale-105"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}
      </div>
      <div ref={tagRef} className="relative">
        <span className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">Tags</span>
        <div
          className="flex flex-wrap items-center gap-1.5 rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-raised px-2 py-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25 min-h-[38px] cursor-text"
          onClick={() => { tagRef.current?.querySelector("input")?.focus(); setTagFocused(true); }}
        >
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-md bg-accent/8 dark:bg-accent/15 px-2 py-0.5 text-2xs font-medium text-accent-dark dark:text-accent-light">
              {t}
              <button type="button" onClick={(e) => { e.stopPropagation(); removeTag(t); }} className="text-accent-dark/50 hover:text-accent-dark">
                <IconX className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
          <div className="flex-1 min-w-[80px]">
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onFocus={() => setTagFocused(true)}
              onClick={() => setTagFocused(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { e.stopPropagation(); setTagFocused(false); (e.target as HTMLElement).blur(); return; }
                if (e.key === "Enter" && tagInput.trim()) { e.preventDefault(); addTag(tagInput); }
                if (e.key === "Backspace" && !tagInput && tags.length > 0) removeTag(tags[tags.length - 1]);
                if (e.key === "," && tagInput.trim()) { e.preventDefault(); addTag(tagInput); }
              }}
              className="w-full border-none bg-transparent py-0.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 outline-none"
              placeholder={tags.length === 0 ? "Type to add tags…" : ""}
            />
          </div>
        </div>
        {showTagSuggestions && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-36 overflow-y-auto rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-lifted animate-fade-in">
            {tagSuggestions.slice(0, 8).map((t) => (
              <button
                key={t}
                type="button"
                className="flex w-full items-center px-3 py-1.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-canvas dark:hover:bg-dark-raised transition-colors"
                onMouseDown={(e) => { e.preventDefault(); addTag(t); }}
              >
                {t}
              </button>
            ))}
          </div>
        )}
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
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark focus:outline-none focus:ring-2 focus:ring-accent/30"
        >
          Save Task
        </button>
      </div>
    </form>
  );
}
