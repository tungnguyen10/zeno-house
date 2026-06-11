<script setup lang="ts">
import type { BillingPeriod, BillingWorkspaceOverview } from '~/types/billing'
import { formatCurrency } from '~/utils/format/currency'

const props = defineProps<{
  overview: BillingWorkspaceOverview
  period: BillingPeriod
  canClose: boolean
}>()

const emit = defineEmits<{ closePeriod: [] }>()

const showConfirm = ref(false)
const submitting = ref(false)
const submitError = ref<string | null>(null)

const isAlreadyClosed = computed(() => props.period.status === 'closed')
const hasOutstanding = computed(() => props.overview.outstandingBalance > 0)
const blockReasons = computed<string[]>(() => {
  const reasons: string[] = []
  if (isAlreadyClosed.value) reasons.push('Kỳ đã chốt')
  if (hasOutstanding.value) reasons.push(`Còn công nợ ${formatCurrency(props.overview.outstandingBalance)}`)
  return reasons
})
const canConfirmClose = computed(() => props.canClose && !isAlreadyClosed.value && !hasOutstanding.value)

async function confirmClose() {
  submitting.value = true
  submitError.value = null
  try {
    emit('closePeriod')
    showConfirm.value = false
  } catch (err) {
    const e = err as { data?: { error?: { message?: string } } }
    submitError.value = e.data?.error?.message ?? 'Chốt kỳ thất bại'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UiSection title="Chốt kỳ vận hành" description="Khoá toàn bộ thao tác trên kỳ. Sau khi chốt, không thể chỉnh chỉ số, phát hành hay huỷ hoá đơn nữa.">
    <div class="rounded-xl border border-dark-border bg-dark-surface p-4 space-y-3">
      <div class="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div>
          <p class="text-xs text-muted">Trạng thái</p>
          <UiStatusBadge :status="period.status" context="period" class="mt-1" />
        </div>
        <div>
          <p class="text-xs text-muted">Đã thu</p>
          <p class="text-sm text-success-neon mt-1">{{ formatCurrency(overview.paidTotal) }}</p>
        </div>
        <div>
          <p class="text-xs text-muted">Còn lại</p>
          <p :class="['text-sm mt-1', overview.outstandingBalance > 0 ? 'text-error-vivid' : 'text-success-neon']">
            {{ formatCurrency(overview.outstandingBalance) }}
          </p>
        </div>
      </div>

      <UiAlert v-if="!canClose" severity="warning" title="Bạn không có quyền chốt kỳ">
        Chỉ tài khoản admin mới có thể chốt kỳ.
      </UiAlert>

      <UiAlert v-if="isAlreadyClosed" severity="info" title="Kỳ đã chốt">
        Kỳ này đã được chốt — toàn bộ thao tác chỉnh sửa đã bị khoá.
      </UiAlert>

      <UiAlert v-else-if="hasOutstanding" severity="warning" title="Vẫn còn công nợ">
        Hiện kỳ này vẫn còn {{ formatCurrency(overview.outstandingBalance) }} chưa thu. Hãy ghi nhận hết thanh toán hoặc tạo điều chỉnh phù hợp trước khi chốt.
      </UiAlert>

      <UiAlert v-if="submitError" severity="danger">{{ submitError }}</UiAlert>

      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-2">
        <p v-if="blockReasons.length > 0" class="text-xs text-muted">
          Lý do không thể chốt: {{ blockReasons.join(' · ') }}
        </p>
        <UiButton
          variant="danger"
          :disabled="!canConfirmClose"
          @click="showConfirm = true"
        >
          Chốt kỳ {{ String(period.periodMonth).padStart(2, '0') }}/{{ period.periodYear }}
        </UiButton>
      </div>
    </div>

    <UiConfirmModal
      :open="showConfirm"
      title="Xác nhận chốt kỳ"
      :message="`Sau khi chốt, không thể phát hành thêm hoá đơn, chỉnh chỉ số, hay huỷ/điều chỉnh hoá đơn của kỳ ${String(period.periodMonth).padStart(2, '0')}/${period.periodYear}. Tiếp tục?`"
      confirm-label="Chốt kỳ"
      :loading="submitting"
      @confirm="confirmClose"
      @cancel="showConfirm = false"
    />
  </UiSection>
</template>
