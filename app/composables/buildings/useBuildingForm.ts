import type { Building } from '~/types/buildings'
import type { ApiSuccess } from '~/types/api'
import { buildingCreateSchema, buildingUpdateSchema } from '~/utils/validators/buildings'
import type { BuildingCreateInput, BuildingUpdateInput } from '~/utils/validators/buildings'
import { buildingPath } from '~/utils/routes/operational'
import { getApiErrorMessage } from '~/utils/api-error'
import { useLocalFormDraft } from '~/composables/useLocalFormDraft'

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

export function useBuildingForm<T = unknown>(options: UseBuildingFormOptions<T> = {}) {
  const isLoading = ref(false)
  const errors = ref<Record<string, string[]>>({})
  const apiError = ref<string | null>(null)

  const storageKey = options.draftKey ? buildStorageKey(options.draftKey) : null

  const { hasDraft, isDirty, restoreDraft, clearDraft, refreshHasDraft } = useLocalFormDraft<T>({
    key: storageKey,
    formData: options.formData,
    initialSnapshot: options.initialSnapshot,
  })

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
      apiError.value = getApiErrorMessage(e)
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
      apiError.value = getApiErrorMessage(e)
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
