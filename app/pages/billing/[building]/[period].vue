<script setup lang="ts">
import type { UiTabItem } from '~/components/ui/UiTabs.vue'
import BillingKpiStrip from '~/components/billing/BillingKpiStrip.vue'
import BillingDraftGridStep from '~/components/billing/BillingDraftGridStep.vue'
import BillingPaymentsStep from '~/components/billing/BillingPaymentsStep.vue'
import type { BillingPaymentsIntent } from '~/components/billing/BillingPaymentsStep.vue'
import BillingAuditDrawer from '~/components/billing/BillingAuditDrawer.vue'
import BillingCloseStep from '~/components/billing/BillingCloseStep.vue'
import BillingUnissueModal from '~/components/billing/BillingUnissueModal.vue'
import type { BillingPeriod } from '~/types/billing'
import { getApiErrorCode, getApiErrorMessage, type ApiErrorLike } from '~/utils/api-error'

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

const periodId = ref<string>('')
const resolvedPeriod = ref<BillingPeriod | null>(null)
const resolveError = ref<string | null>(null)
const resolving = ref(true)
const toast = useToast()

async function resolvePeriod() {
  resolving.value = true
  resolveError.value = null
  try {
    const resp = await apiFetch<{ data: BillingPeriod }>('/api/billing/periods', {
      method: 'POST',
      body: { building_id: buildingParam, period_year: periodYear, period_month: periodMonth },
    })
    periodId.value = resp.data.id
    resolvedPeriod.value = resp.data
  }
  catch (err) {
    const e = err as ApiErrorLike & { status?: number }
    const isForbidden = e.status === 403 || e.statusCode === 403 || getApiErrorCode(err) === 'FORBIDDEN'
    if (route.query.invoice && isForbidden) {
      toast.info(getApiErrorMessage(err, 'Không có quyền truy cập kỳ vận hành này'))
      await navigateTo('/invoices')
      return
    }
    resolveError.value = getApiErrorMessage(err, 'Không thể mở kỳ vận hành')
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
  unapprovedOverrides,
  overviewLoading,
  gridLoading,
  invoicesLoading,
  loadOverview,
  loadDrafts,
  loadGrid,
  loadInvoices,
  loadUtilityUsages,
  issue,
  issueAndPay,
  undoPayment,
  close,
  reopen,
  unissue,
  exportXlsx,
  saveReadings,
  saveUtilityOverride,
  deleteUtilityOverride,
  approveUtilityOverride,
} = workspace

period.value = resolvedPeriod.value

const { count: recentAuditCount, load: loadRecentAuditCount } = useRecentAuditCount(periodId)

if (periodId.value) {
  void loadRecentAuditCount()
}

const auth = useAuthStore()
const canClose = computed(() => auth.can('billing.close'))
const canReopen = computed(() => auth.can('billing.reopen'))
const canUnissue = computed(() => auth.can('billing.unissue'))
const initialStatus = period.value?.status
const tab = ref<string>(
  initialStatus === 'issued' || initialStatus === 'collecting' || initialStatus === 'closed'
    ? 'payments'
    : 'draft-grid',
)
const auditOpen = ref(false)
const closeOpen = ref(false)
const reopenOpen = ref(false)
const reopenReason = ref('')
const reopenSubmitting = ref(false)
const reopenError = ref<string | null>(null)
const unissueOpen = ref(false)
const unissueSubmitting = ref(false)
const unissueError = ref<string | null>(null)
const exportLoading = ref(false)
const actionMenuOpen = ref(false)
const paymentsIntent = ref<BillingPaymentsIntent | null>(null)
let paymentsIntentId = 0
const handledInvoiceQuery = ref<string | null>(null)

const tabs = computed<UiTabItem[]>(() => {
  const status = period.value?.status
  const closed = status === 'closed'
  return [
    {
      key: 'draft-grid',
      label: 'Soạn kỳ',
      count: grid.value?.totals.blockedDraftCount || undefined,
      reason: closed ? 'Kỳ đã chốt' : undefined,
    },
    { key: 'payments', label: 'Thu tiền & công nợ' },
  ]
})

watch(tab, async (current) => {
  if (current === 'draft-grid') {
    const tasks: Promise<unknown>[] = []
    if (!grid.value) tasks.push(loadGrid())
    if (utilityUsages.value.length === 0) tasks.push(loadUtilityUsages())
    if (tasks.length > 0) await Promise.all(tasks)
  }
  if (current === 'payments') {
    const tasks: Promise<unknown>[] = []
    if (!overview.value) tasks.push(loadOverview())
    if (invoices.value.length === 0) tasks.push(loadInvoices())
    // Drafts power the reissue preview. Refresh so the modal reflects the
    // latest readings/overrides, not whatever was loaded earlier.
    tasks.push(loadDrafts())
    await Promise.all(tasks)
  }
}, { immediate: true })

watch(closeOpen, async (open) => {
  if (open && !drafts.value) await loadDrafts()
})

watch(unissueOpen, async (open) => {
  if (open && invoices.value.length === 0) await loadInvoices()
})

watch(reopenOpen, (open) => {
  if (!open) {
    reopenReason.value = ''
    reopenError.value = null
  }
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
    toast.error(getApiErrorMessage(err, 'Chốt kỳ thất bại'))
    throw err
  }
}

async function reopenPeriodFromModal() {
  reopenSubmitting.value = true
  reopenError.value = null
  try {
    await reopen(reopenReason.value)
    toast.success('Đã mở lại kỳ vận hành')
    reopenOpen.value = false
  }
  catch (err) {
    reopenError.value = getApiErrorMessage(err, 'Mở lại kỳ thất bại')
    toast.error(reopenError.value)
  }
  finally {
    reopenSubmitting.value = false
  }
}

async function saveReadingsWithToast(
  readings: Parameters<typeof saveReadings>[0],
  options?: Parameters<typeof saveReadings>[1],
) {
  try {
    const result = await saveReadings(readings, options)
    if (!options?.silent) {
    toast.success(`Đã lưu ${result.length} chỉ số`)
    }
    if (options?.refreshDrafts ?? options?.refresh ?? true) await loadDrafts()
  }
  catch (err) {
    toast.error(getApiErrorMessage(err, 'Lưu chỉ số thất bại'))
    throw err
  }
}

async function saveUtilityOverrideWithToast(input: Parameters<typeof saveUtilityOverride>[0]) {
  try {
    await saveUtilityOverride(input)
    toast.success('Đã lưu ghi đè chỉ số')
  }
  catch (err) {
    toast.error(getApiErrorMessage(err, 'Lưu ghi đè thất bại'))
    throw err
  }
}

async function deleteUtilityOverrideWithToast(overrideId: string) {
  try {
    await deleteUtilityOverride(overrideId)
    toast.success('Đã xóa điều chỉnh chỉ số')
  }
  catch (err) {
    toast.error(getApiErrorMessage(err, 'Xóa điều chỉnh thất bại'))
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
    toast.error(getApiErrorMessage(err, 'Phát hành thất bại'))
    throw err
  }
}

async function issueAndPayWithToast(input: Parameters<typeof issueAndPay>[0]) {
  try {
    const invoice = await issueAndPay(input)
    toast.success('Đã phát hành & thu đủ')
    return invoice
  }
  catch (err) {
    toast.error(getApiErrorMessage(err, 'Phát hành & thu thất bại'))
    throw err
  }
}

async function reloadAfterInvoiceChange() {
  await Promise.all([loadInvoices(), loadOverview(), loadDrafts(), loadGrid()])
}

async function undoPaymentWithToast(invoiceId: string, paymentId: string, reason?: string) {
  try {
    const invoice = await undoPayment(invoiceId, paymentId, reason)
    toast.success('Đã hoàn tác thanh toán')
    return invoice
  }
  catch (err) {
    toast.error(getApiErrorMessage(err, 'Hoàn tác thanh toán thất bại'))
    throw err
  }
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
    unissueError.value = getApiErrorMessage(err, 'Huỷ phát hành thất bại')
    toast.error(unissueError.value)
  }
  finally {
    unissueSubmitting.value = false
  }
}

