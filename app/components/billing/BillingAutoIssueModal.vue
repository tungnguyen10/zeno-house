<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { BillingDraftGridRow } from '~/types/billing'
import { formatCurrency } from '~/utils/format/currency'

const props = defineProps<{
  open: boolean
  row: BillingDraftGridRow | null
  submitting?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: { payment_date: string; payment_method: string | null; note: string | null }): void
}>()

const today = new Date().toISOString().slice(0, 10)

const form = reactive({
  payment_date: today,
  payment_method: 'cash',
  note: '',
})

const error = ref<string | null>(null)

const draftTotal = computed(() => props.row?.draftTotal ?? 0)

watch(
  () => props.open,
  (open) => {
    if (open) {
      form.payment_date = today
      form.payment_method = 'cash'
      form.note = ''
      error.value = null
    }
  },
)

function submit() {
  error.value = null
  if (!props.row?.contractId) {
    error.value = 'Dòng này chưa sẵn sàng để phát hành.'
    return
  }
  if (!form.payment_date) {
    error.value = 'Cần ngày thanh toán.'
    return
  }
  emit('submit', {
    payment_date: form.payment_date,
    payment_method: form.payment_method.trim() || null,
    note: form.note.trim() || null,
  })
}
</script>

<template>
  <UiModal :open="open" title="Phát hành & thu" size="md" @close="emit('close')">
    <div v-if="row" class="space-y-4">
      <p class="text-sm text-muted">
        Phòng <span class="font-semibold text-white">P{{ row.roomNumber ?? '—' }}</span>
        <span v-if="row.tenantName"> · {{ row.tenantName }}</span>
      </p>

      <div class="rounded-lg border border-dark-border bg-dark-surface p-3">
        <div class="flex items-center justify-between">
          <span class="text-xs text-muted">Tổng thu</span>
          <span class="text-lg font-semibold tabular-nums text-white">{{ formatCurrency(draftTotal) }}</span>
        </div>
        <p class="mt-1 text-[11px] text-muted">
          Phát hành hoá đơn và ghi nhận đã thu đủ trong một thao tác.
        </p>
      </div>

      <div class="space-y-1">
        <label class="text-xs text-muted">Ngày thanh toán</label>
        <UiDatePicker v-model="form.payment_date" date-mode="payment" class="w-full" />
      </div>

      <div class="space-y-1">
        <label class="text-xs text-muted">Hình thức</label>
        <UiInput v-model="form.payment_method" placeholder="cash, bank transfer..." class="w-full" />
      </div>

      <div class="space-y-1">
        <label class="text-xs text-muted">Ghi chú (tuỳ chọn)</label>
        <UiTextarea v-model="form.note" :rows="2" class="w-full" />
      </div>

      <p v-if="error" class="text-xs text-rose-400">{{ error }}</p>
    </div>

    <template #footer>
      <UiButton variant="ghost" :disabled="submitting" @click="emit('close')">Huỷ</UiButton>
      <UiButton variant="primary" :disabled="submitting || !row?.contractId" @click="submit">
        {{ submitting ? 'Đang xử lý…' : 'Phát hành & thu' }}
      </UiButton>
    </template>
  </UiModal>
</template>
