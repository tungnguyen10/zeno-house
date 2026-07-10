<script setup lang="ts">
import { formatCurrency } from '~/utils/format/currency'
import { groupChargeLines, chargeLineLabel } from '~/utils/billing/charge-groups'
import { chargeTypeUnit, formatViNumber } from '~/utils/billing/meter-display'

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

const groups = computed(() =>
  groupChargeLines(props.lines, { showAdjustments: props.showAdjustments }),
)

const total = computed(() =>
  props.totalAmount ?? props.lines.reduce((sum, line) => sum + line.amount, 0),
)

const hasAdjustments = computed(() => groups.value.some(g => g.key === 'adjustment'))
const subtotalBeforeAdjustment = computed(() =>
  groups.value
    .filter(g => g.key !== 'adjustment')
    .reduce((sum, g) => sum + g.subtotal, 0),
)

function amountTone(line: ChargeBreakdownLine): string {
  if (line.amount < 0 || line.chargeType === 'discount') return 'text-emerald-300'
  return 'text-white'
}

function lineHint(line: ChargeBreakdownLine): string | null {
  const unit = chargeTypeUnit(line.chargeType)
  if (line.chargeType === 'electricity' || line.chargeType === 'water') {
    return `${formatViNumber(line.quantity)} ${unit} × ${formatCurrency(line.unitPrice)}/${unit}`
  }
  if (line.chargeType === 'rent' && line.quantity !== 1) {
    return `${formatViNumber(line.quantity)} × ${formatCurrency(line.unitPrice)}`
  }
  if (line.chargeType === 'service' && line.quantity > 1) {
    return `${formatViNumber(line.quantity)} × ${formatCurrency(line.unitPrice)}`
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
            <p class="text-sm text-white">{{ chargeLineLabel(line.chargeType, line.label) }}</p>
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
