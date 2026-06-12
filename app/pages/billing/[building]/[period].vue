<script setup lang="ts">
import type { UiTabItem } from '~/components/ui/UiTabs.vue'
import BillingKpiStrip from '~/components/billing/BillingKpiStrip.vue'
import BillingDraftGridStep from '~/components/billing/BillingDraftGridStep.vue'
import BillingIssueStep from '~/components/billing/BillingIssueStep.vue'
import BillingPaymentsStep from '~/components/billing/BillingPaymentsStep.vue'
import type { BillingPaymentsIntent } from '~/components/billing/BillingPaymentsStep.vue'
import BillingAuditStep from '~/components/billing/BillingAuditStep.vue'
import BillingCloseStep from '~/components/billing/BillingCloseStep.vue'

definePageMeta({ title: 'Kỳ vận hành' })

const route = useRoute()
const buildingId = String(route.params.building ?? '')
const periodToken = String(route.params.period ?? '')
const [yearStr, monthStr] = periodToken.split('-')
const periodYear = Number(yearStr)
const periodMonth = Number(monthStr)

if (!buildingId || !Number.isFinite(periodYear) || !Number.isFinite(periodMonth) || periodMonth < 1 || periodMonth > 12) {
  throw createError({ statusCode: 404, statusMessage: 'Kỳ vận hành không hợp lệ' })
}

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
  }
  catch (err) {
    const e = err as { data?: { error?: { message?: string } }; statusMessage?: string }
    resolveError.value = e.data?.error?.message ?? e.statusMessage ?? 'Không thể mở kỳ vận hành'
  }
  finally {
    resolving.value = false
  }
}

await resolvePeriod()

const workspace = useBillingPeriodWorkspace(periodId)
const {
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
} = workspace

if (periodId.value) await loadOverview()

const auth = useAuthStore()
const canClose = computed(() => auth.isAdmin)
const toast = useToast()
const tab = ref<string>('draft-grid')
const auditOpen = ref(false)
const closeOpen = ref(false)
const paymentsIntent = ref<BillingPaymentsIntent | null>(null)
let paymentsIntentId = 0

const tabs = computed<UiTabItem[]>(() => {
  const status = period.value?.status
  const closed = status === 'closed'
  const issued = status === 'issued' || status === 'collecting' || closed
  return [
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
    // Always refresh drafts — readings/overrides on the grid tab can change
    // totals; relying on the cached snapshot would show stale numbers here.
    await loadDrafts()
    if (invoices.value.length === 0) await loadInvoices()
  }
  if (current === 'payments') {
    const tasks: Promise<unknown>[] = []
    if (invoices.value.length === 0) tasks.push(loadInvoices())
    // Drafts power the reissue preview. Refresh so the modal reflects the
    // latest readings/overrides, not whatever was loaded earlier.
    tasks.push(loadDrafts())
    await Promise.all(tasks)
  }
})

watch(auditOpen, async (open) => {
  if (open && auditEvents.value.length === 0) await loadAudit()
})

watch(closeOpen, async (open) => {
  if (open && !drafts.value) await loadDrafts()
})

function periodLabel(): string {
  return `${String(periodMonth).padStart(2, '0')}/${periodYear}`
}

async function closePeriodFromModal() {
  try {
    await close()
    toast.success('Đã chốt kỳ vận hành')
    closeOpen.value = false
    await loadOverview()
  }
  catch (err) {
    const e = err as { data?: { error?: { message?: string } }; message?: string }
    toast.error(e.data?.error?.message ?? e.message ?? 'Chốt kỳ thất bại')
    throw err
  }
}

async function saveReadingsWithToast(readings: Parameters<typeof saveReadings>[0]) {
  try {
    const result = await saveReadings(readings)
    toast.success(`Đã lưu ${result.length} chỉ số`)
    await loadDrafts()
  }
  catch (err) {
    const e = err as { data?: { error?: { message?: string } }; message?: string }
    toast.error(e.data?.error?.message ?? e.message ?? 'Lưu chỉ số thất bại')
    throw err
  }
}

