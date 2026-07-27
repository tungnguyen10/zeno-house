import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260723103000_add_invoice_email_delivery.sql',
)
const verificationPath = resolve(
  process.cwd(),
  'supabase/verification/invoice_email_delivery.sql',
)
const resendMigrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260727120000_add_invoice_email_resends.sql',
)
const migration = readFileSync(migrationPath, 'utf8')
const sql = migration.toLowerCase()
const verification = readFileSync(verificationPath, 'utf8').toLowerCase()
const resendSql = readFileSync(resendMigrationPath, 'utf8').toLowerCase()

describe('invoice email delivery migration', () => {
  it('creates default-off settings and durable delivery/webhook tables', () => {
    expect(sql).toContain('create table public.building_invoice_email_settings')
    expect(sql).toMatch(/auto_send_enabled\s+boolean\s+not null default false/)
    expect(sql).toContain('create table public.invoice_email_deliveries')
    expect(sql).toContain('create table public.invoice_email_webhook_events')
    expect(sql).toMatch(/svix_id\s+text\s+not null\s+unique/)
  })

  it('snapshots valid recipients and records missing recipients as skipped', () => {
    expect(sql).toContain('new.tenant_id')
    expect(sql).toContain('invoice_email_normalize_recipient(v_raw_email)')
    expect(sql).toContain("'recipient_missing'")
    expect(sql).toContain("'recipient_invalid'")
    expect(sql).toContain("'skipped'")
  })

  it('queues atomically for every non-void invoice insert when auto-send is enabled', () => {
    expect(sql).toContain('create trigger invoices_enqueue_email_delivery')
    expect(sql).toContain('after insert on public.invoices')
    expect(sql).toContain('enqueue_automatic_invoice_email_delivery')
    expect(sql).toContain("new.status = 'void'")
    expect(sql).toContain('coalesce(setting.auto_send_enabled, false)')
  })

  it('deduplicates active deliveries and supports atomic manual enqueue plus lease reclaim', () => {
    expect(sql).toContain('uq_invoice_email_deliveries_active_recipient')
    expect(sql).toContain("where status in ('queued', 'processing', 'accepted')")
    expect(sql).toContain('enqueue_invoice_email_delivery')
    expect(sql).toContain('claim_invoice_email_deliveries')
    expect(sql).toContain('for update skip locked')
    expect(sql).toContain('lease_expires_at < now()')
    expect(sql).toContain('apply_invoice_email_webhook_event')
    expect(sql).toContain('on conflict (svix_id) do nothing')
    expect(sql).toContain('for update;')
  })

  it('keeps all new tables deny-by-default and functions service-role only', () => {
    for (const table of [
      'building_invoice_email_settings',
      'invoice_email_deliveries',
      'invoice_email_webhook_events',
    ]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`)
      expect(sql).toContain(`revoke all on table public.${table} from public, anon, authenticated`)
      expect(sql).toContain(`grant select, insert, update, delete on table public.${table} to service_role`)
    }

    expect(sql).toContain('security definer')
    expect(sql).toContain("set search_path = ''")
    expect(sql).toContain('revoke all on function public.enqueue_invoice_email_delivery')
    expect(sql).toContain('revoke all on function public.claim_invoice_email_deliveries')
    expect(sql).toContain('to service_role')
  })

  it('writes concise queue audit events and ships rollback-safe SQL Editor verification', () => {
    expect(sql).toContain("'invoice.email_queued'")
    expect(sql).toContain("'invoice'")
    expect(verification).toContain('begin;')
    expect(verification).toContain('rollback;')
    expect(verification).toMatch(/period issue,[\s\S]*issue-and-pay, and[\s\S]*reissue/)
    expect(verification).toContain('uq_invoice_email_deliveries_active_recipient')
    expect(verification).toContain('invoice_email_webhook_events_svix_id_key')
  })

  it('keeps prior provider outcomes while allowing an explicit, linked resend', () => {
    expect(resendSql).toContain('add column supersedes_delivery_id uuid')
    expect(resendSql).toContain('add column resend_released_at timestamptz')
    expect(resendSql).toContain('resend_invoice_email_delivery')
    expect(resendSql).toContain("v_previous.status in ('accepted', 'delivered') and not p_confirm_duplicate")
    expect(resendSql).toContain("v_previous.status in ('bounced', 'complained')")
    expect(resendSql).toContain("v_previous.status in ('queued', 'processing')")
    expect(resendSql).toContain('supersedes_delivery_id')
    expect(resendSql).toContain('resend_released_at is null')
    expect(resendSql).toContain("grant execute on function public.resend_invoice_email_delivery(uuid, uuid, boolean)")
  })
})
