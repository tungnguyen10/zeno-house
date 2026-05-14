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
  active:     { label: 'Đang hoạt động', class: 'bg-success-neon/10 text-success-neon' },
  inactive:   { label: 'Ngừng hoạt động', class: 'bg-dark-surface text-muted' },
  pending:    { label: 'Chờ duyệt', class: 'bg-warning/10 text-warning' },
  terminated: { label: 'Đã chấm dứt', class: 'bg-error-bg text-error-vivid' },
  occupied:   { label: 'Đã có người thuê', class: 'bg-cyan/10 text-cyan' },
  vacant:     { label: 'Trống', class: 'bg-success-neon/10 text-success-neon' },
  expired:    { label: 'Hết hạn', class: 'bg-warning/10 text-warning' },
}

const config = computed(() =>
  statusMap[props.status] ?? { label: props.status, class: 'bg-dark-surface text-muted' },
)

const badgeClass = computed(() =>
  clsx(
    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
    config.value.class,
  )
)
</script>

<template>
  <span :class="badgeClass">{{ config.label }}</span>
</template>
