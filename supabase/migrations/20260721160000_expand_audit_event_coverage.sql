-- Expand the shared audit trail to every non-billing domain surfaced by
-- Settings > History. Billing retains its dedicated billing_audit_events table.

alter table public.audit_events
  drop constraint if exists audit_events_entity_type_check;

alter table public.audit_events
  add constraint audit_events_entity_type_check
  check (entity_type in (
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
    'building_fixed_cost',
    'recurring_expense',
    'prepaid_expense',
    'support_request',
    'contract_occupant',
    'contract_payment',
    'service_catalog_item',
    'shared_expense',
    'reserve_fund',
    'reserve_fund_rate',
    'operations_report_period',
    'tenant_document'
  ));
