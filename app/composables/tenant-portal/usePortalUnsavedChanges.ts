import { getCurrentInstance, type Ref } from 'vue'

export function usePortalUnsavedChanges(dirty: Readonly<Ref<boolean>>) {
  const portalFormDirty = useState<boolean>('portal-form-dirty', () => false)
  if (getCurrentInstance()) {
    watch(dirty, value => { portalFormDirty.value = value }, { immediate: true, flush: 'sync' })
    onBeforeUnmount(() => { portalFormDirty.value = false; resolvePending(false) })
  }
  const discardOpen = ref(false)
  let resolveLeave: ((allow: boolean) => void) | null = null
  let pendingLeave: Promise<boolean> | null = null
  let bypassOnce = false

  function resolvePending(allow: boolean) {
    const resolve = resolveLeave
    resolveLeave = null
    pendingLeave = null
    discardOpen.value = false
    resolve?.(allow)
  }

  function guardRouteLeave(): true | Promise<boolean> {
    if (bypassOnce) {
      bypassOnce = false
      return true
    }
    if (!dirty.value) return true
    if (pendingLeave) return pendingLeave

    discardOpen.value = true
    pendingLeave = new Promise<boolean>((resolve) => {
      resolveLeave = resolve
    })
    return pendingLeave
  }

  function keepEditing() {
    resolvePending(false)
  }

  function discardChanges() {
    resolvePending(true)
  }

  function allowNextLeave() {
    bypassOnce = true
    portalFormDirty.value = false
  }

  function onDiscardSheetUpdate(open: boolean) {
    if (open) {
      discardOpen.value = true
      return
    }
    keepEditing()
  }

  function onBeforeUnload(event: BeforeUnloadEvent) {
    if (!dirty.value || bypassOnce) return
    event.preventDefault()
    event.returnValue = ''
  }

  return {
    discardOpen,
    guardRouteLeave,
    keepEditing,
    discardChanges,
    allowNextLeave,
    onDiscardSheetUpdate,
    onBeforeUnload,
  }
}
