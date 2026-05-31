-- Migration: Extend meter_readings for billing inputs
-- Adds old_reading, new_reading, consumption, is_adjusted, adjustment_reason, updated_by

ALTER TABLE public.meter_readings
  ADD COLUMN IF NOT EXISTS old_reading numeric,
  ADD COLUMN IF NOT EXISTS new_reading numeric,
  ADD COLUMN IF NOT EXISTS consumption numeric,
  ADD COLUMN IF NOT EXISTS is_adjusted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS adjustment_reason text,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);

COMMENT ON COLUMN public.meter_readings.old_reading IS 'Previous meter value (auto-populated from latest reading for this room+type)';
COMMENT ON COLUMN public.meter_readings.new_reading IS 'New meter value entered during billing run; synced to reading_value';
COMMENT ON COLUMN public.meter_readings.consumption IS 'Calculated (new-old) or manually overridden when is_adjusted=true';
COMMENT ON COLUMN public.meter_readings.is_adjusted IS 'True when consumption was manually overridden by admin';
COMMENT ON COLUMN public.meter_readings.adjustment_reason IS 'Required when is_adjusted=true (meter replaced, malfunction, reset)';
COMMENT ON COLUMN public.meter_readings.updated_by IS 'User who last updated this reading';
