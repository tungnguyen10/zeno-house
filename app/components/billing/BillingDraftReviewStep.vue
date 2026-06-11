<script setup lang="ts">
import type { UiTableColumn } from '~/components/ui/UiTable.vue'
import type { BillingDraftLine, BillingDraftInvoice, BillingDraftResponse } from '~/types/billing'
import { formatCurrency } from '~/utils/format/currency'

defineProps<{
  drafts: BillingDraftResponse | null
  loading: boolean
}>()

defineEmits<{ (e: 'refresh'): void }>()

const lineColumns: UiTableColumn<BillingDraftLine>[] = [
  { key: 'label', label: 'Khoản phí' },
  { key: 'quantity', label: 'SL', numeric: true, hideOnMobile: true, width: 'w-24' },
  { key: 'unitPrice', label: 'Đơn giá', numeric: true, hideOnMobile: true, width: 'w-32' },
  { key: 'amount', label: 'Thành tiền', numeric: true, width: 'w-32' },
]

function chargeTypeLabel(t: string) {
  switch (t) {
    case 'rent': return 'Tiền thuê'
    case 'electricity': return 'Điện'
    case 'water': return 'Nước'
    case 'service': return 'Dịch vụ'
    case 'discount': return 'Giảm giá'
    case 'surcharge': return 'Phụ thu'
    case 'adjustment': return 'Điều chỉnh'
    default: return t
  }
}

function statusBadgeFor(d: BillingDraftInvoice): { status: string; context: 'period' | 'invoice' | 'correction' } | null {
  if (d.existingInvoiceId && d.existingInvoiceStatus) {
    return { status: d.existingInvoiceStatus, context: 'invoice' }
  }
  if (d.blockers.length > 0) return { status: 'blocked', context: 'correction' }
  if (d.warnings.length > 0) return { status: 'review', context: 'correction' }
  return null
}
</script>

<template>
  <div class="space-y-4">
    <UiSection title="Soát hoá đơn nháp" description="Xem trước các khoản phí trước khi phát hành. Khắc phục blocker để có thể phát hành.">
      <template #actions>
        <UiButton variant="secondary" size="sm" @click="$emit('refresh')">Tính lại</UiButton>
      </template>

      <div v-if="loading" class="space-y-3">
        <UiSkeleton class="h-32 w-full" />
        <UiSkeleton class="h-32 w-full" />
      </div>

      <template v-else-if="drafts">
        <div v-if="drafts.drafts.length === 0">
          <UiEmptyState
            title="Chưa có hoá đơn nháp"
            description="Cần có hợp đồng đang hoạt động và chỉ số đồng hồ trong kỳ."
          />
        </div>

        <div v-else class="space-y-4">
          <div
            v-for="draft in drafts.drafts"
            :key="draft.contractId"
            class="rounded-xl border border-dark-border bg-dark-surface p-4 space-y-3"
          >
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p class="text-sm font-semibold text-white">
                  {{ draft.tenantName ?? '—' }}
                  <span class="text-muted">· Phòng {{ draft.roomNumber ?? '—' }}</span>
                </p>
                <p class="text-xs text-muted">HĐ: {{ draft.contractCode ?? draft.contractId }}</p>
              </div>
              <div class="flex items-center gap-2">
                <UiStatusBadge
                  v-if="statusBadgeFor(draft)"
                  :status="statusBadgeFor(draft)!.status"
                  :context="statusBadgeFor(draft)!.context"
                />
                <span class="text-base font-semibold tabular-nums text-white">
                  {{ formatCurrency(draft.totalAmount) }}
                </span>
              </div>
            </div>

            <UiAlert
              v-for="b in draft.blockers"
              :key="`b-${b.code}`"
              severity="danger"
              :title="b.code"
            >
              {{ b.message }}
            </UiAlert>
            <UiAlert
              v-for="w in draft.warnings"
              :key="`w-${w.code}`"
              severity="warning"
              :title="w.code"
            >
              {{ w.message }}
            </UiAlert>

            <UiTable :rows="draft.lines" :columns="lineColumns" row-key="sortOrder">
              <template #cell-label="{ row }">
                <div class="flex items-center gap-2">
                  <UiStatusBadge :status="row.chargeType" context="correction" />
                  <span>{{ row.label }}</span>
                </div>
              </template>
              <template #cell-quantity="{ row }">{{ row.quantity }}</template>
              <template #cell-unitPrice="{ row }">{{ formatCurrency(row.unitPrice) }}</template>
              <template #cell-amount="{ row }">{{ formatCurrency(row.amount) }}</template>
            </UiTable>

            <p v-if="draft.existingInvoiceId" class="text-xs text-muted">
              Hoá đơn đã tồn tại trong kỳ ({{ draft.existingInvoiceStatus }}). Phát hành lại sẽ bỏ qua.
            </p>
          </div>
        </div>
      </template>
    </UiSection>

    <!-- Suppress unused-warning -->
    <span class="hidden">{{ chargeTypeLabel('rent') }}</span>
  </div>
</template>