async function saveUtilityOverrideWithToast(input: Parameters<typeof saveUtilityOverride>[0]) {
  try {
    await saveUtilityOverride(input)
    toast.success('Đã lưu ghi đè chỉ số')
  }
  catch (err) {
    const e = err as { data?: { error?: { message?: string } }; message?: string }
    toast.error(e.data?.error?.message ?? e.message ?? 'Lưu ghi đè thất bại')
    throw err
  }
}

async function issueWithToast(input: Parameters<typeof issue>[0]) {
  try {
    const result = await issue(input)
    toast.success(`Đã phát hành ${result.issuedCount} hoá đơn`)
    return result
  }
  catch (err) {
    const e = err as { data?: { error?: { message?: string } }; message?: string }
    toast.error(e.data?.error?.message ?? e.message ?? 'Phát hành thất bại')
    throw err
  }
}

async function reloadAfterInvoiceChange() {
  await Promise.all([loadInvoices(), loadOverview(), loadDrafts(), loadGrid()])
}

async function openPaymentsIntent(intent: Omit<BillingPaymentsIntent, 'id'>) {
  if (invoices.value.length === 0) await loadInvoices()
  tab.value = 'payments'
  paymentsIntent.value = {
    id: ++paymentsIntentId,
    ...intent,
  }
}
</script>

<template>
  <div class="space-y-5">
    <UiAlert v-if="resolveError" severity="danger">{{ resolveError }}</UiAlert>

    <template v-if="!resolveError">
      <UiPageHeader
        :title="`Kỳ ${periodLabel()} - ${overview?.buildingName ?? 'Đang tải...'}`"
        description="Quản lý nhập chỉ số, soát hoá đơn, phát hành, thanh toán và chốt kỳ."
      >
        <template #actions>
          <UiStatusBadge v-if="period" :status="period.status" context="period" />
          <UiButton variant="secondary" size="sm" @click="auditOpen = true">Nhật ký</UiButton>
          <UiButton
            variant="ghost"
            size="sm"
            icon-only
            aria-label="Thêm hành động"
            :disabled="!canClose || period?.status === 'closed'"
            @click="closeOpen = true"
          >
            ...
          </UiButton>
          <NuxtLink to="/billing">
            <UiButton variant="ghost" size="sm">← Danh sách kỳ</UiButton>
          </NuxtLink>
        </template>
      </UiPageHeader>

      <div v-if="resolving || (overviewLoading && !overview)" class="space-y-3">
        <UiSkeleton class="h-24 w-full" />
        <UiSkeleton class="h-48 w-full" />
      </div>

      <template v-else-if="overview && period">
        <BillingKpiStrip :overview="overview" :loading="overviewLoading" />
        <UiTabs v-model="tab" :tabs="tabs" />

        <BillingDraftGridStep
          v-if="tab === 'draft-grid'"
          :response="grid"
          :loading="gridLoading"
          :period="period"
          :on-save-readings="saveReadingsWithToast"
          :on-save-override="saveUtilityOverrideWithToast"
          @refresh="async () => { await loadGrid(); await loadOverview() }"
          @intent:adjustment="openPaymentsIntent({ type: 'adjustment', ...$event })"
          @intent:void-reissue="openPaymentsIntent({ type: 'void-reissue', ...$event })"
        />

        <BillingIssueStep
          v-else-if="tab === 'issue'"
          :drafts="drafts"
          :loading="draftsLoading"
          @refresh="loadDrafts"
          @issue="issueWithToast"
        />

        <BillingPaymentsStep
          v-else-if="tab === 'payments'"
          :period="period"
          :invoices="invoices"
          :loading="invoicesLoading"
          :intent="paymentsIntent"
          :drafts="drafts"
          @reload="reloadAfterInvoiceChange"
        />
      </template>

      <UiDrawer v-model="auditOpen" title="Nhật ký kỳ vận hành" width="w-full sm:w-[44rem]">
        <BillingAuditStep
          :events="auditEvents"
          :loading="auditLoading"
          @refresh="loadAudit"
        />
      </UiDrawer>

      <UiModal :open="closeOpen" title="Chốt kỳ vận hành" size="lg" @close="closeOpen = false">
        <BillingCloseStep
          v-if="overview && period"
          :overview="overview"
          :period="period"
          :can-close="canClose"
          @close-period="closePeriodFromModal"
        />
      </UiModal>
    </template>
  </div>
</template>
