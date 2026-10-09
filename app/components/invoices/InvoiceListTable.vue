<script setup lang="ts">
import type { UiTableColumn } from '~/components/ui/UiTable.vue'
import type { InvoiceListItem } from '~/utils/validators/invoices'
import { formatCurrency } from '~/utils/format/currency'

withDefaults(defineProps<{
  rows: InvoiceListItem[]
  loading?: boolean
  selectedIds?: Set<string>
}>(), {
  selectedIds: () => new Set<string>(),
})

const emit = defineEmits<{
  (e: 'open' | 'toggle-select', invoice: InvoiceListItem): void
}>()

const columns: UiTableColumn<InvoiceListItem>[] = [
  { key: 'select', label: '', width: 'w-10' },
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
    <div class="md:hidden">
      <div v-if="loading" class="space-y-2">
        <UiSkeleton v-for="n in 10" :key="`invoice-card-skeleton-${n}`" class="h-20 w-full rounded-lg" />
      </div>
      <UiEmptyState
        v-else-if="rows.length === 0"
        title="Không có hoá đơn"
        description="Đổi tháng / building / mở rộng status"
      />
      <div v-else class="divide-y divide-ui-border overflow-hidden rounded-xl border border-ui-border bg-ui-surface">
      <div
        v-for="row in rows"
        :key="row.id"
        class="flex items-start gap-3 p-3 transition hover:bg-ui-hover"
      >
        <UiCheckbox
          v-if="row.status !== 'void'"
          shape="circle"
          class="mt-0.5 shrink-0"
          :model-value="selectedIds.has(row.id)"
          :aria-label="`Chọn hoá đơn ${row.invoice_code}`"
          @update:model-value="emit('toggle-select', row)"
        />
        <!-- Void rows aren't selectable; keep the text column aligned with the rest. -->
        <span v-else class="mt-0.5 size-4 shrink-0" aria-hidden="true" />

        <UiButton
          unstyled
          :aria-label="`Mở hoá đơn ${row.invoice_code}`"
          class="min-w-0 flex-1 rounded-md text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/40"
          @click="emit('open', row)"
        >
          <div class="flex items-baseline justify-between gap-3">
            <p class="min-w-0 truncate text-sm font-medium text-ui-primary">
              {{ row.tenant_name ?? 'Khách thuê' }}
            </p>
            <p class="shrink-0 text-sm font-medium tabular-nums text-ui-primary">
              {{ formatCurrency(row.total_amount) }}
            </p>
          </div>

          <div class="mt-1 flex items-center justify-between gap-2">
            <p class="min-w-0 truncate text-xs text-ui-muted">
              {{ roomLabel(row) }} · {{ periodLabel(row) }}
            </p>
            <div class="flex shrink-0 items-center gap-1.5">
              <UiStatusBadge :status="row.status" context="invoice" />
              <IconChevronRight class="h-4 w-4 shrink-0 text-ui-muted" aria-hidden="true" />
            </div>
          </div>

          <div class="mt-1 flex items-baseline justify-between gap-2">
            <p class="min-w-0 truncate text-xs tabular-nums text-ui-muted">{{ row.invoice_code }}</p>
            <p v-if="row.balance_amount > 0" class="shrink-0 text-xs tabular-nums text-status-danger">
              Còn {{ formatCurrency(row.balance_amount) }} · hạn {{ dueLabel(row) }}
            </p>
          </div>
        </UiButton>
      </div>
      </div>
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
      <template #cell-select="{ row }">
        <UiCheckbox
          v-if="row.status !== 'void'"
          :model-value="selectedIds.has(row.id)"
          :aria-label="`Chọn hoá đơn ${row.invoice_code}`"
          @update:model-value="emit('toggle-select', row)"
          @click.stop
        />
      </template>
      <template #cell-invoice="{ row }">
        <span class="block truncate font-medium text-ui-primary">{{ row.invoice_code }}</span>
        <span class="block truncate text-xs text-ui-muted">{{ row.contract_code ?? row.contract_id }}</span>
      </template>
      <template #cell-period="{ row }">
        <span class="tabular-nums">{{ periodLabel(row) }}</span>
      </template>
      <template #cell-building="{ row }">
        <span class="block truncate text-ui-primary">{{ row.building_name ?? '---' }}</span>
        <span class="block truncate text-xs text-ui-muted">{{ row.room_number ? `P.${row.room_number}` : row.room_id }}</span>
      </template>
      <template #cell-tenant="{ row }">
        <span class="block truncate text-ui-primary">{{ row.tenant_name ?? '---' }}</span>
        <span class="block truncate text-xs text-ui-muted">{{ row.tenant_phone ?? '' }}</span>
      </template>
      <template #cell-total_amount="{ row }">{{ formatCurrency(row.total_amount) }}</template>
      <template #cell-paid_amount="{ row }">
        <span :class="row.paid_amount > 0 ? 'text-ui-primary' : 'text-ui-muted'">{{ formatCurrency(row.paid_amount) }}</span>
      </template>
      <template #cell-balance_amount="{ row }">
        <span :class="row.balance_amount > 0 ? 'font-medium text-status-danger' : 'text-status-success'">
          {{ formatCurrency(row.balance_amount) }}
        </span>
      </template>
      <template #cell-due_date="{ row }">
        <span :class="row.due_date ? 'tabular-nums' : 'text-ui-muted'">{{ row.due_date ?? '---' }}</span>
      </template>
      <template #cell-status="{ row }">
        <UiStatusBadge :status="row.status" context="invoice" />
      </template>
    </UiTable>
  </div>
</template>
