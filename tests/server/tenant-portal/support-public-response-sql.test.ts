import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync('supabase/migrations/20261127091000_tenant_support_public_response.sql', 'utf8')
const verification = readFileSync('supabase/verification/tenant_support_public_response.sql', 'utf8')

// Static release-contract checks; the rollback verification still must execute
// against the migrated cloud schema before this is production evidence.
describe('public support reply SQL release contract', () => {
  it('requires a version token and row lock for changed replies and statuses', () => {
    expect(migration).toContain('p_expected_updated_at timestamptz')
    expect(migration).toMatch(/select \* into v_before[\s\S]*?for update;/)
    expect(migration).toContain('v_before.updated_at is distinct from p_expected_updated_at')
    expect(migration).toContain("raise exception 'SUPPORT_REQUEST_STATUS_STALE'")
    expect(migration).toContain("old.updated_at + interval '1 microsecond'")
    expect(migration).toContain('v_before.status = p_status and not v_response_changed')
  })

  it('adds a service-only overload without breaking existing servers or restoring browser writes', () => {
    expect(migration).not.toContain('drop function public.update_tenant_support_request_status_with_audit(uuid,text,text,uuid);')
    expect(migration).toMatch(/revoke all on function public\.update_tenant_support_request_status_with_audit\([^;]+\)\s+from public, anon, authenticated;/)
    expect(migration).toMatch(/grant execute on function public\.update_tenant_support_request_status_with_audit\([^;]+\)\s+to service_role;/)
    expect(migration).not.toMatch(/grant\s+(?:insert|update|delete|all)[^;]+to\s+(?:public|anon|authenticated)/i)
    expect(migration).toContain('with check (public_response is null and responded_at is null)')
  })

  it('audits state and response presence without copying private content', () => {
    const audit = migration.match(/insert into public\.audit_events[\s\S]+?\n {2}\);/)?.[0]
    expect(audit).toBeDefined()
    expect(audit).toContain("'response_changed', v_response_changed")
    expect(audit).toContain("'has_response', v_after.public_response is not null")
    expect(audit).not.toMatch(/to_jsonb|description|attachment_path|signed_url|'public_response'/)
    expect(migration).toContain('support_requests_response_timestamp_check')
    expect(migration).toContain('between 1 and 4000')
  })

  it('provides rollback-only cloud checks for retry, stale reply and audit atomicity', () => {
    expect(verification).toMatch(/begin;/)
    expect(verification).toMatch(/rollback;/)
    expect(verification).not.toMatch(/^commit;/m)
    for (const gate of [
      'VERIFY_BROWSER_REQUEST_WRITES_NOT_REVOKED', 'VERIFY_REPLY_RPC_ACL_INVALID',
      'VERIFY_ROLLOUT_STATUS_RPC_ACL_INVALID', 'VERIFY_ROLLOUT_STATUS_RPC_CHANGED_REPLY',
      'VERIFY_RETRY_DUPLICATED_AUDIT', 'VERIFY_STALE_REPLY_OVERWROTE',
      'VERIFY_REPLY_ONLY_VERSION_UNCHANGED', 'VERIFY_PRIVATE_TEXT_IN_AUDIT',
      'VERIFY_PROFILE_CHANGED', 'VERIFY_REPLY_AUDIT_NOT_ATOMIC',
    ]) expect(verification).toContain(gate)
    expect(verification).not.toMatch(/(?:insert into|update|delete from)\s+auth\.users/i)
  })
})
