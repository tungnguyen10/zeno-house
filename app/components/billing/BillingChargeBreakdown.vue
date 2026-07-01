<script setup lang="ts">
import { computed } from 'vue'
import { formatCurrency } from '~/utils/format/currency'

export interface ChargeBreakdownLine {
  chargeType: string
  label: string
  quantity: number
  unitPrice: number
  amount: number
  sortOrder: number
}

const props = withDefaults(defineProps<{
  lines: ChargeBreakdownLine[]
  totalAmount?: number
  totalLabel?: string
  showAdjustments?: boolean
}>(), {
  totalLabel: 'Tổng cộng',
  showAdjustments: false,
})

type GroupKey = 'rent' | 'utility' | 'service' | 'adjustment'

interface LineGroup {
  key: GroupKey
  title: string
  lines: ChargeBreakdownLine[]
  subtotal: number
}

const sortedLines = computed(() =>
  [...props.lines].sort((a, b) => a.sortOrder - b.sortOrder),
)

const groups = computed<LineGroup[]>(() => {
  const buckets: Record<GroupKey, ChargeBreakdownLine[]> = {
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
    .filter(key => props.showAdjustments || key !== 'adjustment')
    .map<LineGroup>(key => ({
      key,
      title: titles[key],
      lines: buckets[key],
      subtotal: buckets[key].reduce((sum, line) => sum + line.amount, 0),
    }))
})

const total = computed(() =>
  props.totalAmount ?? sortedLines.value.reduce((sum, line) => sum + line.amount, 0),
)

const hasAdjustments = computed(() => groups.value.some(g => g.key === 'adjustment'))
const subtotalBeforeAdjustment = computed(() =>
  groups.value
    .filter(g => g.key !== 'adjustment')
    .reduce((sum, g) => sum + g.subtotal, 0),
)

function lineLabel(line: ChargeBreakdownLine): string {
  if (line.chargeType === 'rent') return 'Tiền thuê tháng'
  if (line.chargeType === 'electricity') return 'Điện'
  if (line.chargeType === 'water') return 'Nước'
  if (line.chargeType === 'discount') return line.label || 'Giảm giá'
  if (line.chargeType === 'surcharge') return line.label || 'Phụ thu'
  if (line.chargeType === 'adjustment') return line.label || 'Điều chỉnh'
  return line.label
}

function amountTone(line: ChargeBreakdownLine): string {
  if (line.amount < 0 || line.chargeType === 'discount') return 'text-emerald-300'
  return 'text-white'
}

function unitFor(line: ChargeBreakdownLine): string {
  if (line.chargeType === 'electricity') return 'kWh'
  if (line.chargeType === 'water') return 'm³'
  return ''
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value)
}

function lineHint(line: ChargeBreakdownLine): string | null {
  const unit = unitFor(line)
  if (line.chargeType === 'electricity' || line.chargeType === 'water') {
    return `${formatNumber(line.quantity)} ${unit} × ${formatCurrency(line.unitPrice)}/${unit}`
  }
  if (line.chargeType === 'rent' && line.quantity !== 1) {
    return `${formatNumber(line.quantity)} × ${formatCurrency(line.unitPrice)}`
  }
  if (line.chargeType === 'service' && line.quantity > 1) {
    return `${formatNumber(line.quantity)} × ${formatCurrency(line.unitPrice)}`
  }
  return null
}
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-dark-border bg-dark-surface">
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
            <p class="text-sm text-white">{{ lineLabel(line) }}</p>
            <slot name="line-extra" :line="line">
              <p
                v-if="lineHint(line)"
                class="mt-0.5 text-xs text-muted tabular-nums"
              >
                {{ lineHint(line) }}
              </p>
            </slot>
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
      <span class="text-xs font-medium uppercase tracking-wider text-muted">{{ totalLabel }}</span>
      <span class="text-lg font-semibold text-white tabular-nums">
        {{ formatCurrency(total) }}
      </span>
    </div>
  </div>
</template>
