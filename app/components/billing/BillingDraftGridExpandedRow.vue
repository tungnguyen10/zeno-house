<script setup lang="ts">
import type { UiTableColumn } from '~/components/ui/UiTable.vue'
import type { BillingDraftGridRow, BillingDraftLine, BillingPeriod } from '~/types/billing'
import { formatCurrency } from '~/utils/format/currency'

defineProps<{
  row: BillingDraftGridRow
  period: BillingPeriod | null
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'intent:adjustment', payload: { invoiceId: string; amount: number; label: string }): void
  (e: 'intent:void-reissue', payload: { invoiceId: string }): void
}>()

const lineColumns: UiTableColumn<BillingDraftLine>[] = [
  { key: 'label', label: 'Khoản phí' },
  { key: 'quantity', label: 'SL', numeric: true, hideOnMobile: true, width: 'w-20', accessor: row => row.quantity },
  { key: 'unitPrice', label: 'Đơn giá', numeric: true, hideOnMobile: true, width: 'w-32' },
  { key: 'amount', label: 'Thành tiền', numeric: true, width: 'w-32' },
]

function chargeTypeLabel(type: string) {
  switch (type) {
    case 'rent': return 'Tiền thuê'
    case 'electricity': return 'Điện'
    case 'water': return 'Nước'
    case 'service': return 'Dịch vụ'
    case 'discount': return 'Giảm giá'
    case 'surcharge': return 'Phụ thu'
    case 'adjustment': return 'Điều chỉnh'
    default: return type
  }
}
</script>

<template>
  <div class="mt-3 rounded-lg border border-dark-border bg-dark-surface p-4 space-y-3">
    <div class="flex items-center justify-between">
      <p class="text-sm font-semibold text-white">
        Chi tiết phòng {{ row.roomNumber ?? '—' }}
        <span v-if="row.tenantName" class="text-muted">· {{ row.tenantName }}</span>
      </p>
      <UiButton variant="ghost" size="sm" @click="$emit('close')">Đóng</UiButton>
    </div>

    <UiAlert
      v-for="blocker in row.blockers"
      :key="`b-${blocker.code}`"
      severity="danger"
      :title="blocker.code"
    >
      {{ blocker.message }}
    </UiAlert>
    <UiAlert
      v-for="warning in row.warnings"
      :key="`w-${warning.code}`"
      severity="warning"
      :title="warning.code"
    >
      {{ warning.message }}
    </UiAlert>

    <BillingDraftDiscrepancyCallout
      v-if="period"
      :draft="row"
      :period="period"
      @intent:adjustment="$emit('intent:adjustment', $event)"
      @intent:void-reissue="$emit('intent:void-reissue', $event)"
    />

    <UiTable
      v-if="row.lines.length > 0"
      :columns="lineColumns"
      :rows="[...row.lines].sort((a, b) => a.sortOrder - b.sortOrder)"
      row-key="sortOrder"
    >
      <template #cell-label="{ row: line }">
        <span class="text-white">
          {{ chargeTypeLabel((line as BillingDraftLine).chargeType) }}
          <span class="text-muted">· {{ (line as BillingDraftLine).label }}</span>
        </span>
      </template>
      <template #cell-unitPrice="{ row: line }">
        {{ formatCurrency((line as BillingDraftLine).unitPrice) }}
      </template>
      <template #cell-amount="{ row: line }">
        {{ formatCurrency((line as BillingDraftLine).amount) }}
      </template>
    </UiTable>
  </div>
</template>
