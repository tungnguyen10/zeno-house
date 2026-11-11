import type { Building } from '~/types/buildings'
import type { ApiSuccess } from '~/types/api'
import { buildingCreateWithRoomsSchema, buildingUpdateSchema } from '~/utils/validators/buildings'
import type { BuildingCreateWithRoomsInput, BuildingUpdateInput } from '~/utils/validators/buildings'
import { getApiErrorDetails } from '~/utils/api-error'
import type { ApiErrorLike } from '~/utils/api-error'
import { buildingPath } from '~/utils/routes/operational'
import { useLocalFormDraft } from '~/composables/useLocalFormDraft'
import { useFormState } from '~/composables/useFormState'

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
  const { isLoading, errors, apiError, clearErrors, applyZodErrors, applyApiError } = useFormState()

  // Keep retries in this form session on the same idempotent operation.
  const requestId = crypto.randomUUID()
  const duplicateRoomNumbers = ref<string[]>([])

  const storageKey = options.draftKey ? buildStorageKey(options.draftKey) : null

  const { hasDraft, isDirty, restoreDraft, clearDraft, refreshHasDraft } = useLocalFormDraft<T>({
    key: storageKey,
    formData: options.formData,
    initialSnapshot: options.initialSnapshot,
  })

  async function submitCreate(input: Omit<BuildingCreateWithRoomsInput, 'request_id'>) {
    clearErrors()

    duplicateRoomNumbers.value = []

    const result = buildingCreateWithRoomsSchema.safeParse({
      ...input,
      rooms: input.rooms?.length ? input.rooms : undefined,
      request_id: requestId,
    })
    if (!result.success) {
      applyZodErrors(result.error)
      return
    }

    isLoading.value = true
    try {
      await apiFetch<ApiSuccess<Building>>('/api/buildings', {
        method: 'POST',
        body: result.data,
      })

      clearDraft()
      clearNuxtData()
      await navigateTo('/dashboard/buildings')
    }
    catch (e: unknown) {
      applyApiError(e)
      const details = getApiErrorDetails<{ reason?: string; duplicate_room_numbers?: string[] }>(e)
      if (details?.reason === 'ROOM_BATCH_DUPLICATE') {
        duplicateRoomNumbers.value = details.duplicate_room_numbers ?? []
      }
      // apiFetch can retain a non-enumerable FetchError status only on its cause.
      const error = e as (ApiErrorLike & { cause?: ApiErrorLike }) | null
      const statusCode = error?.statusCode ?? error?.cause?.statusCode
      if (statusCode === undefined || statusCode >= 500) {
        apiError.value = 'Chưa xác nhận được kết quả. Bấm thử lại để kiểm tra và tiếp tục.'
      }
    }
    finally {
      isLoading.value = false
    }
  }

  async function submitUpdate(id: string, input: BuildingUpdateInput) {
    clearErrors()

    const result = buildingUpdateSchema.safeParse(input)
    if (!result.success) {
      applyZodErrors(result.error)
      return
    }

    isLoading.value = true
    try {
      const res = await apiFetch<ApiSuccess<Building>>(`/api/buildings/${id}`, {
        method: 'PATCH',
        body: result.data,
      })
      clearDraft()
      clearNuxtData()
      await navigateTo(buildingPath(res.data))
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
    requestId,
    duplicateRoomNumbers,
    submitUpdate,
    isDirty,
    hasDraft,
    restoreDraft,
    clearDraft,
    refreshHasDraft,
  }
}
