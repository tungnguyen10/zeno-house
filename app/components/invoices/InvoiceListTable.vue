<script setup lang="ts">
import type { UiTableColumn } from '~/components/ui/UiTable.vue'
import type { InvoiceListItem } from '~/utils/validators/invoices'
import { formatCurrency } from '~/utils/format/currency'

defineProps<{
  rows: InvoiceListItem[]
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'open', invoice: InvoiceListItem): void
}>()

const columns: UiTableColumn<InvoiceListItem>[] = [
  { key: 'invoice', label: 'Hoá đơn' },
  { key: 'period', label: 'Kỳ', width: 'w-20', hideOnMobile: true },
  { key: 'building', label: 'Tòa / phòng', hideOnMobile: true },
  { key: 'tenant', label: 'Khách thuê' },
  { key: 'total_amount', label: 'Tổng', numeric: true, width: 'w-28' },
  { key: 'paid_amount', label: 'Đã thu', numeric: true, width: 'w-28', hideOnMobile: true },
  { key: 'balance_amount', label: 'Còn lại', numeric: true, width: 'w-28' },
  { key: 'due_date', label: 'Hạn', width: 'w-28', hideOnMobile: true },
  { key: 'status', label: 'Trạng thái', width: 'w-32' },
]

function periodLabel(row: InvoiceListItem): string {
  return `${String(row.period_month).padStart(2, '0')}/${row.period_year}`
}

function roomLabel(row: InvoiceListItem): string {
  return [row.building_name, row.room_number ? `P.${row.room_number}` : null].filter(Boolean).join(' · ') || '---'
}

function dueLabel(row: InvoiceListItem): string {
  return row.due_date ?? '---'
}
</script>

<template>
  <div class="space-y-2">
    <div class="space-y-2 md:hidden">
      <template v-if="loading">
        <UiSkeleton v-for="n in 10" :key="`invoice-card-skeleton-${n}`" class="h-28 w-full rounded-lg" />
      </template>
      <UiEmptyState
        v-else-if="rows.length === 0"
        title="Không có hoá đơn"
        description="Đổi tháng / building / mở rộng status"
      />
      <button
        v-for="row in rows"
        v-else
        :key="row.id"
        type="button"
        :aria-label="`Mở hoá đơn ${row.invoice_code}`"
        class="w-full rounded-lg border border-dark-border bg-dark-surface p-3 text-left transition hover:bg-dark-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40"
        @click="emit('open', row)"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-white">{{ row.tenant_name ?? 'Khách thuê' }}</p>
            <p class="mt-0.5 truncate text-xs text-muted">{{ roomLabel(row) }}</p>
            <p class="mt-1 truncate text-xs tabular-nums text-muted">{{ row.invoice_code }} · {{ periodLabel(row) }}</p>
            <p v-if="row.tenant_phone" class="mt-0.5 truncate text-xs tabular-nums text-muted">
              {{ row.tenant_phone }}
            </p>
          </div>
          <div class="shrink-0">
            <UiStatusBadge :status="row.status" context="invoice" />
          </div>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <div class="min-w-0">
            <p class="text-muted">Tổng</p>
            <p class="mt-0.5 truncate text-white tabular-nums">{{ formatCurrency(row.total_amount) }}</p>
          </div>
          <div class="min-w-0 text-right">
            <p class="text-muted">Đã thu</p>
            <p class="mt-0.5 truncate text-white tabular-nums">{{ formatCurrency(row.paid_amount) }}</p>
          </div>
          <div class="min-w-0">
            <p class="text-muted">Hạn</p>
            <p class="mt-0.5 truncate text-white tabular-nums">{{ dueLabel(row) }}</p>
          </div>
          <div class="min-w-0 text-right">
            <p class="text-muted">Còn lại</p>
            <p :class="['mt-0.5 truncate tabular-nums', row.balance_amount > 0 ? 'font-medium text-error-vivid' : 'text-success-neon']">
              {{ formatCurrency(row.balance_amount) }}
            </p>
          </div>
        </div>
      </button>
    </div>

    <UiTable
      class="hidden md:block"
      :rows="rows"
      :columns="columns"
      :loading="loading"
      :loading-rows="10"
      empty-title="Không có hoá đơn"
      empty-description="Đổi tháng / building / mở rộng status"
      row-clickable
      @row-click="emit('open', $event)"
    >
      <template #cell-invoice="{ row }">
        <span class="block truncate font-medium text-white">{{ row.invoice_code }}</span>
        <span class="block truncate text-xs text-muted">{{ row.contract_code ?? row.contract_id }}</span>
      </template>
      <template #cell-period="{ row }">
        <span class="tabular-nums">{{ periodLabel(row) }}</span>
      </template>
      <template #cell-building="{ row }">
        <span class="block truncate text-white">{{ row.building_name ?? '---' }}</span>
        <span class="block truncate text-xs text-muted">{{ row.room_number ? `P.${row.room_number}` : row.room_id }}</span>
      </template>
      <template #cell-tenant="{ row }">
        <span class="block truncate text-white">{{ row.tenant_name ?? '---' }}</span>
        <span class="block truncate text-xs text-muted">{{ row.tenant_phone ?? '' }}</span>
      </template>
      <template #cell-total_amount="{ row }">{{ formatCurrency(row.total_amount) }}</template>
      <template #cell-paid_amount="{ row }">
        <span :class="row.paid_amount > 0 ? 'text-white' : 'text-muted'">{{ formatCurrency(row.paid_amount) }}</span>
      </template>
      <template #cell-balance_amount="{ row }">
        <span :class="row.balance_amount > 0 ? 'font-medium text-error-vivid' : 'text-success-neon'">
          {{ formatCurrency(row.balance_amount) }}
        </span>
      </template>
      <template #cell-due_date="{ row }">
        <span :class="row.due_date ? 'tabular-nums' : 'text-muted'">{{ row.due_date ?? '---' }}</span>
      </template>
      <template #cell-status="{ row }">
        <UiStatusBadge :status="row.status" context="invoice" />
      </template>
    </UiTable>
  </div>
</template>
