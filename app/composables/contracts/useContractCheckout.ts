import { getApiErrorMessage } from '~/utils/api-error'
import type { InvoiceWithCharges } from '~/types/billing'
import type { ApiSuccess } from '~/types/api'
import type { CheckoutBundle, CheckoutDraftInput, CheckoutPreview } from '~/types/checkout'
import type { CheckoutChargeModesInput } from '~/utils/validators/checkout'

export interface CheckoutRefundInput { amount: number; paid_at: string; payment_method: string; note?: string }
export interface CheckoutCreditInput { payment_id: string; amount: number; reason: string }
export interface CheckoutChargeInput { label: string; amount: number; note?: string }
export interface CheckoutCorrectionInput { invoice_id: string; amount: number; label: string; reason: string; expected_updated_at: string }
export interface CheckoutActions {
  loadCorrectionInvoice: (invoiceId: string) => Promise<InvoiceWithCharges>
  correct: (input: CheckoutCorrectionInput) => Promise<CheckoutBundle>
  addCharge: (input: CheckoutChargeInput) => Promise<CheckoutBundle>
  save: (input: CheckoutDraftInput) => Promise<CheckoutBundle>
  confirmReturn: () => Promise<CheckoutBundle>
  preview: () => Promise<CheckoutPreview>
  confirm: (snapshotHash: string) => Promise<CheckoutBundle>
  refund: (input: CheckoutRefundInput) => Promise<CheckoutBundle>
  approveCredit: (input: CheckoutCreditInput) => Promise<CheckoutBundle>
  saveChargeModes: (input: CheckoutChargeModesInput) => Promise<CheckoutBundle>
  issueFinal: (snapshotHash: string) => Promise<CheckoutBundle>
}

export function useContractCheckout(contractId: MaybeRef<string>) {
  const bundle = ref<CheckoutBundle | null>(null)
  const isLoading = ref(true)
  const error = ref<string | null>(null)
  const operations = new Map<string, string>()
  const endpoint = () => `/api/contracts/${toValue(contractId)}/checkout`

  async function refresh() {
    isLoading.value = true
    error.value = null
    try {
      const response = await apiFetch<ApiSuccess<CheckoutBundle>>(endpoint())
      bundle.value = response.data
    } catch (err) {
      error.value = getApiErrorMessage(err, 'Không thể tải thông tin trả phòng. Vui lòng thử lại.')
    } finally {
      isLoading.value = false
    }
  }

  async function mutate(path: string, body: Record<string, unknown>): Promise<CheckoutBundle> {
    const key = `${endpoint()}/${path}:${JSON.stringify(body)}`
    const operationId = operations.get(key) ?? crypto.randomUUID()
    operations.set(key, operationId)
    const response = await apiFetch<ApiSuccess<CheckoutBundle>>(`${endpoint()}/${path}`, {
      method: 'POST', body: { ...body, operation_id: operationId },
    })
    bundle.value = response.data
    operations.delete(key)
    return response.data
  }

  const actions: CheckoutActions = {
    async loadCorrectionInvoice(invoiceId) { return (await apiFetch<ApiSuccess<InvoiceWithCharges>>(`/api/billing/invoices/${invoiceId}`)).data },
    correct: input => mutate('corrections', { ...input }),
    addCharge: input => mutate('charges', { ...input }),
    async save(input) {
      const response = await apiFetch<ApiSuccess<CheckoutBundle>>(endpoint(), { method: 'PATCH', body: input })
      bundle.value = response.data
      return response.data
    },
    confirmReturn: () => mutate('return', { expected_updated_at: bundle.value?.checkout?.updatedAt }),
    async preview() {
      return (await apiFetch<ApiSuccess<CheckoutPreview>>(`${endpoint()}/preview`, { method: 'POST', body: {} })).data
    },
    confirm: snapshotHash => mutate('confirm', { snapshot_hash: snapshotHash }),
    refund: input => mutate('refunds', { ...input }),
    approveCredit: input => mutate('credits', { ...input }),
    async saveChargeModes(input) {
      const response = await apiFetch<ApiSuccess<CheckoutBundle>>(`${endpoint()}/charge-modes`, { method: 'PATCH', body: input })
      bundle.value = response.data
      return response.data
    },
    issueFinal: snapshotHash => mutate('issue-final', { snapshot_hash: snapshotHash }),
  }

  if (import.meta.client) refresh()
  return { bundle, isLoading, error, refresh, actions }
}
