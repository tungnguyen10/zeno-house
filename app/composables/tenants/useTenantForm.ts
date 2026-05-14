import type { Tenant } from '~/types/tenants'
import type { ApiSuccess } from '~/types/api'
import { tenantCreateSchema, tenantUpdateSchema } from '~/utils/validators/tenants'
import type { TenantCreateInput, TenantUpdateInput } from '~/utils/validators/tenants'

export function useTenantForm() {
  const isLoading = ref(false)
  const errors = ref<Record<string, string[]>>({})
  const apiError = ref<string | null>(null)

  function clearErrors() {
    errors.value = {}
    apiError.value = null
  }

  async function submitCreate(input: TenantCreateInput) {
    clearErrors()

    const result = tenantCreateSchema.safeParse(input)
    if (!result.success) {
      errors.value = result.error.flatten().fieldErrors as Record<string, string[]>
      return
    }

    isLoading.value = true
    try {
      await $fetch<ApiSuccess<Tenant>>('/api/tenants', {
        method: 'POST',
        body: result.data,
      })
      await navigateTo('/tenants')
    }
    catch (e: unknown) {
      const err = e as { data?: { error?: { message?: string } } }
      apiError.value = err?.data?.error?.message ?? 'Đã xảy ra lỗi. Vui lòng thử lại.'
    }
    finally {
      isLoading.value = false
    }
  }

  async function submitUpdate(id: string, input: TenantUpdateInput) {
    clearErrors()

    const result = tenantUpdateSchema.safeParse(input)
    if (!result.success) {
      errors.value = result.error.flatten().fieldErrors as Record<string, string[]>
      return
    }

    isLoading.value = true
    try {
      await $fetch<ApiSuccess<Tenant>>(`/api/tenants/${id}`, {
        method: 'PATCH',
        body: result.data,
      })
      await navigateTo(`/tenants/${id}`)
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
