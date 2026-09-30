<script setup lang="ts">
import InvoicePaymentProfileCard from '~/components/invoices/InvoicePaymentProfileCard.vue'
import type { UiTableColumn } from '~/components/ui/UiTable.vue'
import type { BillingDraftResponse, BillingPeriod, Invoice, InvoicePayment, InvoiceWithCharges } from '~/types/billing'
import type { BulkPaymentItemInput, VoidInvoiceInput } from '~/utils/validators/billing'
import { formatCurrency } from '~/utils/format/currency'
import { invoicePath, invoiceRouteSegment } from '~/utils/routes/operational'
import { isPeriodLocked } from '~/utils/billing/lock'
import { getApiErrorDetails, getApiErrorMessage } from '~/utils/api-error'

export interface BillingPaymentsIntent {
  id: number
  type: 'void-reissue' | 'focus'
  invoiceId: string
}

const props = defineProps<{
  period: BillingPeriod
  invoices: Invoice[]
  loading: boolean
  intent?: BillingPaymentsIntent | null
  drafts?: BillingDraftResponse | null
  onUndoPayment?: (invoiceId: string, paymentId: string, reason?: string) => Promise<Invoice | undefined>
}>()

const emit = defineEmits<{ reload: [] }>()

const { load, recordPayment, recordBulkPayments, voidInvoice, listPayments, refreshProfileSnapshot } = useBillingInvoiceActions()
const { openPrint } = useInvoicePrinting()
const toast = useToast()
const {
  sending: sendingInvoiceEmail,
  error: invoiceEmailError,
  enqueue: enqueueInvoiceEmail,
} = useInvoiceEmailDelivery()
const invoiceEmailEnabled = useRuntimeConfig().public.invoiceEmailEnabled === true

const periodIsClosed = computed(() => isPeriodLocked(props.period))
const canUndoPayment = computed(() => !!props.onUndoPayment && !periodIsClosed.value)

const filterStatus = ref<'all' | 'paid' | 'partial' | 'unpaid' | 'overdue'>('all')
const filterOptions = [
  { value: 'all', label: 'Tất cả' },
  { value: 'unpaid', label: 'Chưa thu' },
  { value: 'paid', label: 'Đã thu' },
  { value: 'overdue', label: 'Quá hạn' },
]

// UiFilterChips is multi-select; the mobile filter row keeps single-select
// behavior by only accepting the newly toggled-on value.
function onFilterChipChange(next: string[]) {
  const picked = next.find(value => value !== filterStatus.value)
  if (picked) filterStatus.value = picked as typeof filterStatus.value
}

const today = new Date().toISOString().slice(0, 10)
function deriveBucket(inv: Invoice): 'paid' | 'partial' | 'unpaid' | 'overdue' | 'void' {
  if (inv.status === 'void') return 'void'
  if (inv.status === 'paid') return 'paid'
  if (inv.paidAmount > 0 && inv.balanceAmount > 0) return 'partial'
  if (inv.overdueDate && inv.overdueDate < today && inv.balanceAmount > 0) return 'overdue'
  return 'unpaid'
}

const activeInvoices = computed(() => props.invoices.filter(i => i.status !== 'void'))
const voidedInvoices = computed(() =>
  props.invoices
    .filter(i => i.status === 'void')
    .slice()
    .sort((a, b) => (b.voidedAt ?? '').localeCompare(a.voidedAt ?? '')),
)
const replacementById = computed(() => {
  const byId = new Map(props.invoices.map(i => [i.id, i]))
  return byId
})

const filteredInvoices = computed(() => {
  if (filterStatus.value === 'all') return activeInvoices.value
  return activeInvoices.value.filter(i => deriveBucket(i) === filterStatus.value)
})

function invoiceDisplay(row: Invoice): { title: string; subtitle: string } {
  const title = [row.tenantName, row.roomNumber ? `P.${row.roomNumber}` : null].filter(Boolean).join(' · ')
  return {
    title: title || row.contractCode || row.contractId,
    subtitle: row.invoiceCode || row.contractCode || row.contractId,
  }
}

const summary = computed(() => {
  const issuedTotal = props.invoices.filter(i => i.status !== 'void')
    .reduce((s, i) => s + i.totalAmount, 0)
  const paidTotal = props.invoices.reduce((s, i) => s + i.paidAmount, 0)
  const outstanding = issuedTotal - paidTotal
  const overdueCount = props.invoices.filter(i => deriveBucket(i) === 'overdue').length
  return { issuedTotal, paidTotal, outstanding, overdueCount }
})

// Mobile card list renders its own action row instead of the table's actions column.
function rowHasActions(row: Invoice): boolean {
  return (!periodIsClosed.value && row.status === 'paid' && !!props.onUndoPayment)
    || row.status === 'issued' || row.status === 'partial' || row.status === 'overdue'
}

