import { flushPromises, shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const navigateTo = vi.fn()
const currentUser = ref<Record<string, unknown> | null>(null)

vi.stubGlobal('definePageMeta', vi.fn())
vi.stubGlobal('navigateTo', navigateTo)
vi.stubGlobal('useSupabaseUser', () => currentUser)

const AuthCallback = (await import('../../app/pages/auth/callback.vue')).default

describe('auth callback', () => {
  beforeEach(() => {
    currentUser.value = null
    navigateTo.mockClear()
  })

  it.each([
    ['admin', '/dashboard'],
    ['owner', '/dashboard'],
    ['manager', '/dashboard'],
    ['tenant', '/portal'],
  ])('routes a %s callback to %s', async (role, expected) => {
    currentUser.value = { app_metadata: { role } }

    const wrapper = shallowMount(AuthCallback)
    await flushPromises()

    expect(navigateTo).toHaveBeenCalledWith(expected)
    wrapper.unmount()
  })

  it('routes a callback without role to pending', async () => {
    currentUser.value = { app_metadata: {} }
    const wrapper = shallowMount(AuthCallback)
    await flushPromises()
    expect(navigateTo).toHaveBeenCalledWith('/auth/pending')
    wrapper.unmount()
  })
})
