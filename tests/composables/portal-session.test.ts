import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { isPortalDataKey, portalSessionDataKey, portalSessionIdentity } from '../../app/utils/tenant-portal/session'

const user = ref<{ sub?: string; id?: string } | null>({ sub: 'tenant-a' })
vi.stubGlobal('useSupabaseUser', () => user)
vi.stubGlobal('computed', computed)
vi.stubGlobal('clearNuxtData', vi.fn())

describe('portal account isolation', () => {
  beforeEach(() => { user.value = { sub: 'tenant-a' } })

  it('changes the cache namespace immediately when the signed-in account changes', async () => {
    const { usePortalSessionKey } = await import('../../app/composables/tenant-portal/usePortalSessionKey')
    const key = usePortalSessionKey('bootstrap')
    const data = new Map([[key.value, { privateName: 'Tenant A' }]])
    expect(data.get(key.value)).toEqual({ privateName: 'Tenant A' })
    user.value = { sub: 'tenant-b' }
    expect(key.value).toBe('portal-tenant-b-bootstrap')
    expect(data.get(key.value)).toBeUndefined()
    user.value = null
    expect(key.value).toBe('portal-anonymous-bootstrap')
    expect(data.get(key.value)).toBeUndefined()
  })

  it('supports both Auth User and JWT claims without using email as an identifier', () => {
    expect(portalSessionIdentity({ sub: 'claims-user', id: 'legacy-user' })).toBe('claims-user')
    expect(portalSessionIdentity({ id: 'legacy-user' })).toBe('legacy-user')
    expect(portalSessionIdentity(null)).toBeNull()
    expect(portalSessionDataKey('tenant', 'invoice-123')).toBe('portal-tenant-invoice-123')
  })

  it('clears all portal data namespaces without deleting unrelated async data', () => {
    expect(['portal-bootstrap', 'portal-tenant-a-documents', 'portal-tenant-b-requests'].every(isPortalDataKey)).toBe(true)
    expect(isPortalDataKey('dashboard-summary')).toBe(false)
  })
})
