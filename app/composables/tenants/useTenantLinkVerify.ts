import type { ApiSuccess } from '~/types/api'
import type { TenantSummary } from '~/types/tenants'
import type { TenantLinkVerifyInput } from '~/utils/validators/tenants'
import { getApiErrorCode } from '~/utils/api-error'
import { getTenantApiError } from '~/utils/tenant-api-error'

export type TenantLinkVerifyResult =
  | { kind: 'verified'; tenant: TenantSummary; linkToken: string; expiresAt: string }
  | { kind: 'error'; message: string }

const LINK_ERROR_MESSAGES: Record<string, string> = {
  TENANT_LINK_UNVERIFIED: 'Không khớp với hồ sơ khách',
  TENANT_BUSY: 'Đang thuê nơi khác',
  TENANT_LINK_DISABLED: 'Chưa bật xác minh khách cũ',
}

export function useTenantLinkVerify() {
  const verifying = ref(false)

  async function verify(input: TenantLinkVerifyInput): Promise<TenantLinkVerifyResult> {
    verifying.value = true
    try {
      const res = await apiFetch<ApiSuccess<{ tenant: TenantSummary; linkToken: string; expiresAt: string }>>(
        '/api/tenants/link-verify',
        { method: 'POST', body: input },
      )
      return { kind: 'verified', ...res.data }
    }
    catch (error) {
      const code = getApiErrorCode(error) as string | undefined
      const message = (code && LINK_ERROR_MESSAGES[code]) ?? getTenantApiError(error, 'Không xác minh được. Vui lòng thử lại.').message
      return { kind: 'error', message }
    }
    finally {
      verifying.value = false
    }
  }

  return { verifying, verify }
}
