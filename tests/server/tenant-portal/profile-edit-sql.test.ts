import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const path = resolve('supabase/migrations/20261110000326_restrict_tenant_portal_profile.sql')
const sql = existsSync(path) ? readFileSync(path, 'utf8').toLowerCase() : ''

describe('restricted portal database boundary', () => {
  it('revokes raw table and column reads while retaining service-role reads', () => {
    for (const table of ['tenants', 'support_requests']) {
      expect(sql).toContain(`revoke select on public.${table} from public, anon, authenticated`)
      expect(sql).toContain(`grant select on public.${table} to service_role`)
    }
    expect(sql).toContain('attname')
    expect(sql).toContain('revoke select (%s)')
  })

  it('removes tenant canonical-image mutations without dropping own read or admin policies', () => {
    expect(sql).toContain('drop policy if exists tenant_id_images_self_insert')
    expect(sql).toContain('drop policy if exists tenant_id_images_self_delete')
    expect(sql).not.toContain('drop policy if exists tenant_id_images_self_select')
    expect(sql).not.toContain('drop policy if exists tenant_id_images_admin_all')
    expect(sql).not.toContain('delete from storage.objects')
  })

  it('preserves bounded primary/roommate request creation with new status and owned attachment prefix', () => {
    expect(sql).toContain('support_requests_tenant_insert_own')
    expect(sql).toContain("status = 'new'")
    expect(sql).toContain('occupant.move_out_date is null')
    expect(sql).toContain('contract.start_date <=')
    expect(sql).toContain("split_part(attachment_path, '/', 2) = 'requests'")
  })
})

describe('atomic request status handling', () => {
  it('locks the request and writes status plus safe audit in the same transaction', () => {
    expect(sql).toContain('update_tenant_support_request_status_with_audit')
    expect(sql).toContain('security invoker')
    expect(sql).toContain("set search_path = ''")
    expect(sql).toContain('for update')
    expect(sql).toContain('support_request.status_updated')
    expect(sql).toContain("'tenant_id', v_before.tenant_id")
    const auditInsert = sql.slice(sql.indexOf('insert into public.audit_events'))
    expect(auditInsert).not.toContain('to_jsonb(v_before)')
    expect(sql).not.toContain('update public.tenants')
  })

  it('has idempotent target handling, stale guards, transitions and service-only execution', () => {
    expect(sql).toContain('support_request_status_stale')
    expect(sql).toContain('support_request_status_transition_invalid')
    expect(sql).toContain('if v_before.status = p_status then')
    expect(sql).toContain('from public, anon, authenticated')
    expect(sql).toContain('to service_role')
  })
})
