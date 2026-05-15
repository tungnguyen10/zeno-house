import type { ContractWithDetails } from '~/types/contracts'
import type { ApiSuccess } from '~/types/api'
import { contractCreateSchema, contractUpdateSchema } from '~/utils/validators/contracts'
import type { ContractCreateInput, ContractUpdateInput } from '~/utils/validators/contracts'

export function useContractForm() {
  const isLoading = ref(false)
  const errors = ref<Record<string, string[]>>({})
  const apiError = ref<string | null>(null)

  function clearErrors() {
    errors.value = {}
    apiError.value = null
  }

  async function submitCreate(input: ContractCreateInput) {
    clearErrors()

    const result = contractCreateSchema.safeParse(input)
    if (!result.success) {
      errors.value = result.error.flatten().fieldErrors as Record<string, string[]>
      return null
    }

    isLoading.value = true
    try {
      const response = await $fetch<ApiSuccess<ContractWithDetails>>('/api/contracts', {
        method: 'POST',
        body: result.data,
      })
      return response.data
    }
    catch (e: unknown) {
      const err = e as { data?: { error?: { message?: string } } }
      apiError.value = err?.data?.error?.message ?? 'Đã xảy ra lỗi. Vui lòng thử lại.'
      return null
    }
    finally {
      isLoading.value = false
    }
  }

  async function submitUpdate(id: string, input: ContractUpdateInput) {
    clearErrors()

    const result = contractUpdateSchema.safeParse(input)
    if (!result.success) {
      errors.value = result.error.flatten().fieldErrors as Record<string, string[]>
      return null
    }

    isLoading.value = true
    try {
      const response = await $fetch<ApiSuccess<ContractWithDetails>>(`/api/contracts/${id}`, {
        method: 'PATCH',
        body: result.data,
      })
      return response.data
    }
    catch (e: unknown) {
      const err = e as { data?: { error?: { message?: string } } }
      apiError.value = err?.data?.error?.message ?? 'Đã xảy ra lỗi. Vui lòng thử lại.'
      return null
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