const columns: UiTableColumn<Invoice>[] = [
  { key: 'select', label: '', width: 'w-10' },
  { key: 'tenant', label: 'Hợp đồng' },
  { key: 'status', label: 'Trạng thái', width: 'w-32' },
  { key: 'totalAmount', label: 'Tổng tiền', numeric: true, hideOnMobile: true, width: 'w-28' },
  { key: 'paidAmount', label: 'Đã thu', numeric: true, hideOnMobile: true, width: 'w-28' },
  { key: 'balanceAmount', label: 'Còn lại', numeric: true, width: 'w-28' },
  { key: 'dueDate', label: 'Hạn', hideOnMobile: true, width: 'w-20' },
  { key: 'actions', label: '', action: true, width: 'w-36' },
]

const voidedColumns: UiTableColumn<Invoice>[] = [
  { key: 'contract', label: 'Hợp đồng' },
  { key: 'totalAmount', label: 'Tổng tại thời điểm huỷ', numeric: true, hideOnMobile: true, width: 'w-32' },
  { key: 'voidedAt', label: 'Huỷ lúc', hideOnMobile: true, width: 'w-32' },
  { key: 'voidReason', label: 'Lý do' },
  { key: 'replacement', label: 'Thay thế bằng', width: 'w-44' },
]

// ---------- Bulk selection ----------
const selectedIds = ref<Set<string>>(new Set())
const invoiceRefs = new Map<string, HTMLElement>()
const highlightedInvoiceId = ref<string | null>(null)
let highlightTimer: ReturnType<typeof setTimeout> | null = null

function setInvoiceRef(id: string, el: unknown) {
  const maybeComponent = el as { $el?: unknown; el?: unknown } | null
  const element = el instanceof HTMLElement
    ? el
    : maybeComponent?.$el instanceof HTMLElement
      ? maybeComponent.$el
      : maybeComponent?.el instanceof HTMLElement
        ? maybeComponent.el
        : null
  if (element) invoiceRefs.set(id, element)
  else invoiceRefs.delete(id)
}

async function focusInvoice(invoiceId: string) {
  filterStatus.value = 'all'
  await nextTick()
  const el = invoiceRefs.get(invoiceId)
  if (!el) {
    toast.error('Không tìm thấy hoá đơn để highlight')
    return
  }
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  highlightedInvoiceId.value = invoiceId
  if (highlightTimer) clearTimeout(highlightTimer)
  highlightTimer = setTimeout(() => {
    highlightedInvoiceId.value = null
    highlightTimer = null
  }, 2000)
}

function isSelectableForBulkPayment(inv: Invoice): boolean {
  if (periodIsClosed.value) return false
  if (inv.status === 'void' || inv.status === 'paid') return false
  return inv.balanceAmount > 0
}

const printableCandidates = computed(() => filteredInvoices.value.filter(inv => inv.status !== 'void'))

const allVisibleSelected = computed(() =>
  printableCandidates.value.length > 0 && printableCandidates.value.every(inv => selectedIds.value.has(inv.id)),
)

function toggleSelect(invoice: Invoice) {
  if (invoice.status === 'void') return
  const invoiceId = invoice.id
  if (selectedIds.value.has(invoiceId)) selectedIds.value.delete(invoiceId)
  else selectedIds.value.add(invoiceId)
  selectedIds.value = new Set(selectedIds.value)
}

function toggleSelectAll() {
  if (allVisibleSelected.value) {
    for (const inv of printableCandidates.value) selectedIds.value.delete(inv.id)
  }
  else {
    for (const inv of printableCandidates.value) selectedIds.value.add(inv.id)
  }
  selectedIds.value = new Set(selectedIds.value)
}

function clearSelection() {
  selectedIds.value = new Set()
}

const selectedInvoicesForBulk = computed<Invoice[]>(() =>
  Array.from(selectedIds.value)
    .map(id => activeInvoices.value.find(inv => inv.id === id))
    .filter((inv): inv is Invoice => !!inv),
)

const bulkPaymentSelectionEligible = computed(() =>
  selectedInvoicesForBulk.value.length > 0
  && selectedInvoicesForBulk.value.every(isSelectableForBulkPayment),
)

const bulkPaymentDisabledReason = computed(() => {
  if (periodIsClosed.value) return 'Kỳ đã chốt nên không thể ghi thu'
  if (!bulkPaymentSelectionEligible.value) return 'Chỉ ghi thu hàng loạt khi lựa chọn chỉ gồm hóa đơn còn nợ'
  return undefined
})

function printSelection() {
  openPrint(selectedInvoicesForBulk.value.map(invoice => invoice.id))
}

const showEmailModal = ref(false)
const bulkEmailSummary = ref<string | null>(null)

async function sendEmailSelection() {
  if (
    selectedInvoicesForBulk.value.length === 0
    || selectedInvoicesForBulk.value.length > 100
  ) return
  try {
    const result = await enqueueInvoiceEmail(
      selectedInvoicesForBulk.value.map(invoice => invoice.id),
    )
    const counts = result.results.reduce((summary, item) => {
      summary[item.status] += 1
      return summary
    }, { queued: 0, already_queued: 0, skipped: 0, failed: 0 })
    bulkEmailSummary.value = [
      `Đã xếp hàng ${counts.queued}`,
      counts.already_queued ? `đã có trong hàng ${counts.already_queued}` : null,
      counts.skipped ? `bỏ qua ${counts.skipped}` : null,
      counts.failed ? `không thành công ${counts.failed}` : null,
    ].filter(Boolean).join(' · ')
    showEmailModal.value = false
    clearSelection()
    toast.success('Đã xử lý danh sách gửi email.')
  }
  catch {
    // Keep the modal open and show the standardized error.
  }
}

