import type { BillingItemSummary, BillingItemsSummary, BillingPaymentStatus } from '~/types/billing'
import type { ApiSuccess } from '~/types/api'

export function useBillingItems(billingRunId: MaybeRef<string | null>) {
  const paymentStatusFilter = ref<BillingPaymentStatus | ''>('')
  const searchQuery = ref('')

  const { data, status, refresh } = useAsyncData(
    () => `billing-items-${toValue(billingRunId)}`,
    () => {
      const id = toValue(billingRunId)
      if (!id) return Promise.resolve(null)
      const params = new URLSearchParams({ billing_run_id: id })
      if (paymentStatusFilter.value) params.set('payment_status', paymentStatusFilter.value)
      if (searchQuery.value) params.set('q', searchQuery.value)
      return $fetch<ApiSuccess<BillingItemSummary[]>>(`/api/billing-items?${params.toString()}`)
    },
    {
      server: false,
      watch: [() => toValue(billingRunId), paymentStatusFilter, searchQuery],
    },
  )

  const items = computed(() => data.value?.data ?? [])
  const isLoading = computed(() => status.value === 'pending')

  const summary = computed<BillingItemsSummary>(() => {
    const list = items.value
    return {
      totalRooms: list.length,
      totalReceivable: list.reduce((s, i) => s + i.totalAmount, 0),
      totalPaid: list.filter(i => i.paymentStatus === 'paid').reduce((s, i) => s + i.totalAmount, 0),
      totalUnpaid: list.filter(i => i.paymentStatus === 'unpaid').reduce((s, i) => s + i.totalAmount, 0),
      totalElectricity: list.reduce((s, i) => s + i.electricityAmount, 0),
      totalWater: list.reduce((s, i) => s + i.waterAmount, 0),
    }
  })

  return { items, summary, isLoading, status, refresh, paymentStatusFilter, searchQuery }
}
