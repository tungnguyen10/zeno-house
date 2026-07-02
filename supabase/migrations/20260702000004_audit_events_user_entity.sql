-- =============================================================================
-- audit_events: extend entity_type to cover user management + service entities
-- =============================================================================
-- Adds 'user' so user/role management (create, update, role change, delete,
-- building assignment add/remove) can be audited.
--
-- Also adds 'building_service' and 'contract_service', which the application
-- already emits (building_service.removed / contract_service.removed) but the
-- original CHECK omitted, so those inserts were silently rejected.
--
-- The inline CHECK on entity_type is auto-named audit_events_entity_type_check.
-- =============================================================================

ALTER TABLE public.audit_events
  DROP CONSTRAINT IF EXISTS audit_events_entity_type_check;

ALTER TABLE public.audit_events
  ADD CONSTRAINT audit_events_entity_type_check
  CHECK (entity_type IN (
    'building',
    'room',
    'tenant',
    'contract',
    'contract_renewal',
    'building_service',
    'contract_service',
    'meter_device',
    'user'
  ));
