-- Project members / collaborators
-- Run this in Supabase SQL editor.
--
-- If you already created the old policies, drop them first:
--   DROP POLICY IF EXISTS "Members can view project members" ON project_members;
--   DROP POLICY IF EXISTS "Creator can add self as owner" ON project_members;
--   DROP POLICY IF EXISTS "Owners can manage members" ON project_members;

CREATE TABLE IF NOT EXISTS project_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('viewer', 'editor', 'owner')),
  added_at timestamptz DEFAULT now(),
  UNIQUE(project_id, user_id)
);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Helper: check if a user is an owner of a project (avoids recursive policy lookups)
CREATE OR REPLACE FUNCTION is_project_owner(p_project_id text, p_user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id
      AND user_id = p_user_id
      AND role = 'owner'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- SELECT: users can see rows where they ARE the member (no self-join needed)
CREATE POLICY "Users can see own memberships"
  ON project_members FOR SELECT
  USING (user_id = auth.uid());

-- SELECT: owners can see all members of their projects
CREATE POLICY "Owners can see project members"
  ON project_members FOR SELECT
  USING (is_project_owner(project_id, auth.uid()));

-- INSERT: project creator can bootstrap themselves as owner
CREATE POLICY "Creator can add self as owner"
  ON project_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'owner'
    AND project_id IN (
      SELECT p.id FROM projects p WHERE p.user_id = auth.uid()
    )
  );

-- INSERT: owners can add other members
CREATE POLICY "Owners can add members"
  ON project_members FOR INSERT
  WITH CHECK (is_project_owner(project_id, auth.uid()));

-- UPDATE: owners can update member roles
CREATE POLICY "Owners can update members"
  ON project_members FOR UPDATE
  USING (is_project_owner(project_id, auth.uid()));

-- DELETE: owners can remove members
CREATE POLICY "Owners can delete members"
  ON project_members FOR DELETE
  USING (is_project_owner(project_id, auth.uid()));

-- RPC helpers (client cannot directly query auth.users)

CREATE OR REPLACE FUNCTION get_user_id_by_email(email_input text)
RETURNS uuid AS $$
  SELECT id FROM auth.users WHERE email = email_input LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_project_members_with_email(p_project_id text)
RETURNS TABLE(id uuid, project_id text, user_id uuid, role text, added_at timestamptz, email text) AS $$
  SELECT pm.id, pm.project_id, pm.user_id, pm.role, pm.added_at, u.email
  FROM project_members pm
  JOIN auth.users u ON u.id = pm.user_id
  WHERE pm.project_id = p_project_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Allow project members to read tasks on projects they have access to
-- (Run this after ensuring tasks table has RLS enabled)
CREATE POLICY "Members can view project tasks"
  ON tasks FOR SELECT
  USING (
    project_id IN (
      SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

-- Allow editors/owners to create tasks on shared projects
CREATE POLICY "Editors can create tasks on shared projects"
  ON tasks FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      project_id IN (
        SELECT pm.project_id FROM project_members pm
        WHERE pm.user_id = auth.uid() AND pm.role IN ('editor', 'owner')
      )
    )
  );

-- Allow editors/owners to update tasks on shared projects
CREATE POLICY "Editors can update tasks on shared projects"
  ON tasks FOR UPDATE
  USING (
    project_id IN (
      SELECT pm.project_id FROM project_members pm
      WHERE pm.user_id = auth.uid() AND pm.role IN ('editor', 'owner')
    )
    OR user_id = auth.uid()
  );

-- Allow editors/owners to delete tasks on shared projects
CREATE POLICY "Editors can delete tasks on shared projects"
  ON tasks FOR DELETE
  USING (
    project_id IN (
      SELECT pm.project_id FROM project_members pm
      WHERE pm.user_id = auth.uid() AND pm.role IN ('editor', 'owner')
    )
    OR user_id = auth.uid()
  );

-- Allow project members to read shared projects
CREATE POLICY "Members can view shared projects"
  ON projects FOR SELECT
  USING (
    id IN (
      SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );
