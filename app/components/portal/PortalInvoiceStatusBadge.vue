<script setup lang="ts">
import clsx from 'clsx'
import type { InvoiceStatus } from '~/utils/constants/billing'

const props = defineProps<{
  status: InvoiceStatus
}>()

const LABELS: Record<InvoiceStatus, string> = {
  draft: 'Nháp',
  issued: 'Chưa thanh toán',
  partial: 'Thanh toán một phần',
  paid: 'Đã thanh toán',
  overdue: 'Quá hạn',
  void: 'Đã hủy',
}

const badgeClass = computed(() =>
  clsx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', {
    'bg-smoke text-body': props.status === 'draft' || props.status === 'void',
    'bg-warning/15 text-warning': props.status === 'issued',
    'bg-theme/10 text-theme': props.status === 'partial',
    'bg-success/15 text-success': props.status === 'paid',
    'bg-error/10 text-error': props.status === 'overdue',
  }),
)
</script>

<template>
  <span :class="badgeClass">{{ LABELS[status] }}</span>
</template>
