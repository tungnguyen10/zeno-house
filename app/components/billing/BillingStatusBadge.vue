<script setup lang="ts">
import clsx from 'clsx'

const props = defineProps<{
  status: string
}>()

interface StatusConfig {
  label: string
  class: string
}

const statusMap: Record<string, StatusConfig> = {
  draft: { label: 'Nháp', class: 'bg-success-neon/10 text-success-neon' },
  finalized: { label: 'Đã khóa', class: 'bg-cyan/10 text-cyan' },
  generated: { label: 'Đã tạo hóa đơn', class: 'bg-cyan/10 text-cyan' },
  paid: { label: 'Đã thanh toán', class: 'bg-success-neon/10 text-success-neon' },
  unpaid: { label: 'Chưa thanh toán', class: 'bg-warning/10 text-warning' },
}

const config = computed(
  () => statusMap[props.status] ?? { label: props.status, class: 'bg-dark-surface text-muted' },
)

const badgeClass = computed(() =>
  clsx(
    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
    config.value.class,
  ),
)
</script>

<template>
  <span :class="badgeClass">{{ config.label }}</span>
</template>
