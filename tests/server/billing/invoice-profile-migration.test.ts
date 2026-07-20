import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260720144500_add_building_invoice_profile.sql'),
  'utf8',
).toLowerCase()

describe('building invoice profile migration', () => {
  it('creates the profile table, immutable invoice snapshot, and private constrained bucket', () => {
    expect(migration).toContain('create table public.building_invoice_profiles')
    expect(migration).toContain('invoice_profile_snapshot jsonb')
    expect(migration).toContain("'building-invoice-assets'")
    expect(migration).toContain("'image/jpeg'")
    expect(migration).toContain("'image/png'")
    expect(migration).toContain("'image/webp'")
    expect(migration).toContain('5242880')
    expect(migration).toContain('enable row level security')
  })

  it('renders only supported variables and snapshots every invoice insert transactionally', () => {
    expect(migration).toContain('render_invoice_profile_snapshot')
    expect(migration).toContain("'{building_code}'")
    expect(migration).toContain("'{room_number}'")
    expect(migration).toContain("'{invoice_code}'")
    expect(migration).toContain("'{period}'")
    expect(migration).toContain('before insert on public.invoices')
  })

  it('backfills active null snapshots once and excludes void invoices', () => {
    expect(migration).toContain('legacy_backfilled_at')
    expect(migration).toContain('invoice_profile_snapshot is null')
    expect(migration).toContain("invoice.status <> 'void'")
    expect(migration).toContain('upsert_building_invoice_profile')
  })

  it('keeps internal functions service-role only', () => {
    expect(migration).toContain('revoke all on function public.upsert_building_invoice_profile')
    expect(migration).toContain('to service_role')
  })
})
