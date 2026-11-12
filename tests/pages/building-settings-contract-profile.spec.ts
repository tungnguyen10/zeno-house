import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineComponent, h, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, onBeforeRouteLeave, onBeforeRouteUpdate, RouterView } from 'vue-router'
import { usePortalUnsavedChanges } from '~/composables/tenant-portal/usePortalUnsavedChanges'
import { compileScript, parse } from '@vue/compiler-sfc'
import { describe, expect, it } from 'vitest'
const page = readFileSync(resolve(process.cwd(), 'app/pages/dashboard/buildings/[id]/settings.vue'), 'utf8')
describe('building settings contract profile integration', () => {
  it('compiles the settings page setup after wiring the new section', () => {
    const { descriptor } = parse(page)
    expect(() => compileScript(descriptor, { id: 'settings-contract-test' })).not.toThrow()
  })
  it('gates section and navigation by read capability', () => {
    expect(page).toContain("authStore.can('building-contract-profile.read')")
    expect(page).toContain("id: 'contract-profile'")
    expect(page).toContain('v-if="canReadContractProfile && building" id="contract-profile"')
    expect(page).toContain("authStore.can('building-contract-profile.write')")
  })
  it('refreshes readiness after saving and avoids claiming missing zero while unknown', () => {
    expect(page).toContain('onSaved: () => refreshSettings()'); expect(page).toContain('readiness.value.contract.ready'); expect(page).toContain("'Đang kiểm tra'")
  })
  it('protects dirty edits across route leave and browser close without storing PII', () => {
    expect(page).toContain('onBeforeRouteLeave(contractUnsaved.guardRouteLeave)'); expect(page).toContain("'beforeunload', contractUnsaved.onBeforeUnload")
    expect(page).toContain('@dirty="contractProfileDirty = $event"'); expect(page).toContain('contractUnsaved.discardChanges'); expect(page).not.toContain('localStorage')
  })
})

describe('settings unsaved contract confirmation', () => {
  it('keeps edits when cancelled, permits discard, and warns on close only while dirty', async () => {
    const dirty = ref(false)
    const guard = usePortalUnsavedChanges(dirty)
    expect(guard.guardRouteLeave()).toBe(true)
    dirty.value = true
    const cancelled = guard.guardRouteLeave()
    expect(guard.discardOpen.value).toBe(true)
    guard.keepEditing()
    await expect(cancelled).resolves.toBe(false)
    const discarded = guard.guardRouteLeave()
    guard.discardChanges()
    await expect(discarded).resolves.toBe(true)
    const beforeClose = new Event('beforeunload', { cancelable: true })
    guard.onBeforeUnload(beforeClose as BeforeUnloadEvent)
    expect(beforeClose.defaultPrevented).toBe(true)
    dirty.value = false
    const afterSave = new Event('beforeunload', { cancelable: true })
    guard.onBeforeUnload(afterSave as BeforeUnloadEvent)
    expect(afterSave.defaultPrevented).toBe(false)
  })
})


describe('contract settings reused route guard', () => {
  it('guards dirty A to B parameter changes while allowing same-building hash navigation', async () => {
    const dirty = ref(true)
    const guard = usePortalUnsavedChanges(dirty)
    // Exercise the actual page guard registrations inside a minimal routed settings view.
    const registrations = page.slice(page.indexOf('onBeforeRouteLeave('), page.indexOf('onMounted(', page.indexOf('onBeforeRouteLeave(')))
    const SettingsHarness = defineComponent({
      setup() {
        const register = new Function('onBeforeRouteLeave', 'onBeforeRouteUpdate', 'contractUnsaved', registrations)
        register(onBeforeRouteLeave, onBeforeRouteUpdate, guard)
        return () => h('div', 'Settings')
      },
    })
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/dashboard/buildings/:id/settings', component: SettingsHarness }] })
    await router.push('/dashboard/buildings/A/settings')
    await router.isReady()
    const wrapper = mount(defineComponent({ setup: () => () => h(RouterView) }), { global: { plugins: [router] } })
    try {
      await router.push('/dashboard/buildings/A/settings#contract-profile')
      expect(guard.discardOpen.value).toBe(false)
      const cancelled = router.push('/dashboard/buildings/B/settings')
      await flushPromises()
      expect(guard.discardOpen.value).toBe(true)
      expect(router.currentRoute.value.params.id).toBe('A')
      guard.keepEditing()
      await cancelled
      expect(router.currentRoute.value.params.id).toBe('A')
      const discarded = router.push('/dashboard/buildings/B/settings')
      await flushPromises()
      expect(guard.discardOpen.value).toBe(true)
      guard.discardChanges()
      await discarded
      expect(router.currentRoute.value.params.id).toBe('B')
    }
    finally {
      wrapper.unmount()
    }
  })
})
