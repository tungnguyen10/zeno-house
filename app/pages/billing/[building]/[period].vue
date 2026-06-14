<script setup lang="ts">
import type { UiTabItem } from '~/components/ui/UiTabs.vue'
import BillingKpiStrip from '~/components/billing/BillingKpiStrip.vue'
import BillingDraftGridStep from '~/components/billing/BillingDraftGridStep.vue'
import BillingIssueStep from '~/components/billing/BillingIssueStep.vue'
import BillingPaymentsStep from '~/components/billing/BillingPaymentsStep.vue'
import type { BillingPaymentsIntent } from '~/components/billing/BillingPaymentsStep.vue'
import BillingAuditStep from '~/components/billing/BillingAuditStep.vue'
import BillingCloseStep from '~/components/billing/BillingCloseStep.vue'
import BillingUnissueModal from '~/components/billing/BillingUnissueModal.vue'
import type { Building } from '~/types/buildings'
import type { ApiSuccess } from '~/types/api'
import { isUuid, slugifyName } from '~/utils/format/slug'

definePageMeta({ title: 'Kỳ vận hành' })

const route = useRoute()
const buildingParam = String(route.params.building ?? '')
const periodToken = String(route.params.period ?? '')
const [yearStr, monthStr] = periodToken.split('-')
const periodYear = Number(yearStr)
const periodMonth = Number(monthStr)

if (!buildingParam || !Number.isFinite(periodYear) || !Number.isFinite(periodMonth) || periodMonth < 1 || periodMonth > 12) {
  throw createError({ statusCode: 404, statusMessage: 'Kỳ vận hành không hợp lệ' })
}

const buildingId = ref<string>('')
const periodId = ref<string>('')
const resolveError = ref<string | null>(null)
const resolving = ref(true)

async function resolveBuildingId(): Promise<string> {
  if (isUuid(buildingParam)) return buildingParam
  const resp = await $fetch<ApiSuccess<Building[]>>('/api/buildings', { query: { limit: 200 } })
  const match = resp.data.find(b => slugifyName(b.name) === buildingParam)
  if (!match) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy tòa nhà' })
  return match.id
}

async function resolvePeriod() {
  resolving.value = true
  resolveError.value = null
  try {
    buildingId.value = await resolveBuildingId()
    const resp = await $fetch<{ data: { id: string } }>('/api/billing/periods', {
      method: 'POST',
      body: { building_id: buildingId.value, period_year: periodYear, period_month: periodMonth },
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
  unissue,
  exportXlsx,
  saveReadings,
  saveUtilityOverride,
} = workspace

if (periodId.value) await loadOverview()

const auth = useAuthStore()
const canClose = computed(() => auth.isAdmin)
const canUnissue = computed(() => auth.isAdmin)
const toast = useToast()
const initialStatus = period.value?.status
const tab = ref<string>(
  initialStatus === 'issued' || initialStatus === 'collecting' || initialStatus === 'closed'
    ? 'payments'
    : 'draft-grid',
)
const auditOpen = ref(false)
const closeOpen = ref(false)
const unissueOpen = ref(false)
const unissueSubmitting = ref(false)
const unissueError = ref<string | null>(null)
const exportLoading = ref(false)
const actionMenuOpen = ref(false)
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
}, { immediate: true })

watch(auditOpen, async (open) => {
  if (open && auditEvents.value.length === 0) await loadAudit()
})

watch(closeOpen, async (open) => {
  if (open && !drafts.value) await loadDrafts()
})

watch(unissueOpen, async (open) => {
  if (open && invoices.value.length === 0) await loadInvoices()
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

async function unissuePeriodFromModal(reason: string) {
  unissueSubmitting.value = true
  unissueError.value = null
  try {
    const result = await unissue(reason)
    toast.success(`Đã huỷ phát hành ${result.voided} hoá đơn — giữ lại ${result.retained} đã thu`)
    unissueOpen.value = false
  }
  catch (err) {
    const e = err as { data?: { error?: { message?: string } }; message?: string }
    unissueError.value = e.data?.error?.message ?? e.message ?? 'Huỷ phát hành thất bại'
    toast.error(unissueError.value)
  }
  finally {
    unissueSubmitting.value = false
  }
}

async function exportPeriodXlsx() {
  exportLoading.value = true
  try {
    const { blob, fileName } = await exportXlsx()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Đã xuất file Excel')
  }
  catch (err) {
    const e = err as { data?: { error?: { message?: string } }; message?: string }
    toast.error(e.data?.error?.message ?? e.message ?? 'Xuất Excel thất bại')
  }
  finally {
    exportLoading.value = false
  }
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
          <div class="relative">
            <UiButton
              variant="ghost"
              size="sm"
              icon-only
              aria-label="Thêm hành động"
              @click="actionMenuOpen = !actionMenuOpen"
            >
              ...
            </UiButton>
            <template v-if="actionMenuOpen">
              <div
                class="fixed inset-0 z-30"
                aria-hidden="true"
                @click="actionMenuOpen = false"
              />
              <div
                class="absolute right-0 z-40 mt-2 w-56 rounded-lg border border-dark-border bg-dark-card py-1 shadow-lg shadow-black/40"
              >
                <UiButton
                  variant="ghost"
                  size="sm"
                  class="!flex !w-full !justify-start !rounded-none !px-3 !py-2 text-left !text-white hover:!bg-dark-surface"
                  @click="actionMenuOpen = false; auditOpen = true"
                >
                  Nhật ký
                </UiButton>
                <UiButton
                  variant="ghost"
                  size="sm"
                  class="!flex !w-full !justify-start !rounded-none !px-3 !py-2 text-left !text-white hover:!bg-dark-surface"
                  :disabled="exportLoading"
                  @click="actionMenuOpen = false; exportPeriodXlsx()"
                >
                  {{ exportLoading ? 'Đang xuất…' : 'Xuất Excel' }}
                </UiButton>
                <div class="my-1 h-px bg-dark-border" />
                <UiButton
                  variant="ghost"
                  size="sm"
                  class="!flex !w-full !justify-start !rounded-none !px-3 !py-2 text-left !text-white hover:!bg-dark-surface"
                  :disabled="!canClose || period?.status === 'closed'"
                  @click="actionMenuOpen = false; closeOpen = true"
                >
                  Chốt kỳ
                </UiButton>
                <UiButton
                  variant="ghost"
                  size="sm"
                  class="!flex !w-full !justify-start !rounded-none !px-3 !py-2 text-left !text-rose-400 hover:!bg-dark-surface"
                  :disabled="!canUnissue || period?.status === 'closed' || period?.status === 'draft'"
                  :title="period?.status === 'closed' ? 'Kỳ đã chốt nên không thể huỷ phát hành' : (!canUnissue ? 'Bạn không có quyền huỷ phát hành kỳ' : undefined)"
                  @click="actionMenuOpen = false; unissueOpen = true"
                >
                  Huỷ phát hành kỳ
                </UiButton>
              </div>
            </template>
          </div>
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

      <BillingUnissueModal
        :open="unissueOpen"
        :invoices="invoices"
        :submitting="unissueSubmitting"
        :error-message="unissueError"
        @close="unissueOpen = false"
        @submit="unissuePeriodFromModal"
      />
    </template>
  </div>
</template>
