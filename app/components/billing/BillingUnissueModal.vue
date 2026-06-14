<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Invoice } from '~/types/billing'
import { formatCurrency } from '~/utils/format/currency'

const props = defineProps<{
  open: boolean
  invoices: Invoice[]
  submitting?: boolean
  errorMessage?: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', reason: string): void
}>()

const reason = ref('')

watch(
  () => props.open,
  (open) => {
    if (open) reason.value = ''
  },
)

const active = computed(() => props.invoices.filter(i => i.status !== 'void'))
const retained = computed(() => active.value.filter(i => i.paidAmount > 0))
const willVoid = computed(() => active.value.filter(i => i.paidAmount === 0))
const totalRetainedPaid = computed(() => retained.value.reduce((s, i) => s + i.paidAmount, 0))
const totalToVoid = computed(() => willVoid.value.reduce((s, i) => s + i.totalAmount, 0))

const reasonValid = computed(() => reason.value.trim().length >= 10)
const reasonLength = computed(() => reason.value.trim().length)

function submit() {
  if (!reasonValid.value) return
  emit('submit', reason.value.trim())
}
</script>

<template>
  <UiModal :open="open" title="Huỷ phát hành kỳ" size="lg" @close="emit('close')">
    <div class="space-y-4">
      <UiAlert severity="warning">
        Hành động này huỷ tất cả hoá đơn chưa thu (chuyển sang trạng thái void) và đưa kỳ trở về
        trạng thái nhập chỉ số. Hoá đơn đã có thanh toán sẽ <strong>được giữ lại</strong>.
      </UiAlert>

      <div class="grid grid-cols-2 gap-3">
        <div class="rounded-lg border border-dark-border bg-dark-surface p-3">
          <p class="text-xs text-muted">Sẽ huỷ</p>
          <p class="text-lg font-semibold text-rose-400">{{ willVoid.length }} hoá đơn</p>
          <p class="text-xs text-muted tabular-nums">
            Giá trị {{ formatCurrency(totalToVoid) }}
          </p>
        </div>
        <div class="rounded-lg border border-dark-border bg-dark-surface p-3">
          <p class="text-xs text-muted">Giữ lại (đã thu)</p>
          <p class="text-lg font-semibold text-emerald-400">{{ retained.length }} hoá đơn</p>
          <p class="text-xs text-muted tabular-nums">
            Đã thu {{ formatCurrency(totalRetainedPaid) }}
          </p>
        </div>
      </div>

      <UiAlert v-if="errorMessage" severity="danger">{{ errorMessage }}</UiAlert>

      <div class="space-y-1">
        <label for="unissue-reason" class="block text-sm text-white">
          Lý do huỷ phát hành <span class="text-rose-400">*</span>
        </label>
        <UiTextarea
          id="unissue-reason"
          v-model="reason"
          :rows="3"
          placeholder="Bắt buộc — tối thiểu 10 ký tự. Lý do sẽ được lưu vào nhật ký kỳ và áp dụng cho mọi hoá đơn bị huỷ."
        />
        <p class="text-xs" :class="reasonValid ? 'text-muted' : 'text-rose-400'">
          {{ reasonLength }} / 10 ký tự tối thiểu
        </p>
      </div>
    </div>
    <template #footer>
      <UiButton variant="secondary" :disabled="submitting" @click="emit('close')">Đóng</UiButton>
      <UiButton
        variant="danger"
        :disabled="!reasonValid || !!submitting"
        @click="submit"
      >
        {{ submitting ? 'Đang xử lý…' : 'Xác nhận huỷ phát hành' }}
      </UiButton>
    </template>
  </UiModal>
</template>
