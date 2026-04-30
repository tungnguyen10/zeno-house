-- ============================================================
-- 004_building_managers.sql
-- Replace buildings.manager_id with a building_managers junction table
-- enabling multiple managers per building with per-feature permissions.
-- ============================================================

-- ============================================================
-- 1. Create building_managers table
-- ============================================================

CREATE TABLE building_managers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  manager_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  granted_by  UUID NOT NULL REFERENCES profiles(id),
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (building_id, manager_id)
);

CREATE INDEX idx_building_managers_building_id ON building_managers(building_id);
CREATE INDEX idx_building_managers_manager_id ON building_managers(manager_id);

-- ============================================================
-- 2. Enable RLS on building_managers
-- ============================================================

ALTER TABLE building_managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "building_managers_admin_all" ON building_managers
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "building_managers_manager_select" ON building_managers
  FOR SELECT USING (manager_id = auth.uid());

-- ============================================================
-- 3. Backfill from buildings.manager_id
-- ============================================================

INSERT INTO building_managers (building_id, manager_id, permissions, granted_by)
SELECT
  id AS building_id,
  manager_id,
  ARRAY['rooms', 'contracts', 'invoices', 'tenants', 'utilities'] AS permissions,
  manager_id AS granted_by
FROM buildings
WHERE manager_id IS NOT NULL
ON CONFLICT (building_id, manager_id) DO NOTHING;

-- ============================================================
-- 4. Update manages_building() helper to use building_managers
-- ============================================================

CREATE OR REPLACE FUNCTION manages_building(p_building_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM building_managers
    WHERE building_id = p_building_id AND manager_id = auth.uid()
  );
$$;

-- manages_building_with_permission: checks a specific feature permission
CREATE OR REPLACE FUNCTION manages_building_with_permission(p_building_id UUID, p_feature TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM building_managers
    WHERE building_id = p_building_id
      AND manager_id = auth.uid()
      AND p_feature = ANY(permissions)
  );
$$;

-- ============================================================
-- 5. Drop buildings.manager_id column
-- ============================================================

ALTER TABLE buildings DROP COLUMN IF EXISTS manager_id;
DROP INDEX IF EXISTS idx_buildings_manager_id;
