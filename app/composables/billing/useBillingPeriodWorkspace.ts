import type { ApiSuccess } from '~/types/api'
import type {
  BillingPeriod,
  BillingWorkspaceOverview,
  BillingDraftResponse,
  BillingDraftGridResponse,
  Invoice,
  BillingUtilityUsage,
  BillingAuditEvent,
  IssueInvoicesResult,
} from '~/types/billing'
import type { MeterReading } from '~/types/meter-readings'
import type {
  IssueInvoicesInput,
  UtilityUsageOverrideInput,
} from '~/utils/validators/billing'
import type { MeterReadingBulkInput } from '~/utils/validators/meter-readings'

/**
 * Workspace-level data for one billing period: overview, drafts, invoices,
 * utility overrides, and audit events. Each section is its own request so
 * tabs can refresh independently.
 */
export function useBillingPeriodWorkspace(periodId: MaybeRefOrGetter<string>) {
  const id = computed(() => toValue(periodId))

  const period = ref<BillingPeriod | null>(null)
  const overview = ref<BillingWorkspaceOverview | null>(null)
  const drafts = ref<BillingDraftResponse | null>(null)
  const grid = ref<BillingDraftGridResponse | null>(null)
  const invoices = ref<Invoice[]>([])
  const utilityUsages = ref<BillingUtilityUsage[]>([])
  const auditEvents = ref<BillingAuditEvent[]>([])

  const overviewLoading = ref(false)
  const draftsLoading = ref(false)
  const gridLoading = ref(false)
  const invoicesLoading = ref(false)
  const utilityLoading = ref(false)
  const auditLoading = ref(false)

  async function loadOverview() {
    if (!id.value) return
    overviewLoading.value = true
    try {
      const resp = await $fetch<ApiSuccess<BillingWorkspaceOverview>>(`/api/billing/periods/${id.value}/overview`)
      overview.value = resp.data
      period.value = resp.data.period
    } finally {
      overviewLoading.value = false
    }
  }

  async function loadDrafts() {
    if (!id.value) return
    draftsLoading.value = true
    try {
      const resp = await $fetch<ApiSuccess<BillingDraftResponse>>(`/api/billing/periods/${id.value}/drafts`)
      drafts.value = resp.data
    } finally {
      draftsLoading.value = false
    }
  }

  async function loadGrid() {
    if (!id.value) return
    gridLoading.value = true
    try {
      const resp = await $fetch<ApiSuccess<BillingDraftGridResponse>>(`/api/billing/periods/${id.value}/draft-grid`)
      grid.value = resp.data
    } finally {
      gridLoading.value = false
    }
  }

  async function saveReadings(readings: MeterReadingBulkInput['readings']): Promise<MeterReading[]> {
    if (readings.length === 0) return []
    const resp = await $fetch<ApiSuccess<MeterReading[]>>(`/api/meter-readings/bulk`, {
      method: 'POST',
      body: { readings },
    })
    await Promise.all([loadGrid(), loadOverview()])
    return resp.data
  }

  async function loadInvoices() {
    if (!id.value) return
    invoicesLoading.value = true
    try {
      const resp = await $fetch<ApiSuccess<Invoice[]>>(`/api/billing/periods/${id.value}/invoices`)
      invoices.value = resp.data
    } finally {
      invoicesLoading.value = false
    }
  }

  async function loadUtilityUsages() {
    if (!id.value) return
    utilityLoading.value = true
    try {
      const resp = await $fetch<ApiSuccess<BillingUtilityUsage[]>>(`/api/billing/periods/${id.value}/utility-usages`)
      utilityUsages.value = resp.data
    } finally {
      utilityLoading.value = false
    }
  }

  async function loadAudit() {
    if (!id.value) return
    auditLoading.value = true
    try {
      const resp = await $fetch<ApiSuccess<BillingAuditEvent[]>>(`/api/billing/periods/${id.value}/audit`)
      auditEvents.value = resp.data
    } finally {
      auditLoading.value = false
    }
  }

  async function issue(input: IssueInvoicesInput): Promise<IssueInvoicesResult> {
    if (!id.value) throw new Error('No period id')
    const resp = await $fetch<ApiSuccess<IssueInvoicesResult>>(`/api/billing/periods/${id.value}/issue`, {
      method: 'POST',
      body: input,
    })
    await Promise.all([loadOverview(), loadInvoices(), loadDrafts(), loadGrid()])
    return resp.data
  }

  async function close(): Promise<BillingPeriod> {
    if (!id.value) throw new Error('No period id')
    const resp = await $fetch<ApiSuccess<BillingPeriod>>(`/api/billing/periods/${id.value}/close`, {
      method: 'POST',
    })
    period.value = resp.data
    await loadOverview()
    return resp.data
  }

  async function saveUtilityOverride(input: UtilityUsageOverrideInput): Promise<BillingUtilityUsage> {
    if (!id.value) throw new Error('No period id')
    const resp = await $fetch<ApiSuccess<BillingUtilityUsage>>(`/api/billing/periods/${id.value}/utility-usages`, {
      method: 'POST',
      body: input,
    })
    await Promise.all([loadUtilityUsages(), loadDrafts(), loadGrid()])
    return resp.data
  }

  return {
    id,
    period,
    overview,
    drafts,
    grid,
    invoices,
    utilityUsages,
    auditEvents,
    overviewLoading,
    draftsLoading,
    gridLoading,
    invoicesLoading,
    utilityLoading,
    auditLoading,
    loadOverview,
    loadDrafts,
    loadGrid,
    loadInvoices,
    loadUtilityUsages,
    loadAudit,
    issue,
    close,
    saveReadings,
    saveUtilityOverride,
  }
}
