<script setup lang="ts">
import type { UiTableColumn } from '~/components/ui/UiTable.vue'
import type { BillingPeriod, Invoice, InvoicePayment, InvoiceWithCharges } from '~/types/billing'
import type { AdjustmentChargeInput, VoidInvoiceInput } from '~/utils/validators/billing'
import { formatCurrency } from '~/utils/format/currency'

const props = defineProps<{
  period: BillingPeriod
  invoices: Invoice[]
  loading: boolean
}>()

const emit = defineEmits<{ reload: [] }>()

const { load, recordPayment, voidInvoice, reissue, addAdjustment, listPayments } = useBillingInvoiceActions()

const periodIsClosed = computed(() => props.period.status === 'closed')

const filterStatus = ref<'all' | 'paid' | 'partial' | 'unpaid' | 'overdue' | 'void'>('all')
const filterOptions = [
  { value: 'all', label: 'Tất cả' },
  { value: 'unpaid', label: 'Chưa thu' },
  { value: 'partial', label: 'Một phần' },
  { value: 'paid', label: 'Đã thu' },
  { value: 'overdue', label: 'Quá hạn' },
  { value: 'void', label: 'Đã huỷ' },
]

const today = new Date().toISOString().slice(0, 10)
function deriveBucket(inv: Invoice): 'paid' | 'partial' | 'unpaid' | 'overdue' | 'void' {
  if (inv.status === 'void') return 'void'
  if (inv.status === 'paid') return 'paid'
  if (inv.paidAmount > 0 && inv.balanceAmount > 0) return 'partial'
  if (inv.dueDate && inv.dueDate < today && inv.balanceAmount > 0) return 'overdue'
  return 'unpaid'
}

const filteredInvoices = computed(() => {
  if (filterStatus.value === 'all') return props.invoices
  return props.invoices.filter(i => deriveBucket(i) === filterStatus.value)
})

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
    showPaymentModal.value = false
    emit('reload')
  } catch (err) {
    const e = err as { data?: { error?: { message?: string } } }
    paymentError.value = e.data?.error?.message ?? 'Ghi nhận thất bại'
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

function startVoid(inv: Invoice) {
  voidTarget.value = inv
  voidForm.reason = ''
  voidError.value = null
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
    showVoidModal.value = false
    emit('reload')
  } catch (err) {
    const e = err as { data?: { error?: { message?: string } } }
    voidError.value = e.data?.error?.message ?? 'Huỷ hoá đơn thất bại'
  } finally {
    voidSubmitting.value = false
  }
}

// ---------- Reissue ----------
const showReissueModal = ref(false)
const reissueForm = reactive({ due_date: '', notes: '' })
const reissueSubmitting = ref(false)
const reissueError = ref<string | null>(null)
const reissueTarget = ref<Invoice | null>(null)

function startReissue(inv: Invoice) {
  reissueTarget.value = inv
  reissueForm.due_date = inv.dueDate ?? ''
  reissueForm.notes = ''
  reissueError.value = null
  showReissueModal.value = true
}

async function submitReissue() {
  if (!reissueTarget.value) return
  reissueSubmitting.value = true
  reissueError.value = null
  try {
    await reissue(reissueTarget.value.id, {
      due_date: reissueForm.due_date.trim() || null,
      notes: reissueForm.notes.trim() || null,
    })
    showReissueModal.value = false
    emit('reload')
  } catch (err) {
    const e = err as { data?: { error?: { message?: string } } }
    reissueError.value = e.data?.error?.message ?? 'Phát hành lại thất bại'
  } finally {
    reissueSubmitting.value = false
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

function startAdjustment(inv: Invoice) {
  adjustmentTarget.value = inv
  adjustmentForm.label = ''
  adjustmentForm.amount = 0
  adjustmentForm.reason = ''
  adjustmentForm.reference_invoice_id = inv.supersedesInvoiceId
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
    const payload: Omit<AdjustmentChargeInput, 'target_invoice_id'> = {
      label: adjustmentForm.label,
      amount: Math.trunc(adjustmentForm.amount),
      reason: adjustmentForm.reason,
      reference_invoice_id: adjustmentForm.reference_invoice_id,
    }
    await addAdjustment(adjustmentTarget.value.id, payload)
    showAdjustmentModal.value = false
    emit('reload')
  } catch (err) {
    const e = err as { data?: { error?: { message?: string } } }
    adjustmentError.value = e.data?.error?.message ?? 'Lưu điều chỉnh thất bại'
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
              <span class="block text-white text-sm">{{ row.contractId }}</span>
              <span class="block text-xs text-muted">Phòng: {{ row.roomId }}</span>
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
              v-if="row.status === 'void'"
              size="sm"
              variant="ghost"
              :disabled="periodIsClosed || !!row.supersededByInvoiceId"
              @click.stop="startReissue(row)"
            >
              Phát hành lại
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

    <!-- Detail / payments history modal -->
    <UiModal :open="!!selectedInvoice && !showPaymentModal && !showVoidModal && !showReissueModal && !showAdjustmentModal" title="Chi tiết hoá đơn" size="lg" @close="closeDetail">
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
                { key: 'note', label: 'Ghi chú', hideOnMobile: true },
              ]"
              row-key="id"
              empty-title="Chưa có thanh toán nào"
            >
              <template #cell-paid_at="{ row }">{{ row.paidAt }}</template>
              <template #cell-amount="{ row }">{{ formatCurrency(row.amount) }}</template>
              <template #cell-payment_method="{ row }">{{ row.paymentMethod ?? '—' }}</template>
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

    <!-- Reissue -->
    <UiModal :open="showReissueModal" title="Phát hành lại sau khi huỷ" @close="showReissueModal = false">
      <div class="space-y-3">
        <p class="text-sm text-muted">Tính lại khoản phí dựa trên dữ liệu hiện tại; hoá đơn mới sẽ liên kết tới hoá đơn đã huỷ.</p>
        <UiSection title="Hạn thanh toán">
          <UiInput v-model="reissueForm.due_date" type="date" class="w-full" />
        </UiSection>
        <UiSection title="Ghi chú">
          <UiInput v-model="reissueForm.notes" placeholder="Tuỳ chọn" class="w-full" />
        </UiSection>
        <UiAlert v-if="reissueError" severity="danger">{{ reissueError }}</UiAlert>
      </div>
      <template #footer>
        <UiButton variant="secondary" :disabled="reissueSubmitting" @click="showReissueModal = false">Huỷ</UiButton>
        <UiButton :loading="reissueSubmitting" @click="submitReissue">Phát hành lại</UiButton>
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
        <UiAlert v-if="adjustmentError" severity="danger">{{ adjustmentError }}</UiAlert>
      </div>
      <template #footer>
        <UiButton variant="secondary" :disabled="adjustmentSubmitting" @click="showAdjustmentModal = false">Huỷ</UiButton>
        <UiButton :loading="adjustmentSubmitting" @click="submitAdjustment">Lưu</UiButton>
      </template>
    </UiModal>
  </div>
</template>
