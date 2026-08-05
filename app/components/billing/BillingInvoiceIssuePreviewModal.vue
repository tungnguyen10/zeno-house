<script setup lang="ts">
import type { BillingInvoiceIssuePreview } from '~/types/billing'
import { formatCurrency } from '~/utils/format/currency'

const props = defineProps<{
  open: boolean
  preview: BillingInvoiceIssuePreview | null
  dueDate: string
  loading: boolean
  submitting: boolean
  error: string | null
  stale?: boolean
}>()

const emit = defineEmits<{
  (e: 'close' | 'refresh' | 'confirm'): void
  (e: 'update:dueDate', value: string): void
}>()

const exclusionsLabel = computed(() => {
  if (!props.preview) return ''
  const parts: string[] = []
  if (props.preview.blockedCount) parts.push(`${props.preview.blockedCount} phiếu bị chặn`)
  if (props.preview.alreadyIssuedCount) parts.push(`${props.preview.alreadyIssuedCount} phiếu đã phát hành`)
  return parts.join(' · ')
})
</script>

<template>
  <UiModal
    :open="open"
    title="Xem trước hóa đơn"
    size="xl"
    mobile-fullscreen
    @close="!submitting && emit('close')"
  >
    <div class="space-y-4">
      <section class="sticky -top-4 z-10 -mx-6 -mt-4 border-b border-dark-border bg-dark-card px-6 py-4" aria-label="Tóm tắt phát hành">
        <div class="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_15rem] sm:items-end">
          <div class="min-w-0">
            <p class="text-sm text-muted">Lô đang duyệt</p>
            <p class="mt-1 text-lg font-semibold tabular-nums text-white">
              {{ preview?.issuableCount ?? 0 }} hóa đơn · {{ formatCurrency(preview?.totalAmount ?? 0) }}
            </p>
            <p class="mt-1 text-xs leading-relaxed text-muted">
              Hóa đơn sau phát hành có thể được hủy/void theo quy trình có lưu vết kiểm toán.
            </p>
          </div>
          <UiDatePicker
            :model-value="dueDate"
            label="Hạn thanh toán chung"
            date-mode="future"
            :clearable="false"
            :disabled="loading || submitting"
            class="w-full"
            @update:model-value="emit('update:dueDate', $event)"
          />
        </div>
      </section>

      <UiAlert v-if="error" severity="danger" title="Không thể xác nhận bản xem trước">
        <p>{{ error }}</p>
        <UiButton v-if="stale" variant="ghost" size="sm" class="mt-2 whitespace-nowrap" @click="emit('refresh')">
          Tải lại bản xem trước
        </UiButton>
      </UiAlert>

      <UiAlert v-if="preview && preview.exclusions.length" severity="warning" title="Một số phiếu không nằm trong lô">
        <p>{{ exclusionsLabel }}</p>
        <ul class="mt-2 list-disc space-y-1 pl-5">
          <li v-for="item in preview.exclusions" :key="item.contractId">
            Phòng {{ item.roomNumber ?? '—' }} · {{ item.messages.join('; ') }}
          </li>
        </ul>
      </UiAlert>

      <div v-if="loading" class="space-y-4" aria-live="polite">
        <UiSkeleton class="h-72 w-full" />
        <UiSkeleton class="h-72 w-full" />
      </div>
      <UiEmptyState
        v-else-if="!preview || preview.items.length === 0"
        title="Không có hóa đơn sẵn sàng"
        description="Kiểm tra các cảnh báo hoặc tải lại dữ liệu kỳ trước khi phát hành."
      />
      <div v-else class="space-y-5 bg-slate-100 p-2 sm:rounded-xl sm:p-4" aria-live="polite">
        <InvoicePrintCard v-for="item in preview.items" :key="item.key" :item="item" />
      </div>
    </div>

    <template #footer>
      <UiButton variant="ghost" class="whitespace-nowrap" :disabled="submitting" @click="emit('close')">Đóng</UiButton>
      <UiButton
        variant="primary"
        class="whitespace-nowrap"
        :loading="submitting"
        :disabled="loading || stale || !preview || preview.items.length === 0"
        @click="emit('confirm')"
      >
        Phát hành {{ preview?.issuableCount ?? 0 }} hóa đơn
      </UiButton>
    </template>
  </UiModal>
</template>