// ---------- Bulk modal ----------
const showBulkModal = ref(false)
const bulkSubmitting = ref(false)
const bulkError = ref<string | null>(null)
const bulkFailedInvoiceId = ref<string | null>(null)

function openBulkModal() {
  if (!bulkPaymentSelectionEligible.value) return
  bulkError.value = null
  bulkFailedInvoiceId.value = null
  showBulkModal.value = true
}

function closeBulkModal() {
  if (bulkSubmitting.value) return
  showBulkModal.value = false
}

async function submitBulkPayments(payload: BulkPaymentItemInput[]) {
  bulkSubmitting.value = true
  bulkError.value = null
  bulkFailedInvoiceId.value = null
  try {
    const result = await recordBulkPayments(payload)
    toast.success(`Đã ghi thu ${result.count} khoản, tổng ${formatCurrency(result.totalAmount)}`)
    showBulkModal.value = false
    clearSelection()
    emit('reload')
  }
  catch (err) {
    const failedIndex = getApiErrorDetails<{ failed_index?: number }>(err)?.failed_index
    if (typeof failedIndex === 'number' && payload[failedIndex]) {
      bulkFailedInvoiceId.value = payload[failedIndex].invoice_id
    }
    bulkError.value = getApiErrorMessage(err, 'Ghi thu hàng loạt thất bại')
    toast.error(bulkError.value)
  }
  finally {
    bulkSubmitting.value = false
  }
}

// ---------- Detail panel ----------
const selectedInvoice = ref<InvoiceWithCharges | null>(null)
const detailLoading = ref(false)
const detailError = ref<string | null>(null)

async function openDetail(inv: Invoice) {
  detailLoading.value = true
  detailError.value = null
  try {
    selectedInvoice.value = await load(invoiceRouteSegment(inv))
  } catch (err) {
    detailError.value = getApiErrorMessage(err, 'Không thể tải hoá đơn')
  } finally {
    detailLoading.value = false
  }
}

function closeDetail() {
  selectedInvoice.value = null
  detailError.value = null
}

const profileRefreshing = ref(false)

async function refreshSnapshot() {
  if (!selectedInvoice.value) return
  profileRefreshing.value = true
  try {
    selectedInvoice.value = await refreshProfileSnapshot(invoiceRouteSegment(selectedInvoice.value.invoice))
    toast.success('Đã đồng bộ thông tin thanh toán')
  }
  catch (err) {
    toast.error(getApiErrorMessage(err, 'Không thể đồng bộ thông tin thanh toán'))
  }
  finally {
    profileRefreshing.value = false
  }
}

// ---------- Record payment ----------
const showPaymentModal = ref(false)
const paymentForm = reactive({
  amount: 0,
  paid_at: today,
  payment_method: 'cash',
  note: '',
})
const paymentSubmitting = ref(false)
const paymentError = ref<string | null>(null)

function startPayment(inv: Invoice) {
  paymentForm.amount = inv.balanceAmount
  paymentForm.paid_at = today
  paymentForm.payment_method = 'cash'
  paymentForm.note = ''
  paymentError.value = null
  selectedInvoice.value = {
    invoice: inv,
    charges: [],
    payments: [],
    invoiceProfile: null,
    recipientEmail: null,
  }
  showPaymentModal.value = true
}

async function submitPayment() {
  if (!selectedInvoice.value) return
  const balance = selectedInvoice.value.invoice.balanceAmount
  if (paymentForm.amount !== balance) {
    paymentError.value = `Phải thu đủ số còn lại (${formatCurrency(balance)}) — không hỗ trợ thu một phần`
    return
  }
  paymentSubmitting.value = true
  paymentError.value = null
  try {
    await recordPayment(invoiceRouteSegment(selectedInvoice.value.invoice), {
      amount: paymentForm.amount,
      paid_at: paymentForm.paid_at,
      payment_method: paymentForm.payment_method.trim() || null,
      note: paymentForm.note.trim() || null,
    })
    toast.success(`Đã ghi ${formatCurrency(paymentForm.amount)}`)
    showPaymentModal.value = false
    emit('reload')
  } catch (err) {
    paymentError.value = getApiErrorMessage(err, 'Ghi nhận thất bại')
    toast.error(paymentError.value)
  } finally {
    paymentSubmitting.value = false
  }
}

// ---------- Void invoice ----------
const showVoidModal = ref(false)
const voidForm = reactive<VoidInvoiceInput>({ reason: '', expected_updated_at: '' })
const voidSubmitting = ref(false)
const voidError = ref<string | null>(null)
const voidTarget = ref<Invoice | null>(null)
const showReissueHintAfterVoid = ref(false)

