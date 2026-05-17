import type { Building } from '~/types/buildings'
import type { ApiSuccess } from '~/types/api'
import { buildingCreateSchema, buildingUpdateSchema } from '~/utils/validators/buildings'
import type { BuildingCreateInput, BuildingUpdateInput } from '~/utils/validators/buildings'

interface QuickRoom {
  room_number: string
  monthly_rent: number
  area: number | null
}

type CreateInput = BuildingCreateInput & { quickRooms?: QuickRoom[] }

export function useBuildingForm() {
  const isLoading = ref(false)
  const errors = ref<Record<string, string[]>>({})
  const apiError = ref<string | null>(null)

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
      await $fetch<ApiSuccess<Building>>(`/api/buildings/${id}`, {
        method: 'PATCH',
        body: result.data,
      })
      await navigateTo(`/buildings/${id}`)
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
