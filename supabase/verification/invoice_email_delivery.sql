-- Run after applying 20260723103000_add_invoice_email_delivery.sql in the
-- Supabase Dashboard SQL Editor. Every assertion runs inside a transaction and
-- ends with ROLLBACK, so verification does not retain fixture or setting data.
--
-- The single AFTER INSERT trigger covers period issue, issue-and-pay, and
-- reissue because all three paths insert into public.invoices.

begin;

do $$
declare
  v_default text;
  v_trigger_count integer;
  v_active_index_count integer;
  v_webhook_constraint_count integer;
begin
  select column_default
    into v_default
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'building_invoice_email_settings'
     and column_name = 'auto_send_enabled';
  if v_default is distinct from 'false'::text then
    raise exception 'auto_send_enabled must default to false, got %', v_default;
  end if;

  select count(*)
    into v_trigger_count
    from information_schema.triggers
   where event_object_schema = 'public'
     and event_object_table = 'invoices'
     and trigger_name = 'invoices_enqueue_email_delivery'
     and event_manipulation = 'INSERT'
     and action_timing = 'AFTER';
  if v_trigger_count <> 1 then
    raise exception 'invoice enqueue trigger missing';
  end if;

  select count(*)
    into v_active_index_count
    from pg_indexes
   where schemaname = 'public'
     and tablename = 'invoice_email_deliveries'
     and indexname = 'uq_invoice_email_deliveries_active_recipient'
     and indexdef ilike '%queued%'
     and indexdef ilike '%processing%'
     and indexdef ilike '%accepted%';
  if v_active_index_count <> 1 then
    raise exception 'uq_invoice_email_deliveries_active_recipient missing';
  end if;

  select count(*)
    into v_webhook_constraint_count
    from information_schema.table_constraints
   where table_schema = 'public'
     and table_name = 'invoice_email_webhook_events'
     and constraint_name = 'invoice_email_webhook_events_svix_id_key'
     and constraint_type = 'UNIQUE';
  if v_webhook_constraint_count <> 1 then
    raise exception 'invoice_email_webhook_events_svix_id_key missing';
  end if;
end;
$$;

-- Operational fixture verification to run with a disposable building/invoice:
-- 1. Insert a setting row without auto_send_enabled; assert it is false.
-- 2. Enable it and issue one invoice through each of period issue,
--    issue-and-pay, and reissue; assert one queued row per valid recipient.
-- 3. Repeat with NULL and malformed tenants.email; assert skipped rows contain
--    recipient_missing and recipient_invalid without aborting invoice inserts.
-- 4. Call enqueue_invoice_email_delivery twice in one transaction; assert the
--    active delivery UUID is reused. Mark it terminal and call again; assert a
--    new UUID is returned.
-- 5. Claim a row, expire lease_expires_at, and claim from a second
--    worker; assert the same row is reclaimed and attempt_count increments.
-- 6. Insert the same svix_id twice; assert the second insert raises unique_violation.
-- 7. Intentionally raise after inserting an invoice and confirm both the invoice
--    and its automatic delivery/audit writes roll back together.

rollback;
