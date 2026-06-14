<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { Invoice } from '~/types/billing'
import type { BulkPaymentItemInput } from '~/utils/validators/billing'
import { formatCurrency } from '~/utils/format/currency'

interface RowState {
  invoiceId: string
  enabled: boolean
  amount: number
}

const props = defineProps<{
  open: boolean
  invoices: Invoice[]
  /** id of the failing row when the server returns 409 with details */
  failedInvoiceId?: string | null
  errorMessage?: string | null
  submitting?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: BulkPaymentItemInput[]): void
}>()

const today = new Date().toISOString().slice(0, 10)
const form = reactive({
  payment_method: 'cash',
  payment_date: today,
  note: '',
})
const rows = ref<RowState[]>([])

watch(
  () => props.open,
  (open) => {
    if (!open) return
    form.payment_method = 'cash'
    form.payment_date = today
    form.note = ''
    rows.value = props.invoices.map(inv => ({
      invoiceId: inv.id,
      enabled: true,
      amount: inv.balanceAmount,
    }))
  },
  { immediate: true },
)

const invoiceById = computed(() => new Map(props.invoices.map(i => [i.id, i])))

const totalAmount = computed(() =>
  rows.value.reduce((s, r) => (r.enabled ? s + (Number.isFinite(r.amount) ? r.amount : 0) : s), 0),
)
const enabledCount = computed(() => rows.value.filter(r => r.enabled).length)

const validationError = computed<string | null>(() => {
  if (enabledCount.value === 0) return 'Hãy chọn ít nhất 1 hoá đơn'
  if (!form.payment_date) return 'Cần chọn ngày thanh toán'
  for (const r of rows.value) {
    if (!r.enabled) continue
    const inv = invoiceById.value.get(r.invoiceId)
    if (!inv) continue
    if (!Number.isFinite(r.amount) || r.amount <= 0) {
      return `Số tiền cho phòng ${inv.roomNumber ?? inv.id.slice(0, 6)} không hợp lệ`
    }
    if (r.amount > inv.balanceAmount) {
      return `Số tiền cho phòng ${inv.roomNumber ?? inv.id.slice(0, 6)} vượt quá công nợ ${formatCurrency(inv.balanceAmount)}`
    }
  }
  return null
})

function close() {
  emit('close')
}

function submit() {
  if (validationError.value) return
  const payload: BulkPaymentItemInput[] = rows.value
    .filter(r => r.enabled)
    .map(r => ({
      invoice_id: r.invoiceId,
      amount: Math.trunc(r.amount),
      payment_method: form.payment_method.trim() || null,
      payment_date: form.payment_date,
      note: form.note.trim() || null,
    }))
  emit('submit', payload)
}
</script>

<template>
  <UiModal :open="open" title="Ghi thu hàng loạt" size="lg" @close="close">
    <div class="space-y-4">
      <UiAlert v-if="errorMessage" severity="danger">{{ errorMessage }}</UiAlert>
      <UiAlert v-else-if="validationError" severity="warning">{{ validationError }}</UiAlert>

      <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
        <UiSection title="Hình thức">
          <UiInput v-model="form.payment_method" placeholder="cash, bank transfer..." class="w-full" />
        </UiSection>
        <UiSection title="Ngày thanh toán">
          <UiInput v-model="form.payment_date" type="date" class="w-full" />
        </UiSection>
        <UiSection title="Ghi chú chung">
          <UiInput v-model="form.note" placeholder="Tuỳ chọn" class="w-full" />
        </UiSection>
      </div>

      <div class="rounded-lg border border-dark-border">
        <table class="min-w-full text-sm">
          <thead class="bg-dark-card text-xs uppercase tracking-wide text-muted">
            <tr>
              <th class="px-3 py-2 text-left w-10">Chọn</th>
              <th class="px-3 py-2 text-left">Hoá đơn</th>
              <th class="px-3 py-2 text-right tabular-nums w-32">Công nợ</th>
              <th class="px-3 py-2 text-right tabular-nums w-32">Số thu</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-dark-border">
            <tr
              v-for="row in rows"
              :key="row.invoiceId"
              :class="failedInvoiceId === row.invoiceId ? 'bg-rose-500/10' : ''"
            >
              <td class="px-3 py-2 align-middle">
                <input
                  v-model="row.enabled"
                  type="checkbox"
                  class="h-4 w-4"
                >
              </td>
              <td class="px-3 py-2 align-middle">
                <span class="block text-white text-sm">
                  {{ invoiceById.get(row.invoiceId)?.tenantName ?? '—' }}
                  <template v-if="invoiceById.get(row.invoiceId)?.roomNumber">
                    <span class="text-muted">·</span>
                    P.{{ invoiceById.get(row.invoiceId)!.roomNumber }}
                  </template>
                </span>
                <span class="block text-xs text-muted">
                  {{ invoiceById.get(row.invoiceId)?.contractCode ?? row.invoiceId.slice(0, 8) }}
                </span>
              </td>
              <td class="px-3 py-2 text-right tabular-nums text-muted">
                {{ formatCurrency(invoiceById.get(row.invoiceId)?.balanceAmount ?? 0) }}
              </td>
              <td class="px-3 py-2 text-right">
                <UiInput
                  v-model.number="row.amount"
                  type="number"
                  min="0"
                  density="compact"
                  class="w-28 text-right"
                  :disabled="!row.enabled"
                />
              </td>
            </tr>
          </tbody>
          <tfoot class="bg-dark-card text-sm">
            <tr>
              <td class="px-3 py-2" colspan="2">
                <span class="text-muted">{{ enabledCount }} hoá đơn được chọn</span>
              </td>
              <td class="px-3 py-2 text-right text-muted">Tổng</td>
              <td class="px-3 py-2 text-right tabular-nums font-semibold text-white">
                {{ formatCurrency(totalAmount) }}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
    <template #footer>
      <UiButton variant="secondary" :disabled="submitting" @click="close">Đóng</UiButton>
      <UiButton
        variant="primary"
        :disabled="!!validationError || !!submitting"
        @click="submit"
      >
        {{ submitting ? 'Đang ghi…' : `Ghi thu ${formatCurrency(totalAmount)}` }}
      </UiButton>
    </template>
  </UiModal>
</template>
