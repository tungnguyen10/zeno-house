-- Task 1.1: Backfill building_id from rooms, then set NOT NULL

-- Safety check: log orphan contracts (no matching room) before backfill
DO $$
DECLARE
  orphan_count integer;
BEGIN
  SELECT count(*) INTO orphan_count
  FROM public.contracts c
  LEFT JOIN public.rooms r ON c.room_id = r.id
  WHERE r.id IS NULL;

  IF orphan_count > 0 THEN
    RAISE NOTICE 'WARNING: % contract(s) have no matching room. They will keep building_id = NULL after backfill.', orphan_count;
  END IF;
END $$;

-- Backfill building_id from rooms for contracts that have NULL
UPDATE public.contracts c
SET building_id = r.building_id
FROM public.rooms r
WHERE c.room_id = r.id
  AND c.building_id IS NULL;

-- Set NOT NULL constraint
ALTER TABLE public.contracts
  ALTER COLUMN building_id SET NOT NULL;
