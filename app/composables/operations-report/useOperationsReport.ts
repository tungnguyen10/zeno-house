import type { ApiSuccess } from '~/types/api'
import type { Building } from '~/types/buildings'
import type { BuildingExpense, BuildingFixedCost, OperationsReport } from '~/types/operations-report'

const GENERIC_ERROR = 'Không tải được báo cáo vận hành. Vui lòng thử lại.'

function extractError(raw: unknown): { code: string | null, message: string | null } {
  const body = (raw as { data?: { error?: { code?: string, message?: string } } })?.data
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

  function reload() {
    if (buildingId.value) refresh()
  }

  // Re-fetch whenever a complete filter set is available.
  watch(query, () => reload(), { immediate: true })

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

  async function createFixedCost(payload: Record<string, unknown>): Promise<BuildingFixedCost> {
    const res = await $fetch<ApiSuccess<BuildingFixedCost>>('/api/building-fixed-costs', {
      method: 'POST',
      body: payload,
    })
    return res.data
  }

  return { createExpense, updateExpense, voidExpense, createFixedCost }
}