function startVoid(inv: Invoice, options?: { reason?: string; showReissueHint?: boolean }) {
  voidTarget.value = inv
  voidForm.reason = options?.reason ?? ''
  voidForm.expected_updated_at = inv.updatedAt
  voidError.value = null
  showReissueHintAfterVoid.value = !!options?.showReissueHint
  showVoidModal.value = true
}

async function submitVoid() {
  if (!voidTarget.value) return
  if (!voidForm.reason.trim()) {
    voidError.value = 'Cần nhập lý do huỷ'
    return
  }
  voidSubmitting.value = true
  voidError.value = null
  try {
    await voidInvoice(invoiceRouteSegment(voidTarget.value), { ...voidForm })
    toast.success('Đã huỷ hoá đơn')
    if (showReissueHintAfterVoid.value) {
      toast.info('Vào tab Soạn kỳ để phát hành lại')
    }
    showVoidModal.value = false
    showReissueHintAfterVoid.value = false
    emit('reload')
  } catch (err) {
    voidError.value = getApiErrorMessage(err, 'Huỷ hoá đơn thất bại')
    toast.error(voidError.value)
  } finally {
    voidSubmitting.value = false
  }
}

// ---------- Payment history (in detail panel) ----------
const detailPayments = ref<InvoicePayment[]>([])
async function refreshPayments(invoiceId: string) {
  detailPayments.value = await listPayments(invoiceId)
}

// ---------- Undo payment ----------
const undoTarget = ref<{ invoiceId: string; payment: InvoicePayment } | null>(null)
const undoSubmitting = ref(false)

function startUndoPayment(invoiceId: string, payment: InvoicePayment) {
  if (periodIsClosed.value) return
  undoTarget.value = { invoiceId, payment }
}

async function startUndoFromRow(invoice: Invoice) {
  if (!props.onUndoPayment || periodIsClosed.value) return
  try {
    const payments = await listPayments(invoiceRouteSegment(invoice))
    const latestPayment = payments[0]
    if (!latestPayment) {
      toast.error('Không tìm thấy khoản thu để hoàn tác')
      return
    }
    startUndoPayment(invoice.id, latestPayment)
  }
  catch (err) {
    toast.error(getApiErrorMessage(err, 'Không tải được lịch sử thanh toán'))
  }
}

async function confirmUndoPayment() {
  if (!props.onUndoPayment || !undoTarget.value) return
  undoSubmitting.value = true
  try {
    const result = await props.onUndoPayment(
      undoTarget.value.invoiceId,
      undoTarget.value.payment.id,
    )
    if (result) {
      undoTarget.value = null
      if (selectedInvoice.value?.invoice.id === result.id) {
        selectedInvoice.value = { ...selectedInvoice.value, invoice: result }
        await refreshPayments(invoiceRouteSegment(result))
      }
      emit('reload')
    }
  }
  catch {
    // Page-level wrapper already shows API error feedback.
  }
  finally {
    undoSubmitting.value = false
  }
}

watch(selectedInvoice, async (next) => {
  if (next?.invoice.id && !showPaymentModal.value) {
    await refreshPayments(invoiceRouteSegment(next.invoice))
  }
})

watch(
  () => props.intent,
  (intent) => {
    if (!intent) return
    const invoice = props.invoices.find(inv => inv.id === intent.invoiceId)
    if (!invoice) {
      toast.error('Không tìm thấy hoá đơn để xử lý')
      return
    }
    if (intent.type === 'focus') {
      focusInvoice(intent.invoiceId)
      return
    }
    startVoid(invoice, {
      reason: 'Void for reissue after reading adjustment',
      showReissueHint: true,
    })
  },
  { immediate: true },
)
</script>

