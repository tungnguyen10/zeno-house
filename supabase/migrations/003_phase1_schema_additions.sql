-- ============================================================
-- 003_phase1_schema_additions.sql
-- Phase 1 schema additions — columns, enums, new table
-- ============================================================

-- ============================================================
-- ENUM ADDITIONS
-- (must run before any column that uses the new values)
-- ============================================================

-- contract_status: add pending_signature (between pending and active)
-- and renewed (terminal state for replaced contracts)
ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'pending_signature' BEFORE 'active';
ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'renewed' AFTER 'terminated';

-- ============================================================
-- COLUMN ADDITIONS — existing tables
-- ============================================================

-- buildings: floor count context for occupancy grid
ALTER TABLE buildings
  ADD COLUMN IF NOT EXISTS total_floors INTEGER NOT NULL DEFAULT 1;

-- rooms: thumbnail image for card/list views
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- tenants: CCCD photo storage (Phase 4 AI OCR hook — logic in Phase 4)
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS cccd_front_url TEXT,
  ADD COLUMN IF NOT EXISTS cccd_back_url  TEXT,
  ADD COLUMN IF NOT EXISTS cccd_verified  BOOLEAN NOT NULL DEFAULT false;

-- contracts: rendered HTML snapshot, renewal chain, termination reason
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS content_html         TEXT,
  ADD COLUMN IF NOT EXISTS previous_contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS terminated_reason    TEXT;

-- maintenance_requests: photo uploads, assignment, cost tracking
ALTER TABLE maintenance_requests
  ADD COLUMN IF NOT EXISTS image_urls      TEXT[]      NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS assigned_to     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estimated_cost  NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS actual_cost     NUMERIC(12,2);

-- ============================================================
-- NEW TABLE: maintenance_status_history
-- Audit trail for every status change on a maintenance request
-- ============================================================

CREATE TABLE IF NOT EXISTS maintenance_status_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id  UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  from_status maintenance_status,
  to_status   maintenance_status NOT NULL,
  changed_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_maintenance_history_request_id
  ON maintenance_status_history(request_id);

CREATE INDEX IF NOT EXISTS idx_contracts_previous_id
  ON contracts(previous_contract_id);

CREATE INDEX IF NOT EXISTS idx_maintenance_requests_assigned_to
  ON maintenance_requests(assigned_to);

-- ============================================================
-- RLS — maintenance_status_history
-- ============================================================

ALTER TABLE maintenance_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin: full access" ON maintenance_status_history
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "manager: manage history in own buildings" ON maintenance_status_history
  FOR ALL USING (
    request_id IN (
      SELECT id FROM maintenance_requests
      WHERE manages_building(room_building_id(room_id))
    )
  );

CREATE POLICY "tenant: read own request history" ON maintenance_status_history
  FOR SELECT USING (
    request_id IN (
      SELECT id FROM maintenance_requests WHERE tenant_id = auth.uid()
    )
  );

-- ============================================================
-- RLS UPDATE — contracts tenant policy
-- Multi-tenant model (Option A): 1 shared contract per room.
-- All room_tenants for a room can read the contract, not just
-- the primary tenant stored in contracts.tenant_id.
-- ============================================================

DROP POLICY IF EXISTS "tenant: read own contracts" ON contracts;

CREATE POLICY "tenant: read room contracts" ON contracts
  FOR SELECT USING (
    room_id IN (
      SELECT rt.room_id FROM room_tenants rt WHERE rt.tenant_id = auth.uid()
    )
  );
