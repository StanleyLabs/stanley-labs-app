import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../lib/AuthContext";
import type { MemberRole, ProjectMember } from "../types";
import { PROJECT_COLORS } from "../types";
import { addProjectMember, listProjectMembers, removeProjectMember, updateMemberRole } from "../memberStorage";
import { CustomSelect } from "../ui/CustomSelect";
import { cn } from "../utils";

const ROLE_OPTIONS: { value: MemberRole; label: string }[] = [
  { value: "viewer", label: "Viewer" },
  { value: "editor", label: "Editor" },
  { value: "owner", label: "Owner" },
];

function renderRoleOption(opt: { value: MemberRole; label: string }) {
  const colors: Record<MemberRole, string> = {
    owner: "text-purple-600 dark:text-purple-300",
    editor: "text-blue-600 dark:text-blue-300",
    viewer: "text-gray-600 dark:text-gray-300",
  };
  return <span className={cn("text-xs font-medium", colors[opt.value])}>{opt.label}</span>;
}

function rolePill(role: MemberRole) {
  const base = "inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-medium";
  switch (role) {
    case "owner":
      return { label: "Owner", className: cn(base, "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900/60 dark:bg-purple-950/40 dark:text-purple-200") };
    case "editor":
      return { label: "Editor", className: cn(base, "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200") };
    case "viewer":
    default:
      return { label: "Viewer", className: cn(base, "border-gray-200 bg-gray-50 text-gray-600 dark:border-dark-border dark:bg-dark-raised dark:text-gray-300") };
  }
}

export function ProjectForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
  projectId,
  isLoggedIn,
  projectOwnerId,
}: {
  initial: { name: string; description: string; color: string };
  onSubmit: (v: { name: string; description: string; color: string }) => void;
  onCancel: () => void;
  submitLabel: string;
  projectId?: string;
  isLoggedIn?: boolean;
  projectOwnerId?: string;
}) {
  const { user } = useAuth();

  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [color, setColor] = useState(initial.color);

  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<MemberRole>("viewer");
  const [addError, setAddError] = useState<string | null>(null);
  const [addBusy, setAddBusy] = useState(false);

  const showMembers = !!isLoggedIn && !!projectId;

  const myMembership = useMemo(() => {
    if (!user) return null;
    return members.find((m) => m.userId === user.id) ?? null;
  }, [members, user]);

  const isOwner = myMembership?.role === "owner";

  async function refreshMembers() {
    if (!projectId) return;
    setMembersError(null);
    setMembersLoading(true);
    try {
      const list = await listProjectMembers(projectId);
      list.sort((a, b) => a.email.localeCompare(b.email));
      setMembers(list);
    } catch (e) {
      setMembersError(e instanceof Error ? e.message : String(e));
    } finally {
      setMembersLoading(false);
    }
  }

  useEffect(() => {
    if (!showMembers) return;
    refreshMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMembers, projectId]);

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

      {showMembers && (
        <div className="pt-2">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-800 dark:text-gray-200">Members</h3>
            <button
              type="button"
              onClick={refreshMembers}
              className="rounded-md border border-gray-200 dark:border-dark-border bg-raised dark:bg-dark-raised px-2 py-1 text-2xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-border"
            >
              Refresh
            </button>
          </div>

          {membersError && (
            <div className="mb-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-2xs text-red-700 dark:text-red-200">
              {membersError}
            </div>
          )}

          <div className="rounded-lg border border-gray-200 dark:border-dark-border bg-white/70 dark:bg-dark-surface/40">
            <div className="divide-y divide-gray-100 dark:divide-dark-border">
              {membersLoading ? (
                <div className="px-3 py-3 text-2xs text-gray-500 dark:text-gray-400">Loading members…</div>
              ) : members.length === 0 ? (
                <div className="px-3 py-3 text-2xs text-gray-500 dark:text-gray-400">No members yet.</div>
              ) : (
                members.map((m) => {
                  const pill = rolePill(m.role);
                  const isMe = user?.id && m.userId === user.id;
                  const isCreator = projectOwnerId && m.userId === projectOwnerId;
                  const canEditThis = isOwner && !isMe && !isCreator;
                  return (
                    <div key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium text-gray-900 dark:text-gray-100">
                          {m.email}{isMe ? " (you)" : ""}{isCreator && !isMe ? " (creator)" : ""}
                        </div>
                        <div className="mt-0.5">
                          <span className={pill.className}>{pill.label}</span>
                        </div>
                      </div>

                      {canEditThis && (
                        <div className="flex items-center gap-2">
                          <div className="w-28">
                            <CustomSelect
                              value={m.role}
                              onChange={async (next) => {
                                try {
                                  await updateMemberRole(m.id, next as MemberRole);
                                  setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, role: next as MemberRole } : x)));
                                } catch (err) {
                                  setMembersError(err instanceof Error ? err.message : String(err));
                                }
                              }}
                              options={ROLE_OPTIONS}
                              renderOption={(opt) => renderRoleOption(opt as { value: MemberRole; label: string })}
                              className="h-8 py-0"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await removeProjectMember(m.id);
                                setMembers((prev) => prev.filter((x) => x.id !== m.id));
                              } catch (err) {
                                setMembersError(err instanceof Error ? err.message : String(err));
                              }
                            }}
                            className="h-8 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-2.5 text-2xs font-medium text-red-700 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-950/60"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {isOwner && (
              <div className="border-t border-gray-100 dark:border-dark-border px-3 py-3">
                <div className="mb-1.5 text-2xs font-semibold text-gray-700 dark:text-gray-300">Add member</div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder="email@company.com"
                    className="h-8 w-full rounded-lg border border-gray-200 dark:border-dark-border bg-raised dark:bg-dark-raised px-3 text-xs text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
                  />
                  <div className="w-full sm:w-32">
                    <CustomSelect
                      value={addRole}
                      onChange={(v) => setAddRole(v as MemberRole)}
                      options={ROLE_OPTIONS}
                      renderOption={(opt) => renderRoleOption(opt as { value: MemberRole; label: string })}
                      className="h-8 py-0"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={addBusy || !addEmail.trim()}
                    onClick={async () => {
                      if (!projectId) return;
                      setAddError(null);
                      setAddBusy(true);
                      try {
                        const m = await addProjectMember(projectId, addEmail.trim(), addRole);
                        setMembers((prev) => {
                          const next = [...prev, m];
                          next.sort((a, b) => a.email.localeCompare(b.email));
                          return next;
                        });
                        setAddEmail("");
                        setAddRole("viewer");
                      } catch (e) {
                        setAddError(e instanceof Error ? e.message : String(e));
                      } finally {
                        setAddBusy(false);
                      }
                    }}
                    className={cn(
                      "h-8 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent-dark",
                      (addBusy || !addEmail.trim()) && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    {addBusy ? "Adding…" : "Add"}
                  </button>
                </div>
                {addError && (
                  <div className="mt-2 text-2xs text-red-600 dark:text-red-300">{addError}</div>
                )}
                <div className="mt-2 text-2xs text-gray-500 dark:text-gray-400">
                  Owners can change roles and remove members (you can’t change your own role).
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
