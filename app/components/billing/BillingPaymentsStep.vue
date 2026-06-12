<script setup lang="ts">
import type { UiTableColumn } from '~/components/ui/UiTable.vue'
import type { BillingDraftResponse, BillingPeriod, Invoice, InvoicePayment, InvoiceWithCharges } from '~/types/billing'
import type { AdjustmentChargeInput, VoidInvoiceInput } from '~/utils/validators/billing'
import { formatCurrency } from '~/utils/format/currency'

export interface BillingPaymentsIntent {
  id: number
  type: 'adjustment' | 'void-reissue'
  invoiceId: string
  amount?: number
  label?: string
}

const props = defineProps<{
  period: BillingPeriod
  invoices: Invoice[]
  loading: boolean
  intent?: BillingPaymentsIntent | null
  drafts?: BillingDraftResponse | null
}>()

const emit = defineEmits<{ reload: [] }>()

const { createAdjustmentPayload, load, recordPayment, voidInvoice, addAdjustment, listPayments } = useBillingInvoiceActions()
const toast = useToast()

const periodIsClosed = computed(() => props.period.status === 'closed')

const filterStatus = ref<'all' | 'paid' | 'partial' | 'unpaid' | 'overdue'>('all')
const filterOptions = [
  { value: 'all', label: 'Tất cả' },
  { value: 'unpaid', label: 'Chưa thu' },
  { value: 'partial', label: 'Một phần' },
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

const issuedInvoiceOptions = computed(() =>
  props.invoices
    .filter(inv => inv.status !== 'void')
    .map(inv => ({
      id: inv.id,
      label: `${inv.roomNumber ? `P.${inv.roomNumber}` : inv.id.slice(0, 8)} · ${inv.tenantName ?? 'Khách thuê'} · ${formatCurrency(inv.totalAmount)}`,
    })),
)

function invoiceDisplay(row: Invoice): { title: string; subtitle: string } {
  const title = [row.tenantName, row.roomNumber ? `P.${row.roomNumber}` : null].filter(Boolean).join(' · ')
  return {
    title: title || row.contractCode || row.contractId,
    subtitle: row.contractCode ?? row.contractId,
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
  { key: 'tenant', label: 'Hợp đồng' },
  { key: 'status', label: 'Trạng thái', width: 'w-32' },
  { key: 'totalAmount', label: 'Tổng tiền', numeric: true, hideOnMobile: true },
  { key: 'paidAmount', label: 'Đã thu', numeric: true, hideOnMobile: true },
  { key: 'balanceAmount', label: 'Còn lại', numeric: true },
  { key: 'dueDate', label: 'Hạn', hideOnMobile: true, width: 'w-28' },
  { key: 'actions', label: '', action: true, width: 'w-44' },
]

// ---------- Detail panel ----------
const selectedInvoice = ref<InvoiceWithCharges | null>(null)
const detailLoading = ref(false)
const detailError = ref<string | null>(null)

async function openDetail(inv: Invoice) {
  detailLoading.value = true
  detailError.value = null
  try {
    selectedInvoice.value = await load(inv.id)
  } catch (err) {
    const e = err as { data?: { error?: { message?: string } } }
    detailError.value = e.data?.error?.message ?? 'Không thể tải hoá đơn'
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
  if (paymentForm.amount <= 0) {
    paymentError.value = 'Số tiền phải > 0'
    return
  }
  paymentSubmitting.value = true
  paymentError.value = null
  try {
    await recordPayment(selectedInvoice.value.invoice.id, {
      amount: paymentForm.amount,
      paid_at: paymentForm.paid_at,
      payment_method: paymentForm.payment_method.trim() || null,
      note: paymentForm.note.trim() || null,
    })
    toast.success(`Đã ghi ${formatCurrency(paymentForm.amount)}`)
    showPaymentModal.value = false
    emit('reload')
  } catch (err) {
    const e = err as { data?: { error?: { message?: string } } }
    paymentError.value = e.data?.error?.message ?? 'Ghi nhận thất bại'
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
    await voidInvoice(voidTarget.value.id, { reason: voidForm.reason })
    toast.success('Đã huỷ hoá đơn')
    if (showReissueHintAfterVoid.value) {
      toast.info('Vào tab Chỉ số & hoá đơn nháp để phát hành lại')
    }
    showVoidModal.value = false
    showReissueHintAfterVoid.value = false
    emit('reload')
  } catch (err) {
    const e = err as { data?: { error?: { message?: string } } }
    voidError.value = e.data?.error?.message ?? 'Huỷ hoá đơn thất bại'
    toast.error(voidError.value)
  } finally {
    voidSubmitting.value = false
  }
}

// ---------- Adjustment ----------
const showAdjustmentModal = ref(false)
const adjustmentForm = reactive<{ label: string; amount: number; reason: string; reference_invoice_id: string | null }>(
  { label: '', amount: 0, reason: '', reference_invoice_id: null },
)
const adjustmentSubmitting = ref(false)
const adjustmentError = ref<string | null>(null)
const adjustmentTarget = ref<Invoice | null>(null)

const selectedReferenceInvoice = computed({
  get() {
    return issuedInvoiceOptions.value.find(option => option.id === adjustmentForm.reference_invoice_id) ?? null
  },
  set(option: { id: string; label: string } | null) {
    adjustmentForm.reference_invoice_id = option?.id ?? null
  },
})

function startAdjustment(inv: Invoice, prefill?: { amount?: number; label?: string; referenceInvoiceId?: string | null; reason?: string }) {
  adjustmentTarget.value = inv
  adjustmentForm.label = prefill?.label ?? ''
  adjustmentForm.amount = prefill?.amount ?? 0
  adjustmentForm.reason = prefill?.reason ?? ''
  adjustmentForm.reference_invoice_id = prefill?.referenceInvoiceId ?? inv.supersedesInvoiceId
  adjustmentError.value = null
  showAdjustmentModal.value = true
}

async function submitAdjustment() {
  if (!adjustmentTarget.value) return
  if (!adjustmentForm.label.trim() || !adjustmentForm.reason.trim()) {
    adjustmentError.value = 'Cần nhập đầy đủ tên khoản và lý do'
    return
  }
  if (!Number.isFinite(adjustmentForm.amount) || adjustmentForm.amount === 0) {
    adjustmentError.value = 'Số tiền điều chỉnh phải khác 0'
    return
  }
  adjustmentSubmitting.value = true
  adjustmentError.value = null
  try {
    const payload: Omit<AdjustmentChargeInput, 'target_invoice_id'> = createAdjustmentPayload({
      label: adjustmentForm.label,
      amount: adjustmentForm.amount,
      reason: adjustmentForm.reason,
      referenceInvoiceId: adjustmentForm.reference_invoice_id,
    })
    await addAdjustment(adjustmentTarget.value.id, payload)
    toast.success('Đã lưu điều chỉnh')
    showAdjustmentModal.value = false
    emit('reload')
  } catch (err) {
    const e = err as { data?: { error?: { message?: string } } }
    adjustmentError.value = e.data?.error?.message ?? 'Lưu điều chỉnh thất bại'
    toast.error(adjustmentError.value)
  } finally {
    adjustmentSubmitting.value = false
  }
}

// ---------- Payment history (in detail panel) ----------
const detailPayments = ref<InvoicePayment[]>([])
async function refreshPayments(invoiceId: string) {
  detailPayments.value = await listPayments(invoiceId)
}

watch(selectedInvoice, async (next) => {
  if (next?.invoice.id && !showPaymentModal.value) {
    await refreshPayments(next.invoice.id)
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
    if (intent.type === 'adjustment') {
      startAdjustment(invoice, {
        amount: intent.amount,
        label: intent.label,
        reason: intent.label,
        referenceInvoiceId: intent.invoiceId,
      })
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
    <UiSection title="Thanh toán & Công nợ" description="Theo dõi hoá đơn, ghi nhận thanh toán, huỷ/phát hành lại, điều chỉnh.">
      <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <UiMetric label="Tổng phát hành" :value="formatCurrency(summary.issuedTotal)" tone="default" />
        <UiMetric label="Đã thu" :value="formatCurrency(summary.paidTotal)" tone="success" />
        <UiMetric label="Còn lại" :value="formatCurrency(summary.outstanding)" :tone="summary.outstanding > 0 ? 'danger' : 'default'" />
        <UiMetric label="Quá hạn" :value="summary.overdueCount" :tone="summary.overdueCount > 0 ? 'warning' : 'default'" />
      </div>

      <UiToolbar>
        <UiSelect v-model="filterStatus" :options="filterOptions" class="w-44" />
      </UiToolbar>

      <UiTable
        :rows="filteredInvoices"
        :columns="columns"
        :loading="loading"
        empty-title="Chưa có hoá đơn"
        empty-description="Phát hành hoá đơn từ tab “Phát hành”."
      >
        <template #cell-tenant="{ row }">
          <UiButton variant="ghost" size="sm" class="!px-0 !py-0 !h-auto text-left" @click="openDetail(row)">
            <span class="block">
              <span class="block text-white text-sm">{{ invoiceDisplay(row).title }}</span>
              <span class="block text-xs text-muted">{{ invoiceDisplay(row).subtitle }}</span>
            </span>
          </UiButton>
        </template>
        <template #cell-status="{ row }">
          <UiStatusBadge :status="row.status" context="invoice" />
        </template>
        <template #cell-totalAmount="{ row }">{{ formatCurrency(row.totalAmount) }}</template>
        <template #cell-paidAmount="{ row }">{{ formatCurrency(row.paidAmount) }}</template>
        <template #cell-balanceAmount="{ row }">
          <span :class="row.balanceAmount > 0 ? 'text-error-vivid' : 'text-success-neon'">
            {{ formatCurrency(row.balanceAmount) }}
          </span>
        </template>
        <template #cell-dueDate="{ row }">{{ row.dueDate ?? '—' }}</template>
        <template #cell-actions="{ row }">
          <div class="flex items-center justify-end gap-1">
            <UiButton
              v-if="row.status === 'issued' || row.status === 'partial' || row.status === 'overdue'"
              size="sm"
              variant="secondary"
              :disabled="periodIsClosed"
              @click.stop="startPayment(row)"
            >
              + Thu
            </UiButton>
            <UiButton
              v-if="row.status === 'issued' && row.paidAmount === 0"
              size="sm"
              variant="ghost"
              :disabled="periodIsClosed"
              @click.stop="startVoid(row)"
            >
              Huỷ
            </UiButton>
            <UiButton
              v-if="row.status === 'paid' || row.status === 'partial'"
              size="sm"
              variant="ghost"
              :disabled="periodIsClosed"
              @click.stop="startAdjustment(row)"
            >
              Điều chỉnh
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
      <div class="relative overflow-x-auto rounded-xl border border-dark-border bg-dark-surface">
        <table class="min-w-full text-sm">
          <thead class="bg-dark-card text-xs uppercase tracking-wide text-muted">
            <tr>
              <th class="px-3 py-2 text-left font-medium">Hợp đồng</th>
              <th class="px-3 py-2 text-right tabular-nums hidden md:table-cell font-medium w-32">Tổng tại thời điểm huỷ</th>
              <th class="px-3 py-2 text-left hidden md:table-cell w-32 font-medium">Huỷ lúc</th>
              <th class="px-3 py-2 text-left font-medium">Lý do</th>
              <th class="px-3 py-2 text-left w-44 font-medium">Thay thế bằng</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-dark-border">
            <tr v-for="row in voidedInvoices" :key="row.id" class="transition-colors">
              <td class="px-3 py-2 align-middle">
                <span class="block text-white text-sm">{{ invoiceDisplay(row).title }}</span>
                <span class="block text-xs text-muted">{{ invoiceDisplay(row).subtitle }}</span>
              </td>
              <td class="px-3 py-2 text-right tabular-nums hidden md:table-cell text-muted line-through">
                {{ formatCurrency(row.totalAmount) }}
              </td>
              <td class="px-3 py-2 hidden md:table-cell text-xs text-muted">
                {{ row.voidedAt ? new Date(row.voidedAt).toLocaleString('vi-VN') : '—' }}
              </td>
              <td class="px-3 py-2 text-sm text-white">
                <span v-if="row.voidReason">{{ row.voidReason }}</span>
                <span v-else class="text-muted">—</span>
              </td>
              <td class="px-3 py-2 text-xs">
                <template v-if="row.supersededByInvoiceId && replacementById.get(row.supersededByInvoiceId)">
                  <span class="text-cyan">
                    {{ formatCurrency(replacementById.get(row.supersededByInvoiceId)!.totalAmount) }}
                  </span>
                  <span class="text-muted ml-1">(đã phát hành lại)</span>
                </template>
                <span v-else class="text-muted">Chưa phát hành lại</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UiSection>

    <!-- Detail / payments history modal -->
    <UiModal :open="!!selectedInvoice && !showPaymentModal && !showVoidModal && !showAdjustmentModal" title="Chi tiết hoá đơn" size="lg" @close="closeDetail">
      <div class="space-y-4">
        <UiAlert v-if="detailError" severity="danger">{{ detailError }}</UiAlert>
        <div v-if="detailLoading">
          <UiSkeleton class="h-24 w-full" />
        </div>
        <template v-else-if="selectedInvoice">
          <UiSection title="Khoản phí" description="Snapshot tại thời điểm phát hành — không bị ảnh hưởng khi giá thay đổi sau này.">
            <UiTable
              :rows="selectedInvoice.charges"
              :columns="[
                { key: 'label', label: 'Khoản phí' },
                { key: 'quantity', label: 'SL', numeric: true, hideOnMobile: true, width: 'w-20' },
                { key: 'unitPrice', label: 'Đơn giá', numeric: true, hideOnMobile: true },
                { key: 'amount', label: 'Thành tiền', numeric: true },
              ]"
              row-key="id"
            >
              <template #cell-label="{ row }">
                <UiStatusBadge :status="row.chargeType" context="correction" />
                <span class="ml-2">{{ row.label }}</span>
              </template>
              <template #cell-quantity="{ row }">{{ row.quantity }}</template>
              <template #cell-unitPrice="{ row }">{{ formatCurrency(row.unitPrice) }}</template>
              <template #cell-amount="{ row }">{{ formatCurrency(row.amount) }}</template>
            </UiTable>
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
              ]"
              row-key="id"
              empty-title="Chưa có thanh toán nào"
            >
              <template #cell-paid_at="{ row }">{{ row.paidAt }}</template>
              <template #cell-amount="{ row }">{{ formatCurrency(row.amount) }}</template>
              <template #cell-payment_method="{ row }">{{ row.paymentMethod ?? '—' }}</template>
              <template #cell-recorded_by="{ row }">{{ row.recordedByName ?? 'Hệ thống' }}</template>
              <template #cell-note="{ row }">{{ row.note ?? '—' }}</template>
            </UiTable>
          </UiSection>
        </template>
      </div>
      <template #footer>
        <UiButton variant="secondary" @click="closeDetail">Đóng</UiButton>
      </template>
    </UiModal>

    <!-- Record payment -->
    <UiModal :open="showPaymentModal" title="Ghi nhận thanh toán" @close="showPaymentModal = false">
      <div class="space-y-3">
        <UiSection title="Số tiền">
          <UiInput v-model.number="paymentForm.amount" type="number" min="1" class="w-full" />
        </UiSection>
        <UiSection title="Ngày thanh toán">
          <UiInput v-model="paymentForm.paid_at" type="date" class="w-full" />
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

    <!-- Adjustment -->
    <UiModal :open="showAdjustmentModal" title="Điều chỉnh hoá đơn" @close="showAdjustmentModal = false">
      <div class="space-y-3">
        <p class="text-sm text-muted">Thêm khoản điều chỉnh (cộng hoặc trừ) cho hoá đơn đã phát hành. Số dương = thêm phí; số âm = giảm phí.</p>
        <UiSection title="Tên khoản">
          <UiInput v-model="adjustmentForm.label" placeholder="VD: Bù chênh lệch điện tháng trước" class="w-full" />
        </UiSection>
        <UiSection title="Số tiền (VND)">
          <UiInput v-model.number="adjustmentForm.amount" type="number" class="w-full" />
        </UiSection>
        <UiSection title="Lý do">
          <UiInput v-model="adjustmentForm.reason" placeholder="Lý do điều chỉnh..." class="w-full" />
        </UiSection>
        <UiSection title="Hoá đơn tham chiếu">
          <UiCombobox
            v-model="selectedReferenceInvoice"
            :options="issuedInvoiceOptions"
            :option-key="option => option.id"
            :option-label="option => option.label"
            placeholder="Không chọn"
            search-placeholder="Tìm hoá đơn..."
            empty-message="Không có hoá đơn phù hợp"
          />
        </UiSection>
        <UiAlert v-if="adjustmentError" severity="danger">{{ adjustmentError }}</UiAlert>
      </div>
      <template #footer>
        <UiButton variant="secondary" :disabled="adjustmentSubmitting" @click="showAdjustmentModal = false">Huỷ</UiButton>
        <UiButton :loading="adjustmentSubmitting" @click="submitAdjustment">Lưu</UiButton>
      </template>
    </UiModal>
  </div>
</template>
