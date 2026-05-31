-- Fix billing_service_snapshots pricing_type constraint to match service_catalog values
ALTER TABLE public.billing_service_snapshots
  DROP CONSTRAINT billing_service_snapshots_pricing_type_check;

ALTER TABLE public.billing_service_snapshots
  ADD CONSTRAINT billing_service_snapshots_pricing_type_check
  CHECK (pricing_type IN ('fixed', 'fixed_per_room', 'per_person', 'per_vehicle'));
