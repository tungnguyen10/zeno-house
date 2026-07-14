-- =============================================================================
-- billing_audit_search_page RPC
-- =============================================================================
-- Provides server-side filtering + stable cursor pagination for billing audit.
--
-- Signature includes p_cursor_id (UUID tie-breaker) so pagination remains
-- deterministic when multiple rows share the same created_at timestamp.
-- =============================================================================

BEGIN;

-- Remove older timestamp-only overload if present.
DROP FUNCTION IF EXISTS public.billing_audit_search_page(
  uuid,
  uuid[],
  text[],
  timestamptz,
  timestamptz,
  uuid,
  timestamptz,
  text,
  integer
);

CREATE OR REPLACE FUNCTION public.billing_audit_search_page(
  p_period_id uuid,
  p_actor_ids uuid[],
  p_actions text[],
  p_from timestamptz,
  p_to timestamptz,
  p_correlation_id uuid,
  p_cursor timestamptz,
  p_cursor_id uuid,
  p_query text,
  p_limit integer
)
RETURNS SETOF public.billing_audit_events
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT a.*
  FROM public.billing_audit_events a
  LEFT JOIN public.invoices i ON a.entity_type = 'invoice' AND i.id = a.entity_id
  LEFT JOIN public.tenants t ON t.id = CASE WHEN a.entity_type = 'tenant' THEN a.entity_id ELSE i.tenant_id END
  LEFT JOIN public.rooms r ON r.id = CASE WHEN a.entity_type = 'room' THEN a.entity_id ELSE i.room_id END
  LEFT JOIN auth.users u ON u.id = a.actor_id
  WHERE a.billing_period_id = p_period_id
    AND (p_actor_ids IS NULL OR a.actor_id = ANY(p_actor_ids))
    AND (p_actions IS NULL OR a.action = ANY(p_actions))
    AND (p_from IS NULL OR a.created_at >= p_from)
    AND (p_to IS NULL OR a.created_at <= p_to)
    AND (p_correlation_id IS NULL OR a.correlation_id = p_correlation_id)
    AND (
      p_cursor IS NULL
      OR a.created_at < p_cursor
      OR (p_cursor_id IS NOT NULL AND a.created_at = p_cursor AND a.id < p_cursor_id)
    )
    AND (
      p_query IS NULL OR p_query = ''
      OR a.action ILIKE '%' || p_query || '%'
      OR a.metadata::text ILIKE '%' || p_query || '%'
      OR COALESCE(i.invoice_code, '') ILIKE '%' || p_query || '%'
      OR COALESCE(t.full_name, '') ILIKE '%' || p_query || '%'
      OR COALESCE(r.room_number, '') ILIKE '%' || p_query || '%'
      OR COALESCE(u.email, '') ILIKE '%' || p_query || '%'
      OR COALESCE(u.raw_user_meta_data ->> 'full_name', '') ILIKE '%' || p_query || '%'
    )
  ORDER BY a.created_at DESC, a.id DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100) + 1;
$$;

REVOKE ALL ON FUNCTION public.billing_audit_search_page(
  uuid,
  uuid[],
  text[],
  timestamptz,
  timestamptz,
  uuid,
  timestamptz,
  uuid,
  text,
  integer
) FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.billing_audit_search_page(
  uuid,
  uuid[],
  text[],
  timestamptz,
  timestamptz,
  uuid,
  timestamptz,
  uuid,
  text,
  integer
) TO service_role;

COMMIT;
