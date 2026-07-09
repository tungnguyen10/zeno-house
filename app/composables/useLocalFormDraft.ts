import { useDebounceFn } from '@vueuse/core'
import type { MaybeRef, Ref } from 'vue'

interface DraftEnvelope<T> {
  savedAt: string
  data: T
}

interface UseLocalFormDraftOptions<T> {
  /** Storage key. When `null`/`undefined`, draft persistence is disabled. Reactive keys are supported. */
  key: MaybeRef<string | null | undefined>
  /** Reactive form data to auto-persist (debounced) while dirty. */
  formData?: Ref<T>
  /** Snapshot used to compute `isDirty`. Must be reactive (computed) for edit mode. */
  initialSnapshot?: MaybeRef<T | null>
  /** When true, persist as `{ savedAt, data }`; otherwise store the plain value. Reads tolerate both. */
  envelope?: boolean
  /** Debounce for autosave writes. Defaults to 500ms. */
  debounceMs?: number
}

function safeGetItem(storageKey: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(storageKey)
  }
  catch {
    return null
  }
}

function safeSetItem(storageKey: string, value: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey, value)
  }
  catch {
    // quota or disabled storage; ignore
  }
}

function safeRemoveItem(storageKey: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(storageKey)
  }
  catch {
    // ignore
  }
}

/**
 * Read a stored draft, tolerating both the `{ savedAt, data }` envelope and a legacy plain value.
 * Legacy plain values are returned with an empty `savedAt`.
 */
function readDraftEnvelope<T>(storageKey: string): DraftEnvelope<T> | null {
  const raw = safeGetItem(storageKey)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as DraftEnvelope<T> | T
    if (parsed && typeof parsed === 'object' && 'data' in parsed && 'savedAt' in parsed) {
      return parsed as DraftEnvelope<T>
    }
    return { savedAt: '', data: parsed as T }
  }
  catch {
    return null
  }
}

/**
 * Shared localStorage-backed form draft persistence: SSR-safe read/write/clear, dirty tracking,
 * debounced autosave, and hydration-safe `hasDraft`/`draftSavedAt`.
 *
 * Reads accept both the `{ savedAt, data }` envelope and legacy plain values, so existing drafts
 * remain restorable regardless of the `envelope` option used to write.
 */
export function useLocalFormDraft<T = unknown>(options: UseLocalFormDraftOptions<T>) {
  const debounceMs = options.debounceMs ?? 500
  const useEnvelope = options.envelope ?? false

  const storageKey = computed<string | null>(() => toValue(options.key) || null)

  // Avoid hydration mismatch: draft visibility is derived only after we know we are on the client.
  const isHydrated = ref(typeof window !== 'undefined')
  const draftVersion = ref(0)

  const draftEnvelope = computed(() => {
    if (!isHydrated.value) return null
    void draftVersion.value
    return storageKey.value ? readDraftEnvelope<T>(storageKey.value) : null
  })
  const hasDraft = computed(() => draftEnvelope.value !== null)
  const draftSavedAt = computed(() => draftEnvelope.value?.savedAt ?? '')

  function refreshHasDraft() {
    draftVersion.value++
  }

  if (isHydrated.value) refreshHasDraft()

  onMounted(() => {
    isHydrated.value = true
    refreshHasDraft()
  })

  const snapshotSerialized = computed(() =>
    options.initialSnapshot ? JSON.stringify(toValue(options.initialSnapshot) ?? null) : null,
  )
  const currentSerialized = computed(() =>
    options.formData ? JSON.stringify(options.formData.value ?? null) : null,
  )
  const isDirty = computed(() => {
    if (!options.formData) return false
    if (snapshotSerialized.value === null) return false
    return snapshotSerialized.value !== currentSerialized.value
  })

  function write(value: T) {
    if (!storageKey.value) return
    const payload = useEnvelope
      ? JSON.stringify({ savedAt: new Date().toISOString(), data: value })
      : JSON.stringify(value)
    safeSetItem(storageKey.value, payload)
    refreshHasDraft()
  }

  if (options.formData) {
    const persist = useDebounceFn(() => {
      if (!options.formData || !storageKey.value) return
      if (!isDirty.value) return
      write(options.formData.value)
    }, debounceMs)

    watch(() => options.formData!.value, () => {
      persist()
    }, { deep: true })
  }

  function restoreDraft(): T | null {
    if (!storageKey.value) return null
    const envelope = readDraftEnvelope<T>(storageKey.value)
    if (envelope === null) return null
    if (options.formData) options.formData.value = envelope.data
    return envelope.data
  }

  function clearDraft() {
    if (!storageKey.value) return
    safeRemoveItem(storageKey.value)
    refreshHasDraft()
  }

  return {
    hasDraft,
    draftSavedAt,
    isDirty,
    restoreDraft,
    clearDraft,
    refreshHasDraft,
  }
}
