<script setup lang="ts">
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

const { load, recordPayment, recordBulkPayments, voidInvoice, listPayments } = useBillingInvoiceActions()
const toast = useToast()

const periodIsClosed = computed(() => isPeriodLocked(props.period))
const canUndoPayment = computed(() => !!props.onUndoPayment && !periodIsClosed.value)

const filterStatus = ref<'all' | 'paid' | 'partial' | 'unpaid' | 'overdue'>('all')
const filterOptions = [
  { value: 'all', label: 'Tất cả' },
  { value: 'unpaid', label: 'Chưa thu' },
  { value: 'paid', label: 'Đã thu' },
  { value: 'overdue', label: 'Quá hạn' },
]

const today = new Date().toISOString().slice(0, 10)
function deriveBucket(inv: Invoice): 'paid' | 'partial' | 'unpaid' | 'overdue' | 'void' {
  if (inv.status === 'void') return 'void'
  if (inv.status === 'paid') return 'paid'
  if (inv.paidAmount > 0 && inv.balanceAmount > 0) return 'partial'
  if (inv.dueDate && inv.dueDate < today && inv.balanceAmount > 0) return 'overdue'
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

function isSelectableForBulk(inv: Invoice): boolean {
  if (periodIsClosed.value) return false
  if (inv.status === 'void' || inv.status === 'paid') return false
  return inv.balanceAmount > 0
}

const bulkCandidates = computed(() => filteredInvoices.value.filter(isSelectableForBulk))

const allBulkSelected = computed(() =>
  bulkCandidates.value.length > 0 && bulkCandidates.value.every(inv => selectedIds.value.has(inv.id)),
)

function toggleSelect(invoiceId: string) {
  if (selectedIds.value.has(invoiceId)) selectedIds.value.delete(invoiceId)
  else selectedIds.value.add(invoiceId)
  selectedIds.value = new Set(selectedIds.value)
}

function toggleSelectAll() {
  if (allBulkSelected.value) {
    for (const inv of bulkCandidates.value) selectedIds.value.delete(inv.id)
  }
  else {
    for (const inv of bulkCandidates.value) selectedIds.value.add(inv.id)
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

// ---------- Bulk modal ----------
const showBulkModal = ref(false)
const bulkSubmitting = ref(false)
const bulkError = ref<string | null>(null)
const bulkFailedInvoiceId = ref<string | null>(null)

function openBulkModal() {
  if (selectedInvoicesForBulk.value.length === 0) return
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
  selectedInvoice.value = { invoice: inv, charges: [], payments: [] }
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
const voidForm = reactive<VoidInvoiceInput>({ reason: '' })
const voidSubmitting = ref(false)
const voidError = ref<string | null>(null)
const voidTarget = ref<Invoice | null>(null)
const showReissueHintAfterVoid = ref(false)

function startVoid(inv: Invoice, options?: { reason?: string; showReissueHint?: boolean }) {
  voidTarget.value = inv
  voidForm.reason = options?.reason ?? ''
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
    await voidInvoice(invoiceRouteSegment(voidTarget.value), { reason: voidForm.reason })
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
    <UiSection title="Thu tiền & công nợ" description="Theo dõi hoá đơn, ghi nhận thanh toán, hoàn tác và huỷ/phát hành lại.">
      <template v-if="summary.overdueCount > 0" #actions>
        <span class="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-300">
          Quá hạn: {{ summary.overdueCount }}
        </span>
      </template>

      <UiToolbar>
        <UiSelect
          v-model="filterStatus"
          :options="filterOptions"
          aria-label="Lọc hóa đơn theo trạng thái"
          class="w-44"
        />
        <span class="text-xs text-muted">
          {{ filteredInvoices.length }} / {{ activeInvoices.length }} hoá đơn
        </span>
        <template #actions>
          <UiButton
            v-if="bulkCandidates.length > 0 && !periodIsClosed"
            variant="ghost"
            size="sm"
            @click="toggleSelectAll"
          >
            {{ allBulkSelected ? 'Bỏ chọn tất cả' : `Chọn tất cả (${bulkCandidates.length})` }}
          </UiButton>
        </template>
      </UiToolbar>

      <UiTable
        :rows="filteredInvoices"
        :columns="columns"
        :loading="loading"
        empty-title="Chưa có hoá đơn"
        empty-description="Phát hành hoá đơn từ tab Soạn kỳ."
      >
        <template #cell-select="{ row }">
          <UiCheckbox
            v-if="isSelectableForBulk(row as Invoice)"
            :model-value="selectedIds.has((row as Invoice).id)"
            @update:model-value="toggleSelect((row as Invoice).id)"
            @click.stop
          />
        </template>
        <template #cell-tenant="{ row }">
          <UiButton
            :ref="(el) => setInvoiceRef(row.id, el)"
            unstyled
            :class="[
              'group flex min-w-0 max-w-full flex-col items-start rounded-md px-1 py-0.5 text-left transition',
              highlightedInvoiceId === row.id && 'bg-cyan/10 ring-2 ring-cyan/50',
            ]"
            @click.stop="openDetail(row)"
          >
            <span class="block truncate text-sm font-medium text-white group-hover:text-cyan">
              {{ invoiceDisplay(row).title }}
            </span>
            <span class="block truncate text-xs text-muted">{{ invoiceDisplay(row).subtitle }}</span>
          </UiButton>
        </template>
        <template #cell-status="{ row }">
          <UiStatusBadge :status="row.status" context="invoice" />
        </template>
        <template #cell-totalAmount="{ row }">{{ formatCurrency(row.totalAmount) }}</template>
        <template #cell-paidAmount="{ row }">
          <span :class="row.paidAmount === 0 ? 'text-muted' : ''">{{ formatCurrency(row.paidAmount) }}</span>
        </template>
        <template #cell-balanceAmount="{ row }">
          <span :class="row.balanceAmount > 0 ? 'text-error-vivid font-medium' : 'text-success-neon'">
            {{ formatCurrency(row.balanceAmount) }}
          </span>
        </template>
        <template #cell-dueDate="{ row }">
          <span :class="row.dueDate ? '' : 'text-muted'">{{ row.dueDate ?? '—' }}</span>
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
      <UiTable :rows="voidedInvoices" :columns="voidedColumns">
        <template #cell-contract="{ row }">
          <span class="block text-white text-sm">{{ invoiceDisplay(row).title }}</span>
          <span class="block text-xs text-muted">{{ invoiceDisplay(row).subtitle }}</span>
        </template>
        <template #cell-totalAmount="{ row }">
          <span class="text-muted line-through">{{ formatCurrency(row.totalAmount) }}</span>
        </template>
        <template #cell-voidedAt="{ row }">
          <span class="text-xs text-muted">{{ row.voidedAt ? new Date(row.voidedAt).toLocaleString('vi-VN') : '---' }}</span>
        </template>
        <template #cell-voidReason="{ row }">
          <span v-if="row.voidReason" class="text-sm text-white">{{ row.voidReason }}</span>
          <span v-else class="text-muted">---</span>
        </template>
        <template #cell-replacement="{ row }">
          <template v-if="row.supersededByInvoiceId && replacementById.get(row.supersededByInvoiceId)">
            <span class="text-cyan">
              {{ formatCurrency(replacementById.get(row.supersededByInvoiceId)!.totalAmount) }}
            </span>
            <span class="text-muted ml-1">(đã phát hành lại)</span>
          </template>
          <span v-else class="text-muted">Chưa phát hành lại</span>
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
            class="inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium text-muted transition hover:bg-dark-hover hover:text-white"
          >
            Mở trang chi tiết
          </NuxtLink>
          <UiButton variant="secondary" @click="closeDetail">Đóng</UiButton>
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
        <p class="text-sm text-muted">Chỉ có thể huỷ khi chưa có thanh toán nào. Hoá đơn huỷ vẫn lưu lại để truy vết.</p>
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
        class="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full border border-dark-border bg-dark-card px-4 py-2 shadow-lg shadow-black/40 backdrop-blur"
      >
        <div class="flex items-center gap-3">
          <span class="text-sm text-white">
            Đã chọn <span class="font-semibold">{{ selectedIds.size }}</span> hoá đơn
          </span>
          <UiButton variant="ghost" size="sm" @click="clearSelection">Bỏ chọn</UiButton>
          <UiButton variant="primary" size="sm" @click="openBulkModal">
            Ghi thu hàng loạt
          </UiButton>
        </div>
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
