-- =============================================================================
-- audit_events: entity master data audit trail
-- =============================================================================
-- Tracks mutations on domain entities: buildings, rooms, tenants, contracts.
-- Separate from billing_audit_events (which tracks billing operations).
--
-- building_id is nullable: tenant events have no direct building context.
-- correlation_id links per-entity child events to their bulk aggregate parent.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.audit_events (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id     uuid        REFERENCES public.buildings(id) ON DELETE CASCADE,
  actor_id        uuid        REFERENCES auth.users(id),
  action          text        NOT NULL CHECK (length(action) > 0),
  entity_type     text        NOT NULL CHECK (entity_type IN (
                                'building', 'room', 'tenant', 'contract',
                                'contract_renewal', 'meter_device'
                              )),
  entity_id       uuid,
  correlation_id  uuid,
  before_data     jsonb,
  after_data      jsonb,
  metadata        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Building timeline (partial: tenant events have NULL building_id)
CREATE INDEX IF NOT EXISTS idx_audit_events_building_created
  ON public.audit_events (building_id, created_at DESC)
  WHERE building_id IS NOT NULL;

-- Per-entity audit feed
CREATE INDEX IF NOT EXISTS idx_audit_events_entity_created
  ON public.audit_events (entity_type, entity_id, created_at DESC);

-- Per-actor history
CREATE INDEX IF NOT EXISTS idx_audit_events_actor_created
  ON public.audit_events (actor_id, created_at DESC);

-- Bulk event children lookup
CREATE INDEX IF NOT EXISTS idx_audit_events_correlation
  ON public.audit_events (correlation_id)
  WHERE correlation_id IS NOT NULL;


-- ----------------------------------------------------------------------------
-- Row Level Security
-- The server uses service-role for business reads/writes (bypasses RLS).
-- These policies are a safety net for any direct authenticated access.
-- ----------------------------------------------------------------------------

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Admin: full access
DROP POLICY IF EXISTS audit_events_admin_all ON public.audit_events;
CREATE POLICY audit_events_admin_all
  ON public.audit_events
  FOR ALL TO authenticated
  USING  ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Manager: read building-scoped events only
-- NULL building_id events (tenant global events) are NOT visible to managers
DROP POLICY IF EXISTS audit_events_manager_select ON public.audit_events;
CREATE POLICY audit_events_manager_select
  ON public.audit_events
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
    AND building_id IS NOT NULL
  );

-- Manager: insert building-scoped events only (append-only; no UPDATE/DELETE)
DROP POLICY IF EXISTS audit_events_manager_insert ON public.audit_events;
CREATE POLICY audit_events_manager_insert
  ON public.audit_events
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
    AND building_id IS NOT NULL
  );
