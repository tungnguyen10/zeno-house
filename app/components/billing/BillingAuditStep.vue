<script setup lang="ts">
import type { UiTableColumn } from '~/components/ui/UiTable.vue'
import type { BillingAuditEvent } from '~/types/billing'

defineProps<{
  events: BillingAuditEvent[]
  loading: boolean
}>()

defineEmits<{ (e: 'refresh'): void }>()

const columns: UiTableColumn<BillingAuditEvent>[] = [
  { key: 'createdAt', label: 'Thời điểm', width: 'w-44' },
  { key: 'action', label: 'Hành động', width: 'w-44' },
  { key: 'entity', label: 'Đối tượng', hideOnMobile: true },
  { key: 'actor', label: 'Người thực hiện', hideOnMobile: true },
  { key: 'metadata', label: 'Chi tiết' },
]

function actionLabel(a: string): string {
  switch (a) {
    case 'period.opened': return 'Mở kỳ'
    case 'period.status_changed': return 'Đổi trạng thái'
    case 'period.closed': return 'Chốt kỳ'
    case 'reading.saved': return 'Lưu chỉ số'
    case 'utility.override_saved': return 'Lưu override'
    case 'invoice.issue_attempted': return 'Phát hành (thất bại)'
    case 'invoices.issued': return 'Phát hành hoá đơn'
    case 'invoice.voided': return 'Huỷ hoá đơn'
    case 'invoice.reissued': return 'Phát hành lại'
    case 'invoice.adjustment_created': return 'Điều chỉnh'
    case 'payment.recorded': return 'Ghi thanh toán'
    default: return a
  }
}

function entityLabel(t: string | null) {
  if (!t) return '—'
  switch (t) {
    case 'billing_period': return 'Kỳ vận hành'
    case 'meter_reading': return 'Chỉ số'
    case 'billing_utility_usage': return 'Override điện/nước'
    case 'invoice': return 'Hoá đơn'
    case 'invoice_charge': return 'Khoản phí'
    case 'invoice_payment': return 'Thanh toán'
    default: return t
  }
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('vi-VN', { hour12: false })
  } catch {
    return iso
  }
}

function snippet(meta: Record<string, unknown> | null | undefined): string {
  if (!meta || Object.keys(meta).length === 0) return '—'
  const entries = Object.entries(meta).slice(0, 3).map(([k, v]) => {
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      return `${k}=${v}`
    }
    return `${k}=…`
  })
  return entries.join(', ')
}
</script>

<template>
  <UiSection title="Nhật ký kỳ vận hành" description="Lịch sử thao tác (audit) của kỳ này, từ mở kỳ đến chốt.">
    <template #actions>
      <UiButton variant="secondary" size="sm" @click="$emit('refresh')">Làm mới</UiButton>
    </template>

    <UiTable
      :rows="events"
      :columns="columns"
      :loading="loading"
      empty-title="Chưa có sự kiện nào"
      empty-description="Audit log sẽ tự động ghi lại khi có thao tác trong kỳ này."
    >
      <template #cell-createdAt="{ row }">{{ formatTime(row.createdAt) }}</template>
      <template #cell-action="{ row }">{{ actionLabel(row.action) }}</template>
      <template #cell-entity="{ row }">{{ entityLabel(row.entityType) }}</template>
      <template #cell-actor="{ row }">{{ row.actorId ?? '—' }}</template>
      <template #cell-metadata="{ row }">{{ snippet(row.metadata) }}</template>
    </UiTable>
  </UiSection>
</template>
