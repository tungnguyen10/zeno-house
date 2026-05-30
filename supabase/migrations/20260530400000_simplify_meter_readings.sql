-- Simplify meter model: drop meter_device_id, use room+type as identity

-- Step 1: Drop old unique constraint on meter_device_id
ALTER TABLE public.meter_readings
  DROP CONSTRAINT IF EXISTS meter_readings_meter_device_id_period_year_period_month_readi_key;

-- Step 2: Add new unique constraint based on room + meter_type
ALTER TABLE public.meter_readings
  ADD CONSTRAINT meter_readings_room_type_period_unique
  UNIQUE (room_id, meter_type, period_year, period_month, reading_type);

-- Step 3: Drop FK constraint on meter_device_id
ALTER TABLE public.meter_readings
  DROP CONSTRAINT IF EXISTS meter_readings_meter_device_id_fkey;

-- Step 4: Drop meter_device_id column
ALTER TABLE public.meter_readings
  DROP COLUMN IF EXISTS meter_device_id;

-- Step 5: Drop meter_devices table (auto-created data only, no business value)
DROP TABLE IF EXISTS public.meter_devices CASCADE;
