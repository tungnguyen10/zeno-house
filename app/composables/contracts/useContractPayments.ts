import type { ContractPayment } from '~/types/contract-payments'
import type { ContractPaymentCreateInput, ContractPaymentUpdateInput } from '~/utils/validators/contract-payments'
import type { ApiSuccess } from '~/types/api'

export function useContractPayments(contractId: MaybeRef<string>) {
  const payments = ref<ContractPayment[]>([])
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  async function fetchPayments() {
    isLoading.value = true
    error.value = null
    try {
      const res = await apiFetch<ApiSuccess<ContractPayment[]>>(
        `/api/contracts/${toValue(contractId)}/payments`,
      )
      payments.value = res.data
    } catch (e) {
      error.value = e as Error
    } finally {
      isLoading.value = false
    }
  }

  async function addPayment(input: ContractPaymentCreateInput): Promise<ContractPayment> {
    const res = await apiFetch<ApiSuccess<ContractPayment>>(
      `/api/contracts/${toValue(contractId)}/payments`,
      { method: 'POST', body: input },
    )
    payments.value = [res.data, ...payments.value]
    return res.data
  }

  async function updatePayment(paymentId: string, input: ContractPaymentUpdateInput): Promise<ContractPayment> {
    const res = await apiFetch<ApiSuccess<ContractPayment>>(
      `/api/contracts/${toValue(contractId)}/payments/${paymentId}`,
      { method: 'PATCH', body: input },
    )
    payments.value = payments.value.map(p => p.id === paymentId ? res.data : p)
    return res.data
  }

  async function removePayment(paymentId: string): Promise<void> {
    await apiFetch(
      `/api/contracts/${toValue(contractId)}/payments/${paymentId}`,
      { method: 'DELETE' },
    )
    payments.value = payments.value.filter(p => p.id !== paymentId)
  }

  fetchPayments()

  return { payments, isLoading, error, addPayment, updatePayment, removePayment, refresh: fetchPayments }
}
