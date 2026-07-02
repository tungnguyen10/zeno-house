-- =============================================================================
-- audit_events: extend entity_type to cover operations report financial rows
-- =============================================================================
-- Adds 'building_expense' and 'building_fixed_cost' so operations-report
-- expense/fixed-cost mutations (create/update/void/end) can be audited through
-- the shared audit service.
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
    'user',
    'building_expense',
    'building_fixed_cost'
  ));
