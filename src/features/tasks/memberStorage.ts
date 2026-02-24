import { supabase } from "../../lib/supabase";
import type { MemberRole, ProjectMember } from "./types";

type RpcMemberRow = {
  id: string;
  project_id: string;
  user_id: string;
  role: MemberRole | string;
  added_at: string;
  email: string;
};

function toProjectMember(row: RpcMemberRow): ProjectMember {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    email: row.email,
    role: row.role as MemberRole,
    addedAt: row.added_at,
  };
}

function asMessage(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (typeof err === "object" && err && "message" in err) return String((err as any).message);
  return String(err);
}

export async function listProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const { data, error } = await supabase.rpc("get_project_members_with_email", { p_project_id: projectId });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => toProjectMember(r as RpcMemberRow));
}

export async function addProjectMember(
  projectId: string,
  email: string,
  role: MemberRole
): Promise<ProjectMember> {
  // Look up the user id by email via RPC (auth.users is not directly queryable from the client).
  const { data: userId, error: lookupErr } = await supabase.rpc("get_user_id_by_email", {
    email_input: email,
  });
  if (lookupErr) throw new Error(lookupErr.message);
  if (!userId) throw new Error("No user found with that email.");

  const { data: inserted, error: insertErr } = await supabase
    .from("project_members")
    .insert({ project_id: projectId, user_id: userId, role })
    .select("id,project_id,user_id,role,added_at")
    .single();

  if (insertErr) {
    // Friendly error for already-a-member.
    const msg = asMessage(insertErr);
    if (msg.toLowerCase().includes("duplicate") || (insertErr as any).code === "23505") {
      throw new Error("That user is already a member of this project.");
    }
    throw new Error(msg);
  }

  return {
    id: (inserted as any).id,
    projectId: (inserted as any).project_id,
    userId: (inserted as any).user_id,
    email,
    role: (inserted as any).role as MemberRole,
    addedAt: (inserted as any).added_at,
  };
}

export async function updateMemberRole(memberId: string, role: MemberRole): Promise<void> {
  const { error } = await supabase.from("project_members").update({ role }).eq("id", memberId);
  if (error) throw new Error(error.message);
}

export async function removeProjectMember(memberId: string): Promise<void> {
  const { error } = await supabase.from("project_members").delete().eq("id", memberId);
  if (error) throw new Error(error.message);
}

/** Get the current user's roles on all their projects. Returns a map of projectId -> role. */
export async function getUserRoles(userId: string): Promise<Map<string, MemberRole>> {
  const { data, error } = await supabase
    .from("project_members")
    .select("project_id,role")
    .eq("user_id", userId);
  if (error) return new Map();
  const map = new Map<string, MemberRole>();
  for (const row of data ?? []) {
    map.set((row as any).project_id, (row as any).role as MemberRole);
  }
  return map;
}

/** Get the current user's role on a project. Returns null if not a member. */
export async function getUserRole(projectId: string, userId: string): Promise<MemberRole | null> {
  const { data, error } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  if (!data) return null;
  return (data as any).role as MemberRole;
}
