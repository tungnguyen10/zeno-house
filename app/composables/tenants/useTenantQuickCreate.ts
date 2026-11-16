import type { ApiSuccess } from '~/types/api'
import type { Tenant, TenantSummary } from '~/types/tenants'
import type { TenantCreateInput } from '~/utils/validators/tenants'
import { getApiErrorCode, getApiErrorDetails, getApiErrorMessage } from '~/utils/api-error'

export type QuickCreateResult =
  | { kind: 'created'; tenant: TenantSummary }
  | { kind: 'duplicate'; existingTenantId: string; fields: ('phone' | 'id_number')[] }
  | { kind: 'conflict'; message: string }
  | { kind: 'error'; message: string; fieldErrors?: Record<string, string[]> }

export function toTenantSummary(tenant: Tenant): TenantSummary {
  return { id: tenant.id, code: tenant.code, fullName: tenant.fullName, phone: tenant.phone }
}

export function useTenantQuickCreate() {
  const submitting = ref(false)

  async function submit(input: TenantCreateInput): Promise<QuickCreateResult> {
    submitting.value = true
    try {
      const res = await apiFetch<ApiSuccess<Tenant>>('/api/tenants', { method: 'POST', body: input })
      return { kind: 'created', tenant: toTenantSummary(res.data) }
    }
    catch (error) {
      const status = (error as { statusCode?: number }).statusCode
      const code = getApiErrorCode(error) as string | undefined
      if (code === 'TENANT_DUPLICATE') {
        const details = getApiErrorDetails<{ existingTenantId: string; fieldErrors?: Record<string, string[]> }>(error)!
        return {
          kind: 'duplicate',
          existingTenantId: details.existingTenantId,
          fields: Object.keys(details.fieldErrors ?? {}) as ('phone' | 'id_number')[],
        }
      }
      if (status === 409) return { kind: 'conflict', message: getApiErrorMessage(error) }
      const details = getApiErrorDetails<{ fieldErrors?: Record<string, string[]> }>(error)
      return {
        kind: 'error',
        message: getApiErrorMessage(error, 'Không thể tạo khách thuê. Vui lòng thử lại.'),
        fieldErrors: details?.fieldErrors,
      }
    }
    finally {
      submitting.value = false
    }
  }

  return { submitting, submit }
}
