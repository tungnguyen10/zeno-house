import type { Room } from '~/types/rooms'
import type { ApiSuccess } from '~/types/api'
import { roomCreateSchema, roomUpdateSchema } from '~/utils/validators/rooms'
import type { RoomCreateInput, RoomUpdateInput } from '~/utils/validators/rooms'

export function useRoomForm() {
  const isLoading = ref(false)
  const errors = ref<Record<string, string[]>>({})
  const apiError = ref<string | null>(null)

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
      await $fetch<ApiSuccess<Room>>(`/api/rooms/${id}`, {
        method: 'PATCH',
        body: result.data,
      })
      await navigateTo(`/rooms/${id}`)
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
  }
}
