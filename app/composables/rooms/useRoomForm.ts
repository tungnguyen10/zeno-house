import type { Room } from '~/types/rooms'
import type { ApiSuccess } from '~/types/api'
import { roomCreateSchema, roomUpdateSchema } from '~/utils/validators/rooms'
import type { RoomCreateInput, RoomUpdateInput } from '~/utils/validators/rooms'
import { roomPath } from '~/utils/routes/operational'
import { useLocalFormDraft } from '~/composables/useLocalFormDraft'
import { useFormState } from '~/composables/useFormState'

type DraftKey =
  | { mode: 'create'; buildingId?: MaybeRef<string | null | undefined> }
  | { mode: 'edit'; id: string }
  | null

interface UseRoomFormOptions<T> {
  draftKey?: DraftKey
  formData?: Ref<T>
  initialSnapshot?: MaybeRef<T | null>
}

function buildStorageKey(key: NonNullable<DraftKey>): string {
  if (key.mode === 'edit') return `room-form:edit:${key.id}`
  const buildingId = key.buildingId !== undefined ? toValue(key.buildingId) : null
  return `room-form:create:${buildingId || 'none'}`
}

export function useRoomForm<T = unknown>(options: UseRoomFormOptions<T> = {}) {
  const { isLoading, errors, apiError, clearErrors, applyZodErrors, applyApiError } = useFormState()

  const storageKey = computed(() => options.draftKey ? buildStorageKey(options.draftKey) : null)

  const { hasDraft, draftSavedAt, isDirty, restoreDraft, clearDraft, refreshHasDraft } = useLocalFormDraft<T>({
    key: storageKey,
    formData: options.formData,
    initialSnapshot: options.initialSnapshot,
    envelope: true,
  })

  async function submitCreate(input: RoomCreateInput) {
    clearErrors()

    const result = roomCreateSchema.safeParse(input)
    if (!result.success) {
      applyZodErrors(result.error)
      return
    }

    isLoading.value = true
    try {
      await apiFetch<ApiSuccess<Room>>('/api/rooms', {
        method: 'POST',
        body: result.data,
      })
      clearDraft()
      clearNuxtData()
      await navigateTo('/dashboard/rooms')
    }
    catch (e: unknown) {
      applyApiError(e)
    }
    finally {
      isLoading.value = false
    }
  }

  async function submitUpdate(id: string, input: RoomUpdateInput) {
    clearErrors()

    const result = roomUpdateSchema.safeParse(input)
    if (!result.success) {
      applyZodErrors(result.error)
      return
    }

    isLoading.value = true
    try {
      const res = await apiFetch<ApiSuccess<Room>>(`/api/rooms/${id}`, {
        method: 'PATCH',
        body: result.data,
      })
      clearDraft()
      clearNuxtData()
      await navigateTo(roomPath(res.data))
    }
    catch (e: unknown) {
      applyApiError(e)
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
