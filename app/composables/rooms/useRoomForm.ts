import { useDebounceFn } from '@vueuse/core'
import type { Room } from '~/types/rooms'
import type { ApiSuccess } from '~/types/api'
import { roomCreateSchema, roomUpdateSchema } from '~/utils/validators/rooms'
import type { RoomCreateInput, RoomUpdateInput } from '~/utils/validators/rooms'
import { roomPath } from '~/utils/routes/operational'

type DraftKey =
  | { mode: 'create'; buildingId?: MaybeRef<string | null | undefined> }
  | { mode: 'edit'; id: string }
  | null

interface UseRoomFormOptions<T> {
  draftKey?: DraftKey
  formData?: Ref<T>
  initialSnapshot?: MaybeRef<T | null>
}

interface DraftEnvelope<T> {
  savedAt: string
  data: T
}

function buildStorageKey(key: NonNullable<DraftKey>): string {
  if (key.mode === 'edit') return `room-form:edit:${key.id}`
  const buildingId = key.buildingId !== undefined ? toValue(key.buildingId) : null
  return `room-form:create:${buildingId || 'none'}`
}

function safeReadDraft<T>(storageKey: string): DraftEnvelope<T> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return null
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

function safeWriteDraft<T>(storageKey: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey, JSON.stringify({
      savedAt: new Date().toISOString(),
      data: value,
    }))
  }
  catch {
    // quota or disabled storage; ignore
  }
}

function safeClearDraft(storageKey: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(storageKey)
  }
  catch {
    // ignore
  }
}

export function useRoomForm<T = unknown>(options: UseRoomFormOptions<T> = {}) {
  const isLoading = ref(false)
  const errors = ref<Record<string, string[]>>({})
  const apiError = ref<string | null>(null)
  const isDraftHydrated = ref(typeof window !== 'undefined')
  const draftVersion = ref(0)
  const storageKey = computed(() => options.draftKey ? buildStorageKey(options.draftKey) : null)

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

  const draftEnvelope = computed(() => {
    if (!isDraftHydrated.value) return null
    void draftVersion.value
    return storageKey.value ? safeReadDraft<T>(storageKey.value) : null
  })
  const hasDraft = computed(() => draftEnvelope.value !== null)
  const draftSavedAt = computed(() => draftEnvelope.value?.savedAt ?? '')

  function refreshHasDraft() {
    draftVersion.value++
  }

  if (isDraftHydrated.value) {
    refreshHasDraft()
  }

  onMounted(() => {
    isDraftHydrated.value = true
    refreshHasDraft()
  })

  if (options.formData) {
    const persist = useDebounceFn(() => {
      if (!options.formData || !storageKey.value) return
      if (!isDirty.value) return
      safeWriteDraft(storageKey.value, options.formData.value)
      refreshHasDraft()
    }, 500)

    watch(() => options.formData!.value, () => {
      persist()
    }, { deep: true })
  }

  function restoreDraft(): T | null {
    if (!storageKey.value) return null
    const draft = safeReadDraft<T>(storageKey.value)
    if (draft === null) return null
    if (options.formData) options.formData.value = draft.data
    return draft.data
  }

  function clearDraft() {
    if (!storageKey.value) return
    safeClearDraft(storageKey.value)
    refreshHasDraft()
  }

  function clearErrors() {
    errors.value = {}
    apiError.value = null
  }

  async function submitCreate(input: RoomCreateInput) {
    clearErrors()

    const result = roomCreateSchema.safeParse(input)
    if (!result.success) {
      errors.value = result.error.flatten().fieldErrors as Record<string, string[]>
      return
    }

    isLoading.value = true
    try {
      await $fetch<ApiSuccess<Room>>('/api/rooms', {
        method: 'POST',
        body: result.data,
      })
      clearDraft()
      clearNuxtData()
      await navigateTo('/rooms')
    }
    catch (e: unknown) {
      const err = e as { data?: { error?: { message?: string } } }
      apiError.value = err?.data?.error?.message ?? 'Đã xảy ra lỗi. Vui lòng thử lại.'
    }
    finally {
      isLoading.value = false
    }
  }

  async function submitUpdate(id: string, input: RoomUpdateInput) {
    clearErrors()

    const result = roomUpdateSchema.safeParse(input)
    if (!result.success) {
      errors.value = result.error.flatten().fieldErrors as Record<string, string[]>
      return
    }

    isLoading.value = true
    try {
      const res = await $fetch<ApiSuccess<Room>>(`/api/rooms/${id}`, {
        method: 'PATCH',
        body: result.data,
      })
      clearDraft()
      clearNuxtData()
      await navigateTo(roomPath(res.data))
    }
    catch (e: unknown) {
      const err = e as { data?: { error?: { message?: string } } }
      apiError.value = err?.data?.error?.message ?? 'Đã xảy ra lỗi. Vui lòng thử lại.'
    }
    finally {
      isLoading.value = false
    }
  }

  return {
    isLoading,
    errors,
    apiError,
    submitCreate,
    submitUpdate,
    isDirty,
    hasDraft,
    draftSavedAt,
    restoreDraft,
    clearDraft,
    refreshHasDraft,
  }
}
