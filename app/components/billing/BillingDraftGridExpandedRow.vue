<script setup lang="ts">
import { computed } from 'vue'
import type { BillingDraftGridRow, BillingDraftGridUtilityCell, BillingDraftLine, BillingPeriod } from '~/types/billing'
import { formatCurrency } from '~/utils/format/currency'

const props = defineProps<{
  row: BillingDraftGridRow
  period: BillingPeriod | null
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'intent:adjustment', payload: { invoiceId: string; amount: number; label: string }): void
  (e: 'intent:void-reissue', payload: { invoiceId: string }): void
}>()

type GroupKey = 'rent' | 'utility' | 'service' | 'adjustment'

interface LineGroup {
  key: GroupKey
  title: string
  lines: BillingDraftLine[]
  subtotal: number
}

const sortedLines = computed<BillingDraftLine[]>(() =>
  [...props.row.lines].sort((a, b) => a.sortOrder - b.sortOrder),
)

const groups = computed<LineGroup[]>(() => {
  const buckets: Record<GroupKey, BillingDraftLine[]> = {
    rent: [],
    utility: [],
    service: [],
    adjustment: [],
  }

  for (const line of sortedLines.value) {
    switch (line.chargeType) {
      case 'rent':
        buckets.rent.push(line)
        break
      case 'electricity':
      case 'water':
        buckets.utility.push(line)
        break
      case 'service':
        buckets.service.push(line)
        break
      case 'discount':
      case 'surcharge':
      case 'adjustment':
        buckets.adjustment.push(line)
        break
      default:
        buckets.service.push(line)
    }
  }

  const titles: Record<GroupKey, string> = {
    rent: 'Tiền phòng',
    utility: 'Tiện ích',
    service: 'Dịch vụ',
    adjustment: 'Điều chỉnh',
  }

  const order: GroupKey[] = ['rent', 'utility', 'service', 'adjustment']
  return order
    .filter(key => buckets[key].length > 0)
    .map<LineGroup>(key => ({
      key,
      title: titles[key],
      lines: buckets[key],
      subtotal: buckets[key].reduce((sum, line) => sum + line.amount, 0),
    }))
})

const totalAmount = computed(() =>
  props.row.draftTotal ?? sortedLines.value.reduce((sum, line) => sum + line.amount, 0),
)

const hasAdjustments = computed(() => groups.value.some(group => group.key === 'adjustment'))
const subtotalBeforeAdjustment = computed(() =>
  groups.value
    .filter(group => group.key !== 'adjustment')
    .reduce((sum, group) => sum + group.subtotal, 0),
)

const periodLabel = computed(() => {
  if (!props.period) return null
  const month = String(props.period.periodMonth).padStart(2, '0')
  return `${month}/${props.period.periodYear}`
})

function meterCell(line: BillingDraftLine): BillingDraftGridUtilityCell | null {
  if (line.chargeType === 'electricity') return props.row.electricity
  if (line.chargeType === 'water') return props.row.water
  return null
}

function unitFor(line: BillingDraftLine): string {
  if (line.chargeType === 'electricity') return 'kWh'
  if (line.chargeType === 'water') return 'm³'
  return ''
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value)
}

function formatReading(value: number | null): string {
  return value === null ? '—' : formatNumber(value)
}

function formatRate(value: number | null, unit: string): string {
  if (value === null) return '—'
  return unit ? `${formatCurrency(value)}/${unit}` : formatCurrency(value)
}

function lineLabel(line: BillingDraftLine): string {
  if (line.chargeType === 'rent') return 'Tiền thuê tháng'
  if (line.chargeType === 'electricity') return 'Điện'
  if (line.chargeType === 'water') return 'Nước'
  if (line.chargeType === 'discount') return line.label || 'Giảm giá'
  if (line.chargeType === 'surcharge') return line.label || 'Phụ thu'
  if (line.chargeType === 'adjustment') return line.label || 'Điều chỉnh'
  return line.label
}

function amountTone(line: BillingDraftLine): string {
  if (line.amount < 0 || line.chargeType === 'discount') return 'text-emerald-300'
  return 'text-white'
}
</script>

<template>
  <div class="space-y-4">
    <!-- Context strip -->
    <div class="flex items-center justify-between text-xs text-muted">
      <span v-if="row.tenantName" class="truncate">{{ row.tenantName }}</span>
      <span v-if="periodLabel" class="shrink-0">Kỳ {{ periodLabel }}</span>
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

    <!-- Bill -->
    <div
      v-if="groups.length > 0"
      class="overflow-hidden rounded-lg border border-dark-border bg-dark-surface"
    >
      <div
        v-for="(group, groupIndex) in groups"
        :key="group.key"
        :class="['px-4 py-3', groupIndex > 0 && 'border-t border-dark-border']"
      >
        <p class="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted">
          {{ group.title }}
        </p>

        <ul class="space-y-1.5">
          <li
            v-for="(line, lineIndex) in group.lines"
            :key="`${group.key}-${lineIndex}`"
            class="flex items-baseline justify-between gap-3"
          >
            <div class="min-w-0 flex-1">
              <p class="text-sm text-white">
                {{ lineLabel(line) }}
                <span
                  v-if="line.chargeType === 'service' && line.quantity > 1"
                  class="text-muted"
                >
                  × {{ formatNumber(line.quantity) }}
                </span>
              </p>
              <p
                v-if="meterCell(line)"
                class="mt-0.5 text-xs text-muted tabular-nums"
              >
                <template v-if="meterCell(line)!.previousValue !== null || meterCell(line)!.currentValue !== null">
                  {{ formatReading(meterCell(line)!.previousValue) }}
                  <span class="opacity-60">→</span>
                  {{ formatReading(meterCell(line)!.currentValue) }}
                  <span class="opacity-60">·</span>
                </template>
                {{ formatNumber(line.quantity) }} {{ unitFor(line) }}
                <span class="opacity-60">×</span>
                {{ formatRate(line.unitPrice, unitFor(line)) }}
              </p>
              <p
                v-else-if="line.chargeType === 'rent' && line.quantity !== 1"
                class="mt-0.5 text-xs text-muted tabular-nums"
              >
                {{ formatNumber(line.quantity) }} × {{ formatCurrency(line.unitPrice) }}
              </p>
            </div>
            <span :class="['shrink-0 text-sm tabular-nums', amountTone(line)]">
              {{ formatCurrency(line.amount) }}
            </span>
          </li>
        </ul>
      </div>

      <div
        v-if="hasAdjustments"
        class="flex items-baseline justify-between border-t border-dark-border px-4 py-2 text-xs text-muted"
      >
        <span>Tạm tính</span>
        <span class="tabular-nums">{{ formatCurrency(subtotalBeforeAdjustment) }}</span>
      </div>

      <div class="flex items-baseline justify-between border-t border-dark-border bg-dark-card px-4 py-3">
        <span class="text-xs font-medium uppercase tracking-wider text-muted">Tổng cộng</span>
        <span class="text-lg font-semibold text-white tabular-nums">
          {{ formatCurrency(totalAmount) }}
        </span>
      </div>
    </div>
  </div>
</template>
