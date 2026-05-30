-- Best-effort migration: map default_service_fees JSONB fields → building_services rows
-- Only migrates if the JSONB has known keys matching service_catalog codes.
-- Skips rows where the value is not a valid number.

DO $$
DECLARE
  r RECORD;
  catalog_ids JSONB;
BEGIN
  -- Build a map of code → catalog_id
  SELECT jsonb_object_agg(code, id::text) INTO catalog_ids FROM public.service_catalog;

  FOR r IN
    SELECT id AS building_id, default_service_fees AS fees
    FROM public.buildings
    WHERE default_service_fees IS NOT NULL
  LOOP
    -- internet
    IF (r.fees->>'internet') IS NOT NULL AND (r.fees->>'internet') ~ '^\d+(\.\d+)?$' THEN
      INSERT INTO public.building_services (building_id, catalog_id, default_amount, is_active)
      VALUES (r.building_id, (catalog_ids->>'internet')::uuid, (r.fees->>'internet')::numeric, true)
      ON CONFLICT (building_id, catalog_id) DO NOTHING;
    END IF;

    -- garbage
    IF (r.fees->>'garbage') IS NOT NULL AND (r.fees->>'garbage') ~ '^\d+(\.\d+)?$' THEN
      INSERT INTO public.building_services (building_id, catalog_id, default_amount, is_active)
      VALUES (r.building_id, (catalog_ids->>'garbage')::uuid, (r.fees->>'garbage')::numeric, true)
      ON CONFLICT (building_id, catalog_id) DO NOTHING;
    END IF;

    -- parking_motorbike
    IF (r.fees->>'parking_motorbike') IS NOT NULL AND (r.fees->>'parking_motorbike') ~ '^\d+(\.\d+)?$' THEN
      INSERT INTO public.building_services (building_id, catalog_id, default_amount, is_active)
      VALUES (r.building_id, (catalog_ids->>'parking_motorbike')::uuid, (r.fees->>'parking_motorbike')::numeric, true)
      ON CONFLICT (building_id, catalog_id) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;
