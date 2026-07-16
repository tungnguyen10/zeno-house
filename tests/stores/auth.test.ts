import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from '../../app/stores/auth'

describe('auth store role helpers', () => {
  const currentUser = ref<{ app_metadata?: { role?: string | null } } | null>(null)

  beforeEach(() => {
    setActivePinia(createPinia())
    currentUser.value = null
    vi.stubGlobal('useSupabaseUser', () => currentUser)
  })

  it('exposes owner state and scoped management visibility', () => {
    currentUser.value = { app_metadata: { role: 'owner' } }
    const auth = useAuthStore()

    expect(auth.isOwner).toBe(true)
    expect(auth.isAdmin).toBe(false)
    expect(auth.isManager).toBe(false)
    expect(auth.isTenant).toBe(false)
    expect(auth.canManageUsers).toBe(true)
    expect(auth.canManage).toBe(true)
    expect(auth.canCreateOwner).toBe(false)
  })

  it('keeps manager out of user and building management controls', () => {
    currentUser.value = { app_metadata: { role: 'manager' } }
    const auth = useAuthStore()

    expect(auth.isManager).toBe(true)
    expect(auth.canManageUsers).toBe(false)
    expect(auth.canManage).toBe(false)
    expect(auth.canCreateOwner).toBe(false)
  })

  it('allows admin to create owners from Settings', () => {
    currentUser.value = { app_metadata: { role: 'admin' } }
    const auth = useAuthStore()

    expect(auth.isAdmin).toBe(true)
    expect(auth.canManageUsers).toBe(true)
    expect(auth.canManage).toBe(true)
    expect(auth.canCreateOwner).toBe(true)
  })

  it('exposes isolated tenant role and capability helpers', () => {
    currentUser.value = { app_metadata: { role: 'tenant' } }
    const auth = useAuthStore()

    expect(auth.isTenant).toBe(true)
    expect(auth.isAdmin).toBe(false)
    expect(auth.isOwner).toBe(false)
    expect(auth.isManager).toBe(false)
    expect(auth.can('tenant.profile.read')).toBe(true)
    expect(auth.can('tenant.requests.write')).toBe(true)
    expect(auth.can('tenants.read')).toBe(false)
    expect(auth.canManageUsers).toBe(false)
    expect(auth.canManage).toBe(false)
    expect(auth.canCreateOwner).toBe(false)
  })
})