async function exportPeriodXlsx() {
  exportLoading.value = true
  try {
    await exportXlsx()
    toast.success('Đã xuất file Excel')
  }
  catch (err) {
    toast.error(getApiErrorMessage(err, 'Xuất Excel thất bại'))
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

async function focusInvoiceFromQuery(invoiceId: string) {
  if (!invoiceId || handledInvoiceQuery.value === invoiceId) return
  tab.value = 'payments'
  if (invoices.value.length === 0) await loadInvoices()
  const invoice = invoices.value.find(item => item.id === invoiceId || item.invoiceCode === invoiceId)
  if (!invoice) {
    toast.info('Không tìm thấy hoá đơn trong kỳ này')
    handledInvoiceQuery.value = invoiceId
    return
  }
  paymentsIntent.value = {
    id: ++paymentsIntentId,
    type: 'focus',
    invoiceId: invoice.id,
  }
  handledInvoiceQuery.value = invoiceId
}

watch(
  () => route.query.invoice,
  async (value) => {
    const invoiceId = typeof value === 'string' ? value : ''
    if (invoiceId) await focusInvoiceFromQuery(invoiceId)
  },
  { immediate: true },
)

function openPrintWindow(payload: { keys: string[] }) {
  if (payload.keys.length === 0) return
  const url = `/billing/print/${buildingParam}/${periodToken}?keys=${encodeURIComponent(payload.keys.join(','))}`
  window.open(url, '_blank', 'noopener')
}
</script>

<template>
  <div class="space-y-5">
    <UiAlert v-if="resolveError" severity="danger">{{ resolveError }}</UiAlert>

    <template v-if="!resolveError">
      <UiPageHeader
        :title="`Kỳ ${periodLabel()} - ${overview?.buildingName ?? 'Đang tải...'}`"
        :back-to="'/billing'"
        back-label="Danh sách kỳ"
      >
        <template #actions>
          <UiButton
            v-if="period?.status === 'issued' || period?.status === 'collecting'"
            variant="primary"
            size="sm"
            :disabled="!canClose || (overview?.outstandingBalance ?? 0) > 0"
            :title="(overview?.outstandingBalance ?? 0) > 0
              ? 'Còn công nợ chưa thu — không thể chốt kỳ'
              : (!canClose ? 'Bạn không có quyền chốt kỳ' : undefined)"
            @click="closeOpen = true"
          >
            <IconCheckCircle class="h-4 w-4" aria-hidden="true" />
            <span>Chốt kỳ</span>
          </UiButton>
          <div class="relative">
            <UiButton
              variant="ghost"
              size="sm"
              @click="actionMenuOpen = !actionMenuOpen"
            >
              <span>Hành động</span>
              <IconChevronDown class="h-4 w-4 -mr-1" aria-hidden="true" />
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
                  <IconDocument class="h-4 w-4" aria-hidden="true" />
                  <span>Nhật ký</span>
                  <span
                    v-if="recentAuditCount > 0"
                    class="ml-auto rounded-full bg-cyan/20 px-1.5 py-0.5 text-xs font-medium text-cyan tabular-nums"
                  >
                    {{ recentAuditCount }}
                  </span>
                </UiButton>
                <UiButton
                  variant="ghost"
                  size="sm"
                  class="!flex !w-full !justify-start !rounded-none !px-3 !py-2 text-left !text-white hover:!bg-dark-surface"
                  :disabled="exportLoading"
                  @click="actionMenuOpen = false; exportPeriodXlsx()"
                >
                  <IconDownload class="h-4 w-4" aria-hidden="true" />
                  <span>{{ exportLoading ? 'Đang xuất…' : 'Xuất Excel' }}</span>
                </UiButton>
                <div class="my-1 h-px bg-dark-border" />
                <UiButton
                  variant="ghost"
                  size="sm"
                  class="!flex !w-full !justify-start !rounded-none !px-3 !py-2 text-left !text-white hover:!bg-dark-surface"
                  :disabled="!canClose || period?.status === 'closed'"
                  @click="actionMenuOpen = false; closeOpen = true"
                >
                  <IconCheckCircle class="h-4 w-4" aria-hidden="true" />
                  <span>Chốt kỳ</span>
                </UiButton>
                <UiButton
                  variant="ghost"
                  size="sm"
                  class="!flex !w-full !justify-start !rounded-none !px-3 !py-2 text-left !text-white hover:!bg-dark-surface"
                  :disabled="!canReopen || period?.status !== 'closed'"
                  :title="period?.status !== 'closed' ? 'Chỉ mở lại khi kỳ đã chốt' : (!canReopen ? 'Bạn không có quyền mở lại kỳ' : undefined)"
                  @click="actionMenuOpen = false; reopenOpen = true"
                >
                  <IconRefresh class="h-4 w-4" aria-hidden="true" />
                  <span>Mở lại kỳ</span>
                </UiButton>
                <UiButton
                  variant="ghost"
                  size="sm"
                  class="!flex !w-full !justify-start !rounded-none !px-3 !py-2 text-left !text-rose-400 hover:!bg-dark-surface"
                  :disabled="!canUnissue || period?.status === 'closed' || period?.status === 'draft'"
                  :title="period?.status === 'closed' ? 'Kỳ đã chốt nên không thể huỷ phát hành' : (!canUnissue ? 'Bạn không có quyền huỷ phát hành kỳ' : undefined)"
                  @click="actionMenuOpen = false; unissueOpen = true"
                >
                  <IconXCircle class="h-4 w-4" aria-hidden="true" />
                  <span>Huỷ phát hành kỳ</span>
                </UiButton>
              </div>
            </template>
          </div>
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
          :unapproved-overrides="unapprovedOverrides"
          :on-save-readings="saveReadingsWithToast"
          :on-save-override="saveUtilityOverrideWithToast"
          :on-delete-override="deleteUtilityOverrideWithToast"
          :on-approve-override="approveUtilityOverride"
          :on-issue="issueWithToast"
          :on-auto-issue="issueAndPayWithToast"
          @refresh="async () => { await loadGrid(); await loadOverview() }"
          @intent:void-reissue="openPaymentsIntent({ type: 'void-reissue', ...$event })"
          @intent:print="openPrintWindow"
        />

        <BillingPaymentsStep
          v-else-if="tab === 'payments'"
          :period="period"
          :invoices="invoices"
          :loading="invoicesLoading"
          :intent="paymentsIntent"
          :drafts="drafts"
          :on-undo-payment="undoPaymentWithToast"
          @reload="reloadAfterInvoiceChange"
        />
      </template>

      <BillingAuditDrawer
        v-model:open="auditOpen"
        :period-id="periodId"
        :period-label="`${String(periodMonth).padStart(2, '0')}-${periodYear}`"
      />

      <UiModal :open="closeOpen" title="Chốt kỳ vận hành" size="lg" @close="closeOpen = false">
        <BillingCloseStep
          v-if="overview && period"
          :overview="overview"
          :period="period"
          :can-close="canClose"
          :on-close-period="closePeriodFromModal"
        />
      </UiModal>

      <UiModal :open="reopenOpen" title="Mở lại kỳ vận hành" size="sm" @close="reopenOpen = false">
        <div class="space-y-3">
          <p class="text-sm text-muted">
            Kỳ sẽ chuyển từ trạng thái chốt về đang thu để bạn có thể chỉnh sửa nghiệp vụ liên quan.
          </p>
          <UiTextarea
            v-model="reopenReason"
            label="Lý do mở lại"
            :rows="3"
            placeholder="Nhập tối thiểu 10 ký tự"
          />
          <p class="text-xs text-muted text-right">
            {{ reopenReason.trim().length }}/10 ký tự tối thiểu
          </p>
          <UiAlert v-if="reopenError" severity="danger">{{ reopenError }}</UiAlert>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UiButton variant="secondary" :disabled="reopenSubmitting" @click="reopenOpen = false">
              Đóng
            </UiButton>
            <UiButton
              variant="primary"
              :loading="reopenSubmitting"
              :disabled="reopenReason.trim().length < 10"
              @click="reopenPeriodFromModal"
            >
              Mở lại kỳ
            </UiButton>
          </div>
        </template>
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
