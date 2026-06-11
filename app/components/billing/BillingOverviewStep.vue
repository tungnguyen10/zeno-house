<script setup lang="ts">
import type { BillingWorkspaceOverview } from '~/types/billing'
import { formatCurrency } from '~/utils/format/currency'

const props = defineProps<{
  overview: BillingWorkspaceOverview
  loading: boolean
}>()

defineEmits<{ (e: 'refresh'): void }>()

const readingCoverageLabel = computed(() => {
  const { readingRequiredCount, readingCompleteCount } = props.overview
  if (readingRequiredCount === 0) return '—'
  return `${readingCompleteCount}/${readingRequiredCount}`
})

const missingReadingsCount = computed(() => {
  const { readingRequiredCount, readingCompleteCount } = props.overview
  return Math.max(0, readingRequiredCount - readingCompleteCount)
})

const metrics = computed(() => [
  { label: 'Hợp đồng đang hoạt động', value: props.overview.contractCount, tone: 'default' as const },
  { label: 'Hoá đơn', value: props.overview.invoiceCount, tone: 'default' as const },
  { label: 'Chỉ số đã ghi', value: readingCoverageLabel.value, tone: missingReadingsCount.value > 0 ? 'warning' as const : 'success' as const, caption: missingReadingsCount.value > 0 ? `Còn ${missingReadingsCount.value} chỉ số chưa ghi` : 'Đã đủ' },
  { label: 'Dự kiến phát hành', value: formatCurrency(props.overview.draftTotal), tone: 'accent' as const },
  { label: 'Đã phát hành', value: formatCurrency(props.overview.issuedTotal), tone: 'default' as const },
  { label: 'Đã thu', value: formatCurrency(props.overview.paidTotal), tone: 'success' as const },
  { label: 'Công nợ', value: formatCurrency(props.overview.outstandingBalance), tone: props.overview.outstandingBalance > 0 ? 'danger' as const : 'default' as const },
])
</script>

<template>
  <div class="space-y-4">
    <UiSection title="Tổng quan kỳ" description="Tóm tắt các số liệu chính của kỳ vận hành.">
      <template #actions>
        <UiButton variant="secondary" size="sm" @click="$emit('refresh')">Làm mới</UiButton>
      </template>
      <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <UiMetric
          v-for="m in metrics"
          :key="m.label"
          :label="m.label"
          :value="m.value"
          :tone="m.tone"
          :caption="m.caption"
          :loading="loading"
        />
      </div>
    </UiSection>
  </div>
</template>