<template>
  <div class="space-y-4">
    <UiAlert v-if="bulkEmailSummary" severity="success" dismissible @dismiss="bulkEmailSummary = null">
      {{ bulkEmailSummary }}
    </UiAlert>

    <UiSection title="Thu tiền & công nợ" description="Theo dõi hoá đơn, ghi nhận thanh toán, hoàn tác và huỷ/phát hành lại." title-class="hidden md:block">
      <template v-if="summary.overdueCount > 0" #actions>
        <span class="inline-flex items-center gap-1 rounded-full bg-status-warning/10 px-2.5 py-0.5 text-xs font-medium text-status-warning">
          Quá hạn: {{ summary.overdueCount }}
        </span>
      </template>

      <UiToolbar>
        <UiSelect
          v-model="filterStatus"
          :options="filterOptions"
          aria-label="Lọc hóa đơn theo trạng thái"
          class="hidden w-44 md:block"
        />
        <UiFilterChips
          class="md:hidden"
          :model-value="[filterStatus]"
          :options="filterOptions"
          aria-label="Lọc hóa đơn theo trạng thái"
          @update:model-value="onFilterChipChange"
        />
        <span class="text-xs text-ui-muted">
          {{ filteredInvoices.length }} / {{ activeInvoices.length }} hoá đơn
        </span>
        <template #actions>
          <UiButton
            v-if="printableCandidates.length > 0"
            variant="ghost"
            size="sm"
            @click="toggleSelectAll"
          >
            {{ allVisibleSelected ? 'Bỏ chọn tất cả' : `Chọn tất cả (${printableCandidates.length})` }}
          </UiButton>
        </template>
      </UiToolbar>

      <!-- Mobile: grouped list replaces the table below md -->
      <div class="md:hidden">
        <div v-if="loading" class="space-y-2">
          <UiSkeleton v-for="n in 4" :key="`inv-skel-${n}`" class="h-24 w-full rounded-xl" />
        </div>
        <UiEmptyState
          v-else-if="filteredInvoices.length === 0"
          title="Chưa có hoá đơn"
          description="Phát hành hoá đơn từ tab Soạn kỳ."
        />
        <div v-else class="divide-y divide-ui-border overflow-hidden rounded-xl border border-ui-border bg-ui-surface">
          <div
            v-for="row in filteredInvoices"
            :key="row.id"
            class="flex flex-col gap-2 p-3"
          >
            <div class="flex items-start gap-3">
              <UiCheckbox
                v-if="row.status !== 'void'"
                shape="circle"
                class="mt-0.5 shrink-0"
                :model-value="selectedIds.has(row.id)"
                :aria-label="`Chọn hoá đơn ${row.invoiceCode}`"
                @update:model-value="toggleSelect(row)"
              />
              <UiButton
                :ref="(el) => setInvoiceRef(row.id, el)"
                unstyled
                :class="[
                  'flex min-w-0 flex-1 items-start gap-2 rounded-md text-left transition',
                  highlightedInvoiceId === row.id && 'bg-ui-accent/10 ring-2 ring-ui-accent/50',
                ]"
                @click="openDetail(row)"
              >
                <div class="min-w-0 flex-1">
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-medium text-ui-primary">{{ invoiceDisplay(row).title }}</p>
                      <p class="mt-0.5 truncate text-xs text-ui-muted">{{ invoiceDisplay(row).subtitle }}</p>
                    </div>
                    <UiStatusBadge :status="row.status" context="invoice" />
                  </div>
                  <div class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <div class="min-w-0">
                    <span class="text-ui-muted">Tổng </span>
                    <span class="tabular-nums text-ui-primary">{{ formatCurrency(row.totalAmount) }}</span>
                  </div>
                  <div class="min-w-0 text-right">
                    <span class="text-ui-muted">Đã thu </span>
                    <span :class="['tabular-nums', row.paidAmount === 0 ? 'text-ui-muted' : 'text-ui-primary']">{{ formatCurrency(row.paidAmount) }}</span>
                  </div>
                  <div class="min-w-0">
                    <span class="text-ui-muted">Còn lại </span>
                    <span :class="['font-medium tabular-nums', row.balanceAmount > 0 ? 'text-status-danger' : 'text-status-success']">{{ formatCurrency(row.balanceAmount) }}</span>
                  </div>
                  <div v-if="row.dueDate" class="min-w-0 text-right">
                    <span class="text-ui-muted">Hạn </span>
                    <span class="tabular-nums text-ui-primary">{{ row.dueDate }}</span>
                  </div>
                </div>
                </div>
                <IconChevronRight class="mt-1 h-4 w-4 shrink-0 text-ui-muted" aria-hidden="true" />
              </UiButton>
            </div>

            <div v-if="rowHasActions(row)" class="flex flex-wrap items-center justify-end gap-2 pl-7">
              <UiButton
                v-if="!periodIsClosed && row.status === 'paid' && onUndoPayment"
                size="sm"
                variant="ghost"
                @click="startUndoFromRow(row)"
              >
                Hoàn tác thu
              </UiButton>
              <UiButton
                v-if="row.status === 'issued' || row.status === 'partial' || row.status === 'overdue'"
                size="sm"
                variant="primary"
                :disabled="periodIsClosed"
                @click="startPayment(row)"
              >
                Đã thu
              </UiButton>
              <UiButton
                v-if="row.status === 'issued' && row.paidAmount === 0"
                size="sm"
                variant="ghost"
                :disabled="periodIsClosed"
                @click="startVoid(row)"
              >
                Huỷ
              </UiButton>
            </div>
          </div>
        </div>
      </div>

      <UiTable
        class="hidden md:block"
        :rows="filteredInvoices"
        :columns="columns"
        :loading="loading"
        empty-title="Chưa có hoá đơn"
        empty-description="Phát hành hoá đơn từ tab Soạn kỳ."
      >
        <template #cell-select="{ row }">
          <UiCheckbox
            v-if="(row as Invoice).status !== 'void'"
            :model-value="selectedIds.has((row as Invoice).id)"
            :aria-label="`Chọn hoá đơn ${(row as Invoice).invoiceCode}`"
            @update:model-value="toggleSelect(row as Invoice)"
            @click.stop
          />
        </template>
        <template #cell-tenant="{ row }">
          <UiButton
            :ref="(el) => setInvoiceRef(row.id, el)"
            unstyled
            :class="[
              'group flex min-w-0 max-w-full flex-col items-start rounded-md px-1 py-0.5 text-left transition',
              highlightedInvoiceId === row.id && 'bg-ui-accent/10 ring-2 ring-ui-accent/50',
            ]"
            @click.stop="openDetail(row)"
          >
            <span class="block truncate text-sm font-medium text-ui-primary group-hover:text-ui-accent">
              {{ invoiceDisplay(row).title }}
            </span>
            <span class="block truncate text-xs text-ui-muted">{{ invoiceDisplay(row).subtitle }}</span>
          </UiButton>
        </template>
        <template #cell-status="{ row }">
          <UiStatusBadge :status="row.status" context="invoice" />
        </template>
        <template #cell-totalAmount="{ row }">{{ formatCurrency(row.totalAmount) }}</template>
        <template #cell-paidAmount="{ row }">
          <span :class="row.paidAmount === 0 ? 'text-ui-muted' : ''">{{ formatCurrency(row.paidAmount) }}</span>
        </template>
        <template #cell-balanceAmount="{ row }">
          <span :class="row.balanceAmount > 0 ? 'text-status-danger font-medium' : 'text-status-success'">
            {{ formatCurrency(row.balanceAmount) }}
          </span>
        </template>
        <template #cell-dueDate="{ row }">
          <span :class="row.dueDate ? '' : 'text-ui-muted'">{{ row.dueDate ?? '—' }}</span>
        </template>
        <template #cell-actions="{ row }">
          <div class="flex items-center justify-end gap-1 whitespace-nowrap">
            <UiButton
              v-if="!periodIsClosed && row.status === 'paid' && onUndoPayment"
              size="sm"
              variant="ghost"
              class="whitespace-nowrap"
              title="Hoàn tác khoản thu gần nhất của hoá đơn"
              @click.stop="startUndoFromRow(row)"
            >
              Hoàn tác thu
            </UiButton>
            <UiButton
              v-if="row.status === 'issued' || row.status === 'partial' || row.status === 'overdue'"
              size="sm"
              variant="primary"
              class="whitespace-nowrap"
              :disabled="periodIsClosed"
              @click.stop="startPayment(row)"
            >
              Đã thu
            </UiButton>
            <UiButton
              v-if="row.status === 'issued' && row.paidAmount === 0"
              size="sm"
              variant="ghost"
              class="whitespace-nowrap"
              :disabled="periodIsClosed"
              @click.stop="startVoid(row)"
            >
              Huỷ
            </UiButton>
          </div>
        </template>
      </UiTable>
    </UiSection>

    <UiSection
      v-if="voidedInvoices.length > 0"
      title="Hoá đơn đã huỷ"
      :description="`${voidedInvoices.length} hoá đơn — snapshot tại thời điểm huỷ. Không đếm vào công nợ.`"
    >
      <div class="divide-y divide-ui-border overflow-hidden rounded-xl border border-ui-border bg-ui-surface md:hidden">
        <div v-for="row in voidedInvoices" :key="row.id" class="flex flex-col gap-1 p-3 text-xs">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="truncate text-sm text-ui-primary">{{ invoiceDisplay(row).title }}</p>
              <p class="truncate text-ui-muted">{{ invoiceDisplay(row).subtitle }}</p>
            </div>
            <span class="shrink-0 tabular-nums text-ui-muted line-through">{{ formatCurrency(row.totalAmount) }}</span>
          </div>
          <p class="text-ui-muted">{{ row.voidedAt ? new Date(row.voidedAt).toLocaleString('vi-VN') : '---' }}</p>
          <p v-if="row.voidReason" class="text-ui-primary">{{ row.voidReason }}</p>
          <p>
            <template v-if="row.supersededByInvoiceId && replacementById.get(row.supersededByInvoiceId)">
              <span class="text-ui-accent">{{ formatCurrency(replacementById.get(row.supersededByInvoiceId)!.totalAmount) }}</span>
              <span class="text-ui-muted"> (đã phát hành lại)</span>
            </template>
            <span v-else class="text-ui-muted">Chưa phát hành lại</span>
          </p>
        </div>
      </div>

      <UiTable class="hidden md:block" :rows="voidedInvoices" :columns="voidedColumns">
        <template #cell-contract="{ row }">
          <span class="block text-ui-primary text-sm">{{ invoiceDisplay(row).title }}</span>
          <span class="block text-xs text-ui-muted">{{ invoiceDisplay(row).subtitle }}</span>
        </template>
        <template #cell-totalAmount="{ row }">
          <span class="text-ui-muted line-through">{{ formatCurrency(row.totalAmount) }}</span>
        </template>
        <template #cell-voidedAt="{ row }">
          <span class="text-xs text-ui-muted">{{ row.voidedAt ? new Date(row.voidedAt).toLocaleString('vi-VN') : '---' }}</span>
        </template>
        <template #cell-voidReason="{ row }">
          <span v-if="row.voidReason" class="text-sm text-ui-primary">{{ row.voidReason }}</span>
          <span v-else class="text-ui-muted">---</span>
        </template>
        <template #cell-replacement="{ row }">
          <template v-if="row.supersededByInvoiceId && replacementById.get(row.supersededByInvoiceId)">
            <span class="text-ui-accent">
              {{ formatCurrency(replacementById.get(row.supersededByInvoiceId)!.totalAmount) }}
            </span>
            <span class="text-ui-muted ml-1">(đã phát hành lại)</span>
          </template>
          <span v-else class="text-ui-muted">Chưa phát hành lại</span>
        </template>
      </UiTable>
    </UiSection>

    <!-- Detail / payments history drawer -->
    <UiDrawer
      :model-value="!!selectedInvoice && !showPaymentModal && !showVoidModal"
      title="Chi tiết hoá đơn"
      width="w-full sm:w-[480px]"
      @update:model-value="(open) => { if (!open) closeDetail() }"
    >
      <div class="space-y-4">
        <UiAlert v-if="detailError" severity="danger">{{ detailError }}</UiAlert>
        <div v-if="detailLoading">
          <UiSkeleton class="h-24 w-full" />
        </div>
        <template v-else-if="selectedInvoice">
          <UiSection title="Khoản phí" description="Snapshot tại thời điểm phát hành — không bị ảnh hưởng khi giá thay đổi sau này.">
            <BillingChargeBreakdown
              :lines="selectedInvoice.charges"
              :total-amount="selectedInvoice.invoice.totalAmount"
              :show-adjustments="true"
            />
          </UiSection>

          <UiSection title="Thanh toán theo hóa đơn">
            <template #actions>
              <UiButton
                variant="ghost"
                size="sm"
                :loading="profileRefreshing"
                @click="refreshSnapshot"
              >
                Đồng bộ từ tòa nhà
              </UiButton>
            </template>
            <InvoicePaymentProfileCard :profile="selectedInvoice.invoiceProfile" />
          </UiSection>

          <UiSection title="Lịch sử thanh toán">
            <UiTable
              :rows="detailPayments"
              :columns="[
                { key: 'paid_at', label: 'Ngày', width: 'w-28' },
                { key: 'amount', label: 'Số tiền', numeric: true, width: 'w-32' },
                { key: 'payment_method', label: 'Hình thức', hideOnMobile: true },
                { key: 'recorded_by', label: 'Người ghi', hideOnMobile: true },
                { key: 'note', label: 'Ghi chú', hideOnMobile: true },
                { key: 'actions', label: '', action: true, width: 'w-28' },
              ]"
              row-key="id"
              empty-title="Chưa có thanh toán nào"
            >
              <template #cell-paid_at="{ row }">{{ row.paidAt }}</template>
              <template #cell-amount="{ row }">{{ formatCurrency(row.amount) }}</template>
              <template #cell-payment_method="{ row }">{{ row.paymentMethod ?? '—' }}</template>
              <template #cell-recorded_by="{ row }">{{ row.recordedByName ?? 'Hệ thống' }}</template>
              <template #cell-note="{ row }">{{ row.note ?? '—' }}</template>
              <template #cell-actions="{ row }">
                <div class="flex justify-end">
                  <UiButton
                    v-if="canUndoPayment"
                    variant="ghost"
                    size="sm"
                    @click="startUndoPayment(selectedInvoice.invoice.id, row as InvoicePayment)"
                  >
                    Hoàn tác
                  </UiButton>
                </div>
              </template>
            </UiTable>
          </UiSection>
        </template>
      </div>
      <template #footer>
        <div class="flex items-center justify-between gap-3">
          <NuxtLink
            v-if="selectedInvoice"
            :to="invoicePath(selectedInvoice.invoice)"
            class="inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium text-ui-muted transition hover:bg-ui-hover hover:text-ui-primary"
          >
            Mở trang chi tiết
          </NuxtLink>
          <div class="flex items-center gap-2">
            <UiButton
              v-if="selectedInvoice && selectedInvoice.invoice.status !== 'void'"
              variant="secondary"
              @click="openPrint([selectedInvoice.invoice.id])"
            >
              In phiếu
            </UiButton>
            <UiButton variant="secondary" @click="closeDetail">Đóng</UiButton>
          </div>
        </div>
      </template>
    </UiDrawer>

    <!-- Record payment -->
    <UiModal :open="showPaymentModal" title="Ghi nhận thanh toán" @close="showPaymentModal = false">
      <div class="space-y-3">
        <UiSection title="Số tiền" description="Thu đủ số còn lại — không hỗ trợ thu một phần.">
          <UiInput v-model.number="paymentForm.amount" type="number" number-mode="currency" min="1" class="w-full" disabled />
        </UiSection>
        <UiSection title="Ngày thanh toán">
          <UiDatePicker v-model="paymentForm.paid_at" date-mode="payment" class="w-full" />
        </UiSection>
        <UiSection title="Hình thức">
          <UiInput v-model="paymentForm.payment_method" placeholder="cash, bank transfer..." class="w-full" />
        </UiSection>
        <UiSection title="Ghi chú">
          <UiInput v-model="paymentForm.note" placeholder="Tuỳ chọn" class="w-full" />
        </UiSection>
        <UiAlert v-if="paymentError" severity="danger">{{ paymentError }}</UiAlert>
      </div>
      <template #footer>
        <UiButton variant="secondary" :disabled="paymentSubmitting" @click="showPaymentModal = false">Huỷ</UiButton>
        <UiButton :loading="paymentSubmitting" @click="submitPayment">Ghi nhận</UiButton>
      </template>
    </UiModal>

    <!-- Void -->
    <UiModal :open="showVoidModal" title="Huỷ hoá đơn" @close="showVoidModal = false">
      <div class="space-y-3">
        <p class="text-sm text-ui-muted">Chỉ có thể huỷ khi chưa có thanh toán nào. Hoá đơn huỷ vẫn lưu lại để truy vết.</p>
        <UiSection title="Lý do huỷ">
          <UiInput v-model="voidForm.reason" placeholder="Lý do huỷ hoá đơn..." class="w-full" />
        </UiSection>
        <UiAlert v-if="voidError" severity="danger">{{ voidError }}</UiAlert>
      </div>
      <template #footer>
        <UiButton variant="secondary" :disabled="voidSubmitting" @click="showVoidModal = false">Huỷ</UiButton>
        <UiButton variant="danger" :loading="voidSubmitting" @click="submitVoid">Huỷ hoá đơn</UiButton>
      </template>
    </UiModal>

    <!-- Bulk payments -->
    <BillingBulkPaymentModal
      :open="showBulkModal"
      :invoices="selectedInvoicesForBulk"
      :failed-invoice-id="bulkFailedInvoiceId"
      :error-message="bulkError"
      :submitting="bulkSubmitting"
      @close="closeBulkModal"
      @submit="submitBulkPayments"
    />

    <UiModal
      :open="showEmailModal"
      title="Gửi các hoá đơn đã chọn?"
      size="sm"
      @close="showEmailModal = false"
    >
      <div class="space-y-3">
        <p class="text-sm leading-6 text-ui-muted">
          {{ selectedInvoicesForBulk.length }} hoá đơn đang hiển thị sẽ được xếp hàng gửi đến email liên hệ chính của khách thuê.
        </p>
        <UiAlert v-if="selectedInvoicesForBulk.length > 100" severity="warning">
          Mỗi lần chỉ gửi tối đa 100 hoá đơn.
        </UiAlert>
        <UiAlert v-if="invoiceEmailError" severity="danger">{{ invoiceEmailError }}</UiAlert>
      </div>
      <template #footer>
        <UiButton variant="secondary" :disabled="sendingInvoiceEmail" @click="showEmailModal = false">Huỷ</UiButton>
        <UiButton
          :loading="sendingInvoiceEmail"
          :disabled="selectedInvoicesForBulk.length === 0 || selectedInvoicesForBulk.length > 100"
          @click="sendEmailSelection"
        >
          Gửi email ({{ selectedInvoicesForBulk.length }})
        </UiButton>
      </template>
    </UiModal>

    <!-- Sticky bulk action bar -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div
        v-if="selectedIds.size > 0"
        class="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-1/2 z-30 w-[calc(100%-2rem)] max-w-max -translate-x-1/2 rounded-2xl border border-ui-border bg-ui-chrome/95 px-4 py-2 shadow-lg shadow-ui-shadow/40 backdrop-blur-md sm:w-auto lg:bottom-4 lg:rounded-xl lg:bg-ui-chrome lg:backdrop-blur"
      >
        <div class="grid grid-cols-2 items-center gap-2 sm:flex sm:gap-3">
          <span class="col-span-2 text-center text-sm text-ui-primary sm:col-auto sm:text-left">
            Đã chọn <span class="font-semibold">{{ selectedIds.size }}</span> hoá đơn
          </span>
          <UiButton class="whitespace-nowrap" variant="ghost" size="sm" @click="clearSelection">Bỏ chọn</UiButton>
          <UiButton class="whitespace-nowrap" variant="secondary" size="sm" @click="printSelection">
            In phiếu
          </UiButton>
          <UiButton
            v-if="invoiceEmailEnabled"
            class="col-span-2 whitespace-nowrap sm:col-auto"
            variant="secondary"
            size="sm"
            :disabled="selectedInvoicesForBulk.length > 100"
            @click="showEmailModal = true"
          >
            Gửi email ({{ selectedInvoicesForBulk.length }})
          </UiButton>
          <UiButton
            class="col-span-2 whitespace-nowrap sm:col-auto"
            variant="primary"
            size="sm"
            :disabled="!bulkPaymentSelectionEligible"
            :title="bulkPaymentDisabledReason"
            @click="openBulkModal"
          >
            Ghi thu hàng loạt
          </UiButton>
        </div>
        <p
          v-if="bulkPaymentDisabledReason"
          class="mt-2 text-center text-xs text-status-warning"
        >
          {{ bulkPaymentDisabledReason }}
        </p>
      </div>
    </Transition>

    <UiConfirmModal
      :open="!!undoTarget"
      title="Hoàn tác thanh toán"
      :message="undoTarget ? `Hoàn tác khoản thu ${formatCurrency(undoTarget.payment.amount)}? Hoá đơn sẽ được tính lại công nợ.` : ''"
      confirm-label="Hoàn tác"
      :loading="undoSubmitting"
      @confirm="confirmUndoPayment"
      @cancel="undoTarget = null"
    />
  </div>
</template>
