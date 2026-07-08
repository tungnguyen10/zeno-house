import { useDebounceFn } from '@vueuse/core'
import type { Building } from '~/types/buildings'
import type { ApiSuccess } from '~/types/api'
import { buildingCreateSchema, buildingUpdateSchema } from '~/utils/validators/buildings'
import type { BuildingCreateInput, BuildingUpdateInput } from '~/utils/validators/buildings'
import { buildingPath } from '~/utils/routes/operational'

interface QuickRoom {
  room_number: string
  monthly_rent: number
  area: number | null
}

type CreateInput = BuildingCreateInput & { quickRooms?: QuickRoom[] }

type DraftKey =
  | { mode: 'create' }
  | { mode: 'edit'; id: string }
  | null

interface UseBuildingFormOptions<T> {
  /** When provided, enables draft autosave under `building-form:<mode>[:id]`. */
  draftKey?: DraftKey
  /** Reactive form data ref to track dirty state and persist as draft. */
  formData?: Ref<T>
  /** Snapshot used to compute `isDirty`. Must be reactive (computed) for edit mode. */
  initialSnapshot?: MaybeRef<T | null>
}

function buildStorageKey(key: NonNullable<DraftKey>): string {
  return key.mode === 'create'
    ? 'building-form:create'
    : `building-form:edit:${key.id}`
}

function safeReadDraft<T>(storageKey: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return null
    return JSON.parse(raw) as T
  }
  catch {
    return null
  }
}

function safeWriteDraft<T>(storageKey: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value))
  }
  catch {
    // quota or disabled; ignore
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

export function useBuildingForm<T = unknown>(options: UseBuildingFormOptions<T> = {}) {
  const isLoading = ref(false)
  const errors = ref<Record<string, string[]>>({})
  const apiError = ref<string | null>(null)

  const storageKey = options.draftKey ? buildStorageKey(options.draftKey) : null
  const hasDraft = ref(false)

  function refreshHasDraft() {
    if (!storageKey || typeof window === 'undefined') {
      hasDraft.value = false
      return
    }
    hasDraft.value = window.localStorage.getItem(storageKey) !== null
  }

  refreshHasDraft()

  onMounted(() => {
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

  if (storageKey && options.formData) {
    const persist = useDebounceFn(() => {
      if (!options.formData) return
      if (!isDirty.value) return
      safeWriteDraft(storageKey, options.formData.value)
      hasDraft.value = true
    }, 500)

    watch(() => options.formData!.value, () => {
      persist()
    }, { deep: true })
  }

  function restoreDraft(): T | null {
    if (!storageKey) return null
    const draft = safeReadDraft<T>(storageKey)
    if (draft === null) return null
    if (options.formData) options.formData.value = draft
    return draft
  }

  function clearDraft() {
    if (!storageKey) return
    safeClearDraft(storageKey)
    hasDraft.value = false
  }

  function clearErrors() {
    errors.value = {}
    apiError.value = null
  }

  async function submitCreate(input: CreateInput) {
    clearErrors()

    const { quickRooms, ...buildingInput } = input
    const result = buildingCreateSchema.safeParse(buildingInput)
    if (!result.success) {
      errors.value = result.error.flatten().fieldErrors as Record<string, string[]>
      return
    }

    isLoading.value = true
    try {
      const res = await $fetch<ApiSuccess<Building>>('/api/buildings', {
        method: 'POST',
        body: result.data,
      })

      if (quickRooms?.length && res.data?.id) {
        const buildingId = res.data.id
        await Promise.all(quickRooms.map(room =>
          $fetch('/api/rooms', {
            method: 'POST',
            body: {
              building_id: buildingId,
              room_number: room.room_number,
              monthly_rent: room.monthly_rent,
              area: room.area,
              floor: 1,
              status: 'available',
            },
          }),
        ))
      }

      clearDraft()
      clearNuxtData()
      await navigateTo('/buildings')
    }
    catch (e: unknown) {
      const err = e as { data?: { error?: { message?: string } } }
      apiError.value = err?.data?.error?.message ?? 'Đã xảy ra lỗi. Vui lòng thử lại.'
    }
    finally {
      isLoading.value = false
    }
  }

  async function submitUpdate(id: string, input: BuildingUpdateInput) {
    clearErrors()

    const result = buildingUpdateSchema.safeParse(input)
    if (!result.success) {
      errors.value = result.error.flatten().fieldErrors as Record<string, string[]>
      return
    }

    isLoading.value = true
    try {
      const res = await $fetch<ApiSuccess<Building>>(`/api/buildings/${id}`, {
        method: 'PATCH',
        body: result.data,
      })
      clearDraft()
      clearNuxtData()
      await navigateTo(buildingPath(res.data))
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
    restoreDraft,
    clearDraft,
    refreshHasDraft,
  }
}
