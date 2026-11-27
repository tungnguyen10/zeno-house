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

describe('access requests polish', () => {
  it('titles the page like the nav item and filters with tabs', () => {
    expect(page).toContain('title="Yêu cầu truy cập"')
    expect(page).not.toContain('Yêu cầu tài khoản')
    expect(page).toContain('<UiTabs')
    expect(page).not.toContain('label="Trạng thái" :options="statusOptions"')
  })

  it('lists requests as rows with an initials avatar rather than a table', () => {
    expect(page).not.toContain('<UiTable')
    expect(page).toContain('role="list"')
    expect(page).toContain('userInitials(row.fullName, row.email)')
    expect(page).toContain('title="Không có yêu cầu"')
  })

  it('uses product role names and huỷ spelling', () => {
    expect(page).toContain("{ value: 'owner', label: 'Chủ nhà' }")
    expect(page).toContain("{ value: 'manager', label: 'Quản lý' }")
    expect(page).toContain("{ value: 'tenant', label: 'Người thuê' }")
    expect(page).not.toContain('Hủy')
  })
})
