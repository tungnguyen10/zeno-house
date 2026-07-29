import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { usePortalUnsavedChanges } from '~/composables/tenant-portal/usePortalUnsavedChanges'

describe('usePortalUnsavedChanges', () => {
  it('allows clean navigation immediately', () => {
    const guard = usePortalUnsavedChanges(ref(false))
    expect(guard.guardRouteLeave()).toBe(true)
    expect(guard.discardOpen.value).toBe(false)
  })

  it('blocks dirty navigation until the tenant confirms discard', async () => {
    const guard = usePortalUnsavedChanges(ref(true))
    const decision = guard.guardRouteLeave()
    expect(guard.discardOpen.value).toBe(true)

    guard.discardChanges()

    await expect(decision).resolves.toBe(true)
  })

  it('keeps the tenant on the form when the sheet closes', async () => {
    const guard = usePortalUnsavedChanges(ref(true))
    const decision = guard.guardRouteLeave()

    guard.onDiscardSheetUpdate(false)

    await expect(decision).resolves.toBe(false)
  })

  it('marks hard refresh as unsafe only while dirty', () => {
    const dirty = ref(true)
    const guard = usePortalUnsavedChanges(dirty)
    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent

    guard.onBeforeUnload(event)
    expect(event.defaultPrevented).toBe(true)

    dirty.value = false
    const cleanEvent = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent
    guard.onBeforeUnload(cleanEvent)
    expect(cleanEvent.defaultPrevented).toBe(false)
  })
})
