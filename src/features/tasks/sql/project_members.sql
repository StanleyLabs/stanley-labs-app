-- Project members / collaborators
-- Run this in Supabase SQL editor (or migrations).

CREATE TABLE IF NOT EXISTS project_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('viewer', 'editor', 'owner')),
  added_at timestamptz DEFAULT now(),
  UNIQUE(project_id, user_id)
);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Users can see members of projects they belong to
CREATE POLICY "Members can view project members"
  ON project_members FOR SELECT
  USING (project_id IN (
    SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
  ));

-- Users can add themselves as owner of their own projects (bootstrap)
CREATE POLICY "Creator can add self as owner"
  ON project_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'owner'
    AND project_id IN (
      SELECT p.id FROM projects p WHERE p.user_id = auth.uid()
    )
  );

-- Only owners can manage other members (insert/update/delete)
CREATE POLICY "Owners can manage members"
  ON project_members FOR ALL
  USING (project_id IN (
    SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid() AND pm.role = 'owner'
  ));

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
