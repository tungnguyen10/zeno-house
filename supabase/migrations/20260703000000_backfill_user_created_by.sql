-- =============================================================================
-- Backfill auth.users app_metadata.created_by from user.created audit events
-- =============================================================================
-- Owners see managers they created via `app_metadata.created_by`. That field was
-- only recorded on the auth user starting with the creator-tracking change, so
-- managers created earlier have a null `created_by` and stay hidden from their
-- owner unless they also hold an in-scope building assignment.
--
-- This backfills `created_by` from the earliest `user.created` audit event
-- (entity_type = 'user'), which links each managed account to its creator.
-- It is idempotent: only rows whose `created_by` is currently unset are touched.
--
-- Note: `user.created` audit inserts were only accepted once entity_type 'user'
-- was allowed (migration 20260702000004). Accounts created before that have no
-- audit trail and cannot be backfilled here; they remain visible to their owner
-- through building assignments.
-- =============================================================================

UPDATE auth.users AS u
SET raw_app_meta_data =
      COALESCE(u.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('created_by', ae.actor_id)
FROM (
  SELECT DISTINCT ON (entity_id)
    entity_id,
    actor_id
  FROM public.audit_events
  WHERE action = 'user.created'
    AND entity_type = 'user'
    AND actor_id IS NOT NULL
  ORDER BY entity_id, created_at ASC
) AS ae
WHERE u.id = ae.entity_id
  AND (u.raw_app_meta_data ->> 'created_by') IS NULL;
