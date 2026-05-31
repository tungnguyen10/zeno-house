import type { ApiSuccess } from '~/types/api'
import type { BillingWorkspaceWarning } from '~/types/billing'

interface PreviewItem {
  contractId: string
  roomId: string
  roomNumber: string
  tenantName: string
  amounts: {
    rentAmount: number
    serviceAmount: number
    electricityAmount: number
    waterAmount: number
    utilityAmount: number
    totalAmount: number
  }
  warnings: BillingWorkspaceWarning[]
}

interface PreviewResult {
  items: PreviewItem[]
  globalWarnings: BillingWorkspaceWarning[]
}

export function useBillingPreview(
  buildingId: MaybeRef<string>,
  year: MaybeRef<number>,
  month: MaybeRef<number>,
) {
  const previewItems = ref<PreviewItem[]>([])
  const warnings = ref<BillingWorkspaceWarning[]>([])
  const isCalculating = ref(false)
  const error = ref<string | null>(null)

  async function calculate() {
    isCalculating.value = true
    error.value = null
    try {
      const res = await $fetch<ApiSuccess<PreviewResult>>('/api/billing-runs/preview', {
        method: 'POST',
        body: {
          building_id: toValue(buildingId),
          year: toValue(year),
          month: toValue(month),
        },
      })
      previewItems.value = res.data.items
      warnings.value = res.data.globalWarnings
    }
    catch (e: any) {
      error.value = e?.data?.error?.message ?? 'Lỗi tính toán preview'
    }
    finally {
      isCalculating.value = false
    }
  }

  function reset() {
    previewItems.value = []
    warnings.value = []
    error.value = null
  }

  return { previewItems, warnings, isCalculating, error, calculate, reset }
}
