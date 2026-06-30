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
    'meter_device'
  ));
