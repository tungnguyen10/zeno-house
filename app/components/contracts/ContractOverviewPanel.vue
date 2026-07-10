<script setup lang="ts">
import type { ContractWithDetails } from '~/types/contracts'
import { formatCurrency } from '~/utils/format/currency'
import { formatViDate } from '~/utils/format/time'

const props = defineProps<{
  contract: ContractWithDetails
  activeOccupantCount: number
}>()

type LifecycleTone = 'default' | 'warning' | 'danger' | 'muted'

const lifecycle = computed<{ percent: number, label: string, tone: LifecycleTone } | null>(() => {
  const c = props.contract
  if (c.status === 'terminated') return { percent: 100, label: 'Đã kết thúc trước hạn', tone: 'danger' }
  if (c.status === 'renewed') return { percent: 100, label: 'Đã gia hạn', tone: 'muted' }

  const start = new Date(c.startDate).getTime()
  const end = new Date(c.endDate).getTime()
  const now = Date.now()
  const total = end - start
  const elapsed = now - start
  const percent = total <= 0 ? 100 : Math.max(0, Math.min(100, (elapsed / total) * 100))
  const day = 24 * 60 * 60 * 1000
  const remainingDays = Math.ceil((end - now) / day)

  if (remainingDays <= 0) return { percent: 100, label: 'Đã hết hạn', tone: 'warning' }
  if (remainingDays <= 30) return { percent, label: `Còn ${remainingDays} ngày`, tone: 'warning' }
  const monthsRemaining = Math.round(remainingDays / 30)
  return {
    percent,
    label: monthsRemaining === 1 ? 'Còn 1 tháng' : `Còn ${monthsRemaining} tháng`,
    tone: 'default',
  }
})

const lifecycleBarClass: Record<LifecycleTone, string> = {
  default: 'bg-cyan',
  warning: 'bg-warning',
  danger: 'bg-error-vivid',
  muted: 'bg-dark-hover',
}
const lifecycleTextClass: Record<LifecycleTone, string> = {
  default: 'text-white',
  warning: 'text-warning',
  danger: 'text-error-vivid',
  muted: 'text-muted',
}
</script>

<template>
  <div id="overview" class="mt-6 scroll-mt-20 rounded-xl border border-dark-border bg-dark-surface p-6 space-y-5">
    <!-- Lifecycle ribbon -->
    <div v-if="lifecycle">
      <div class="flex items-end justify-between text-xs mb-2">
        <div>
          <p class="text-muted uppercase tracking-wide">Bắt đầu</p>
          <p class="text-white tabular-nums mt-0.5">{{ formatViDate(contract.startDate) }}</p>
        </div>
        <p :class="['text-sm font-medium tabular-nums', lifecycleTextClass[lifecycle.tone]]">
          {{ lifecycle.label }}
        </p>
        <div class="text-right">
          <p class="text-muted uppercase tracking-wide">Kết thúc</p>
          <p class="text-white tabular-nums mt-0.5">{{ formatViDate(contract.endDate) }}</p>
          <p
            v-if="contract.originalEndDate && contract.originalEndDate !== contract.endDate"
            class="text-muted tabular-nums mt-0.5"
          >
            gốc {{ formatViDate(contract.originalEndDate) }}
          </p>
        </div>
      </div>
      <div class="relative h-1.5 rounded-full bg-dark-border overflow-hidden">
        <div
          :class="['absolute inset-y-0 left-0 rounded-full transition-[width]', lifecycleBarClass[lifecycle.tone]]"
          :style="{ width: `${lifecycle.percent}%` }"
        />
      </div>
    </div>

    <!-- KPI strip -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
      <div class="space-y-1">
        <p class="text-xs uppercase tracking-wide text-muted">Giá thuê / tháng</p>
        <p class="text-xl font-semibold text-white tabular-nums">{{ formatCurrency(contract.monthlyRent) }}</p>
      </div>
      <div class="space-y-1 sm:border-l sm:border-dark-border sm:pl-4">
        <p class="text-xs uppercase tracking-wide text-muted">Tiền đặt cọc</p>
        <p class="text-xl font-semibold text-white tabular-nums">{{ formatCurrency(contract.deposit) }}</p>
      </div>
      <div class="space-y-1 sm:border-l sm:border-dark-border sm:pl-4">
        <p class="text-xs uppercase tracking-wide text-muted">Người ở</p>
        <p class="text-xl font-semibold text-white tabular-nums">
          {{ activeOccupantCount }}<span class="text-sm text-muted font-normal">/{{ contract.occupantCount }}</span>
        </p>
      </div>
    </div>

    <div v-if="contract.notes" class="pt-4 border-t border-dark-border">
      <p class="text-xs uppercase tracking-wide text-muted mb-1">Ghi chú</p>
      <p class="text-sm text-white">{{ contract.notes }}</p>
    </div>
  </div>
</template>
