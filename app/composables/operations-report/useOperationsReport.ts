import type { ApiSuccess } from '~/types/api'
import type { Building } from '~/types/buildings'
import type {
  BuildingExpense,
  BuildingFixedCost,
  OperationsReport,
  OperationsReportClosure,
  ReserveFundTransaction,
} from '~/types/operations-report'
import type { ApiErrorLike } from '~/utils/api-error'

const GENERIC_ERROR = 'Không tải được báo cáo vận hành. Vui lòng thử lại.'

function extractError(raw: unknown): { code: string | null, message: string | null } {
  const body = (raw as ApiErrorLike).data
  return { code: body?.error?.code ?? null, message: body?.error?.message ?? null }
}

export function useOperationsReport() {
  const now = new Date()
  const buildingId = ref<string | null>(null)
  const periodYear = ref(now.getFullYear())
  const periodMonth = ref(now.getMonth() + 1)

  // --- Buildings (scoped by server) -------------------------------------
  const { data: buildingsData } = useFetch<ApiSuccess<Building[]>>('/api/buildings', {
    query: { page: 1, limit: 100, sort: 'name', order: 'asc' },
  })
  const buildings = computed(() => buildingsData.value?.data ?? [])

  // Default to first assigned building once loaded.
  watch(
    buildings,
    (list) => {
      if (!buildingId.value && list.length > 0) buildingId.value = list[0]!.id
    },
    { immediate: true },
  )

  // --- Report -----------------------------------------------------------
  const query = computed(() => ({
    building_id: buildingId.value ?? '',
    period_year: periodYear.value,
    period_month: periodMonth.value,
  }))

  const { data, status, error, refresh } = useFetch<ApiSuccess<OperationsReport>>(
    '/api/operations-report',
    { query, immediate: false, watch: false },
  )

  const report = computed(() => data.value?.data ?? null)
  const isLoading = computed(() => status.value === 'pending')
  const errorMessage = computed<string | null>(() => {
    if (!error.value) return null
    return extractError(error.value).message ?? GENERIC_ERROR
  })
  const errorCode = computed<string | null>(() => {
    if (!error.value) return null
    return extractError(error.value).code
  })
  const forbidden = computed(() => errorCode.value === 'FORBIDDEN')

  async function reload() {
    if (buildingId.value) await refresh()
  }

  async function exportXlsx(): Promise<{ blob: Blob, fileName: string }> {
    if (!buildingId.value) throw new Error('No building id')
    const params = new URLSearchParams({
      building_id: buildingId.value,
      period_year: String(periodYear.value),
      period_month: String(periodMonth.value),
    })
    return useExportDownload().downloadBlob(
      `/api/operations-report/export?${params.toString()}`,
      `bao-cao-van-hanh-${periodYear.value}-${String(periodMonth.value).padStart(2, '0')}.xlsx`,
    )
  }

  // Re-fetch whenever a complete filter set is available.
  watch(query, () => { void reload() }, { immediate: true })

  return {
    buildings,
    buildingId,
    periodYear,
    periodMonth,
    report,
    isLoading,
    errorMessage,
    errorCode,
    forbidden,
    reload,
    exportXlsx,
  }
}

/** Standalone helpers for expense/fixed-cost mutations used by the report page. */
export function useOperationsMutations() {
  async function createExpense(payload: Record<string, unknown>): Promise<BuildingExpense> {
    const res = await $fetch<ApiSuccess<BuildingExpense>>('/api/building-expenses', {
      method: 'POST',
      body: payload,
    })
    return res.data
  }

  async function updateExpense(
    id: string,
    payload: Record<string, unknown>,
  ): Promise<BuildingExpense> {
    const res = await $fetch<ApiSuccess<BuildingExpense>>(`/api/building-expenses/${id}`, {
      method: 'PATCH',
      body: payload,
    })
    return res.data
  }

  async function voidExpense(id: string, voidReason: string): Promise<BuildingExpense> {
    const res = await $fetch<ApiSuccess<BuildingExpense>>(`/api/building-expenses/${id}`, {
      method: 'DELETE',
      body: { void_reason: voidReason },
    })
    return res.data
  }

  async function uploadExpenseReceipt(id: string, file: File): Promise<BuildingExpense> {
    const form = new FormData()
    form.append('receipt', file)
    const res = await $fetch<ApiSuccess<BuildingExpense>>(`/api/building-expenses/${id}/receipt`, {
      method: 'POST',
      body: form,
    })
    return res.data
  }

  async function removeExpenseReceipt(id: string): Promise<BuildingExpense> {
    const res = await $fetch<ApiSuccess<BuildingExpense>>(`/api/building-expenses/${id}/receipt`, {
      method: 'DELETE',
    })
    return res.data
  }

  async function createFixedCost(payload: Record<string, unknown>): Promise<BuildingFixedCost> {
    const res = await $fetch<ApiSuccess<BuildingFixedCost>>('/api/building-fixed-costs', {
      method: 'POST',
      body: payload,
    })
    return res.data
  }

  async function closeReport(payload: {
    building_id: string
    period_year: number
    period_month: number
  }): Promise<OperationsReportClosure> {
    const res = await $fetch<ApiSuccess<OperationsReportClosure>>('/api/operations-report/close', {
      method: 'POST',
      body: payload,
    })
    return res.data
  }

  async function reopenReport(payload: {
    building_id: string
    period_year: number
    period_month: number
    reason: string
  }): Promise<OperationsReportClosure> {
    const res = await $fetch<ApiSuccess<OperationsReportClosure>>('/api/operations-report/reopen', {
      method: 'POST',
      body: payload,
    })
    return res.data
  }

  async function refreshReserveAccrual(payload: {
    building_id: string
    period_year: number
    period_month: number
  }): Promise<ReserveFundTransaction> {
    const res = await $fetch<ApiSuccess<ReserveFundTransaction>>(
      `/api/reserve-funds/${payload.building_id}/refresh-accrual`,
      {
        method: 'POST',
        body: {
          period_year: payload.period_year,
          period_month: payload.period_month,
        },
      },
    )
    return res.data
  }

  return {
    createExpense,
    updateExpense,
    voidExpense,
    uploadExpenseReceipt,
    removeExpenseReceipt,
    createFixedCost,
    closeReport,
    reopenReport,
    refreshReserveAccrual,
  }
}
