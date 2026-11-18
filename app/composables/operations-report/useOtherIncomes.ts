import type { ApiSuccess } from '~/types/api'
import type { BuildingOtherIncome } from '~/types/operations-report'
import type {
  BuildingOtherIncomeCreateInput,
  BuildingOtherIncomeUpdateInput,
  BuildingOtherIncomeVoidInput,
} from '~/utils/validators/operations-report'
import { getApiErrorDetails, getApiErrorMessage } from '~/utils/api-error'

export function otherIncomeConflictReason(error: unknown) {
  return getApiErrorDetails<{ reason?: string }>(error)?.reason
}

export function otherIncomeErrorMessage(error: unknown) {
  const reason = otherIncomeConflictReason(error)
  if (reason === 'OTHER_INCOME_PERIOD_CLOSED')
    return 'Kỳ báo cáo vừa được chốt. Hãy đóng biểu mẫu và tải lại báo cáo để xem số liệu mới nhất.'
  if (reason === 'OTHER_INCOME_STALE')
    return 'Khoản thu đã thay đổi. Hãy đóng biểu mẫu và tải lại báo cáo trước khi tiếp tục.'
  return getApiErrorMessage(error, 'Chưa lưu được khoản thu. Vui lòng thử lại.')
}

export function useOtherIncomes() {
  const url = '/api/building-other-incomes'
  return {
    createIncome: (body: BuildingOtherIncomeCreateInput) =>
      apiFetch<ApiSuccess<BuildingOtherIncome>>(url, { method: 'POST', body }),
    updateIncome: (id: string, body: BuildingOtherIncomeUpdateInput) =>
      apiFetch<ApiSuccess<BuildingOtherIncome>>(`${url}/${id}`, { method: 'PATCH', body }),
    voidIncome: (id: string, body: BuildingOtherIncomeVoidInput) =>
      apiFetch<ApiSuccess<BuildingOtherIncome>>(`${url}/${id}`, { method: 'DELETE', body }),
  }
}
