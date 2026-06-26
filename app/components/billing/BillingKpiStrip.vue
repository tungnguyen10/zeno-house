<script setup lang="ts">
import clsx from 'clsx'
import type { BillingWorkspaceOverview } from '~/types/billing'
import { formatCurrency } from '~/utils/format/currency'

const props = defineProps<{
  overview: BillingWorkspaceOverview
  loading: boolean
}>()

const readingCoverageLabel = computed(() => {
  const { readingRequiredCount, readingCompleteCount } = props.overview
  if (readingRequiredCount === 0) return '-'
  return `${readingCompleteCount}/${readingRequiredCount}`
})

const missingReadingsCount = computed(() => {
  const { readingRequiredCount, readingCompleteCount } = props.overview
  return Math.max(0, readingRequiredCount - readingCompleteCount)
})

type Tone = 'default' | 'success' | 'warning' | 'danger'
const toneClass: Record<Tone, string> = {
  default: 'text-white',
  success: 'text-success-neon',
  warning: 'text-warning',
  danger: 'text-error-vivid',
}

const metrics = computed<Array<{ label: string; value: string; tone: Tone; caption?: string }>>(() => {
  const { contractCount, invoiceCount, draftTotal, issuedTotal, paidTotal, outstandingBalance } = props.overview
  return [
    {
      label: 'Quy mô',
      value: `${contractCount} HĐ`,
      tone: 'default',
      caption: `${invoiceCount} hoá đơn`,
    },
    {
      label: 'Chỉ số',
      value: readingCoverageLabel.value,
      tone: missingReadingsCount.value > 0 ? 'warning' : 'success',
      caption: missingReadingsCount.value > 0 ? `Còn ${missingReadingsCount.value}` : 'Đã đủ',
    },
    {
      label: 'Đã phát hành',
      value: formatCurrency(issuedTotal),
      tone: 'default',
      caption: draftTotal > 0 ? `Nháp +${formatCurrency(draftTotal)}` : undefined,
    },
    {
      label: 'Đã thu',
      value: formatCurrency(paidTotal),
      tone: 'success',
    },
    {
      label: 'Công nợ',
      value: formatCurrency(outstandingBalance),
      tone: outstandingBalance > 0 ? 'danger' : 'default',
    },
  ]
})
</script>

<template>
  <div class="sticky top-0 z-20 -mx-1 border-y border-dark-border bg-dark/95 px-3 py-2 backdrop-blur">
    <div v-if="loading" class="flex gap-4">
      <UiSkeleton v-for="i in 5" :key="i" class="h-5 w-28" />
    </div>
    <dl
      v-else
      class="flex flex-wrap items-baseline gap-x-5 gap-y-1.5 text-sm"
    >
      <div
        v-for="(m, idx) in metrics"
        :key="m.label"
        class="flex items-baseline gap-2"
      >
        <span
          v-if="idx > 0"
          class="hidden text-dark-border md:inline"
          aria-hidden="true"
        >·</span>
        <dt class="text-[11px] uppercase tracking-wide text-muted">{{ m.label }}</dt>
        <dd :class="clsx('font-semibold tabular-nums', toneClass[m.tone])">{{ m.value }}</dd>
        <dd v-if="m.caption" class="text-xs text-muted">{{ m.caption }}</dd>
      </div>
    </dl>
  </div>
</template>
