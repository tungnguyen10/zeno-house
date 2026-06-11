<script setup lang="ts">
import type { UiTabItem } from '~/components/ui/UiTabs.vue'
import BillingOverviewStep from '~/components/billing/BillingOverviewStep.vue'
import BillingDraftGridStep from '~/components/billing/BillingDraftGridStep.vue'
import BillingIssueStep from '~/components/billing/BillingIssueStep.vue'
import BillingPaymentsStep from '~/components/billing/BillingPaymentsStep.vue'
import BillingAuditStep from '~/components/billing/BillingAuditStep.vue'
import BillingCloseStep from '~/components/billing/BillingCloseStep.vue'

definePageMeta({ title: 'Kỳ vận hành' })

const route = useRoute()
const buildingId = String(route.params.building ?? '')
const periodToken = String(route.params.period ?? '') // YYYY-MM
const [yearStr, monthStr] = periodToken.split('-')
const periodYear = Number(yearStr)
const periodMonth = Number(monthStr)

if (!buildingId || !Number.isFinite(periodYear) || !Number.isFinite(periodMonth) || periodMonth < 1 || periodMonth > 12) {
  throw createError({ statusCode: 404, statusMessage: 'Kỳ vận hành không hợp lệ' })
}

// Resolve / create the period record
const periodId = ref<string>('')
const resolveError = ref<string | null>(null)
const resolving = ref(true)

async function resolvePeriod() {
  resolving.value = true
  resolveError.value = null
  try {
    const resp = await $fetch<{ data: { id: string } }>('/api/billing/periods', {
      method: 'POST',
      body: { building_id: buildingId, period_year: periodYear, period_month: periodMonth },
    })
    periodId.value = resp.data.id
  } catch (err) {
    const e = err as { data?: { error?: { message?: string } }; statusMessage?: string }
    resolveError.value = e.data?.error?.message ?? e.statusMessage ?? 'Không thể mở kỳ vận hành'
  } finally {
    resolving.value = false
  }
}

await resolvePeriod()

const workspace = useBillingPeriodWorkspace(periodId)
const {
  period, overview, drafts, grid, invoices, utilityUsages, auditEvents,
  overviewLoading, draftsLoading, gridLoading, invoicesLoading, auditLoading,
  loadOverview, loadDrafts, loadGrid, loadInvoices, loadUtilityUsages, loadAudit,
  issue, close, saveReadings, saveUtilityOverride,
} = workspace

// Load overview eagerly so the header can render the period status
if (periodId.value) await loadOverview()

const auth = useAuthStore()
const canClose = computed(() => auth.isAdmin)

const tab = ref<string>('overview')
const tabs = computed<UiTabItem[]>(() => {
  const status = period.value?.status
  const closed = status === 'closed'
  const issued = status === 'issued' || status === 'collecting' || closed
  return [
    { key: 'overview', label: 'Tổng quan' },
    {
      key: 'draft-grid',
      label: 'Chỉ số & hoá đơn nháp',
      count: grid.value?.totals.blockedDraftCount || undefined,
      reason: closed ? 'Kỳ đã chốt' : undefined,
    },
    {
      key: 'issue',
      label: 'Phát hành',
      count: drafts.value?.totals.issuableDraftCount ?? undefined,
      reason: closed ? 'Kỳ đã chốt' : issued ? 'Kỳ đã phát hành' : undefined,
      disabled: closed,
    },
    { key: 'payments', label: 'Thanh toán & công nợ' },
    { key: 'audit', label: 'Nhật ký' },
    { key: 'close', label: 'Chốt kỳ', reason: closed ? 'Kỳ đã chốt' : undefined },
  ]
})

watch(tab, async (current) => {
  if (current === 'draft-grid') {
    const tasks: Promise<unknown>[] = []
    if (!grid.value) tasks.push(loadGrid())
    if (utilityUsages.value.length === 0) tasks.push(loadUtilityUsages())
    if (tasks.length > 0) await Promise.all(tasks)
  }
  if (current === 'issue') {
    if (!drafts.value) await loadDrafts()
    if (invoices.value.length === 0) await loadInvoices()
  }
  if (current === 'payments' && invoices.value.length === 0) await loadInvoices()
  if (current === 'audit' && auditEvents.value.length === 0) await loadAudit()
  if (current === 'close' && !drafts.value) await loadDrafts()
})

function periodLabel(): string {
  return `${String(periodMonth).padStart(2, '0')}/${periodYear}`
}
</script>

<template>
  <div class="space-y-5">
    <UiAlert v-if="resolveError" severity="danger">{{ resolveError }}</UiAlert>

    <template v-if="!resolveError">
      <UiPageHeader
        :title="`Kỳ ${periodLabel()} — ${overview?.buildingName ?? 'Đang tải...'}`"
        description="Quản lý nhập chỉ số, soát hoá đơn, phát hành, thanh toán và chốt kỳ."
      >
        <template #actions>
          <UiStatusBadge v-if="period" :status="period.status" context="period" />
          <NuxtLink to="/billing">
            <UiButton variant="ghost" size="sm">← Danh sách kỳ</UiButton>
          </NuxtLink>
        </template>
      </UiPageHeader>

      <UiTabs v-model="tab" :tabs="tabs" />

      <div v-if="resolving || (overviewLoading && !overview)" class="space-y-3">
        <UiSkeleton class="h-24 w-full" />
        <UiSkeleton class="h-48 w-full" />
      </div>

      <template v-else-if="overview && period">
        <BillingOverviewStep
          v-if="tab === 'overview'"
          :overview="overview"
          :loading="overviewLoading"
          @refresh="loadOverview"
        />

        <BillingDraftGridStep
          v-else-if="tab === 'draft-grid'"
          :response="grid"
          :loading="gridLoading"
          :period="period"
          :on-save-readings="async (readings) => { await saveReadings(readings); await loadDrafts() }"
          :on-save-override="async (input) => { await saveUtilityOverride(input) }"
          @refresh="async () => { await loadGrid(); await loadOverview() }"
        />

        <BillingIssueStep
          v-else-if="tab === 'issue'"
          :drafts="drafts"
          :loading="draftsLoading"
          @refresh="loadDrafts"
          @issue="async (input) => { return await issue(input) }"
        />

        <BillingPaymentsStep
          v-else-if="tab === 'payments'"
          :period="period"
          :invoices="invoices"
          :loading="invoicesLoading"
          @reload="async () => { await loadInvoices(); await loadOverview() }"
        />

        <BillingAuditStep
          v-else-if="tab === 'audit'"
          :events="auditEvents"
          :loading="auditLoading"
          @refresh="loadAudit"
        />

        <BillingCloseStep
          v-else-if="tab === 'close'"
          :overview="overview"
          :period="period"
          :can-close="canClose"
          @close-period="async () => { await close() }"
        />
      </template>
    </template>
  </div>
</template>
