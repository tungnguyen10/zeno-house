import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'

const user = ref<Record<string, unknown> | null>(null)
const clearNuxtData = vi.fn()
const runWithContext = vi.fn((callback: () => void) => callback())

vi.stubGlobal('defineNuxtPlugin', (plugin: unknown) => plugin)
vi.stubGlobal('useSupabaseUser', () => user)
vi.stubGlobal('clearNuxtData', clearNuxtData)

const { default: plugin } = await import('../../app/plugins/portal-session.client')

describe('portal session cache invalidation', () => {
  let scope: ReturnType<typeof effectScope>

  beforeEach(() => {
    user.value = { sub: 'tenant-a' }
    clearNuxtData.mockClear()
    runWithContext.mockClear()
    scope = effectScope()
    scope.run(() => (plugin as (app: unknown) => void)({ runWithContext }))
  })

  afterEach(() => scope.stop())

  it('clears private data synchronously when the actor switches', () => {
    user.value = { sub: 'tenant-b' }

    expect(runWithContext).toHaveBeenCalledOnce()
    const predicate = clearNuxtData.mock.calls[0]![0] as (key: string) => boolean
    expect(predicate('portal-tenant-a-bootstrap')).toBe(true)
    expect(predicate('portal-tenant-b-documents')).toBe(true)
    expect(predicate('dashboard-public-data')).toBe(false)
  })

  it('clears private data on an external sign-out or expired session', () => {
    user.value = null
    expect(clearNuxtData).toHaveBeenCalledOnce()
  })

  it('preserves current data when only claims refresh for the same actor', () => {
    user.value = { sub: 'tenant-a', exp: 123456, app_metadata: { role: 'tenant' } }
    expect(clearNuxtData).not.toHaveBeenCalled()
  })
})
