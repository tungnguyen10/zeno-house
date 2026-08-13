<script setup lang="ts">
const props = defineProps<{
  active: number
  expiringSoon: number
  expiringUrgent: number
  tenantCount: number
}>()

const hasExpiring = computed(() => props.expiringSoon > 0 || props.expiringUrgent > 0)
const isUrgent = computed(() => props.expiringUrgent > 0)
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex items-baseline justify-between gap-3">
      <div>
        <p class="text-2xl font-semibold tabular-nums text-ui-accent">{{ active }}</p>
        <p class="mt-0.5 text-xs text-ui-muted">hợp đồng đang hoạt động</p>
      </div>
      <p class="text-xs tabular-nums text-ui-muted">
        <span class="font-medium text-ui-primary">{{ tenantCount }}</span> khách thuê
      </p>
    </div>

    <div
      v-if="hasExpiring"
      class="mt-4 sm:mt-auto flex items-start gap-3 rounded-lg px-3 py-2.5"
      :class="isUrgent ? 'bg-status-danger-surface' : 'bg-status-warning/10'"
    >
      <IconAlertCircle
        :class="['mt-0.5 h-4 w-4 shrink-0', isUrgent ? 'text-status-danger' : 'text-status-warning']"
        aria-hidden="true"
      />
      <div class="min-w-0 flex-1 space-y-0.5 text-xs">
        <p class="font-medium text-ui-primary">
          <span class="tabular-nums">{{ expiringSoon }}</span>
          hợp đồng hết hạn trong 30 ngày
        </p>
        <p v-if="expiringUrgent > 0" class="text-status-danger">
          <span class="tabular-nums font-semibold">{{ expiringUrgent }}</span>
          cần xử lý trong 7 ngày tới
        </p>
      </div>
    </div>
    <div
      v-else
      class="mt-4 sm:mt-auto flex items-center gap-1.5 text-xs text-ui-muted"
    >
      <IconCheckCircle class="h-3.5 w-3.5 shrink-0 text-status-success" aria-hidden="true" />
      Không có hợp đồng sắp hết hạn
    </div>
  </div>
</template>
