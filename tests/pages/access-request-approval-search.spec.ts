import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(resolve('app/pages/dashboard/settings/access-requests.vue'), 'utf8')

describe('access-request tenant approval search', () => {
  it('uses a debounced server-backed combobox instead of a fixed tenant page', () => {
    expect(page).toContain('<UiCombobox')
    expect(page).toContain('remote-search')
    expect(page).toContain('@search="queueTenantSearch"')
    expect(page).toContain("apiFetch<ApiSuccess<Tenant[]>>('/api/tenants'")
    expect(page).toContain('q: query.trim() || undefined')
    expect(page).toContain('limit: 20')
    expect(page).not.toContain("useFetch<ApiSuccess<Tenant[]>>('/api/tenants'")
  })

  it('keeps already linked tenants unavailable while preserving a resumed decision', () => {
    expect(page).toContain('linkedTenantIds')
    expect(page).toContain('!linkedTenantIds.value.has(tenant.id)')
    expect(page).toContain('tenant.id === selectedRequest.value?.decisionTenantId')
  })
})
