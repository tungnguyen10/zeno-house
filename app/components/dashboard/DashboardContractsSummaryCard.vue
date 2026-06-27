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
        <p class="text-2xl font-semibold tabular-nums text-white">{{ active }}</p>
        <p class="mt-0.5 text-xs text-muted">hợp đồng đang hoạt động</p>
      </div>
      <p class="text-xs tabular-nums text-muted">
        <span class="font-medium text-white">{{ tenantCount }}</span> khách thuê
      </p>
    </div>

    <div class="flex-1" />

    <div
      v-if="hasExpiring"
      class="mt-4 flex items-start gap-3 rounded-lg px-3 py-2.5"
      :class="isUrgent ? 'bg-error-bg' : 'bg-warning/10'"
    >
      <IconAlertCircle
        :class="['mt-0.5 h-4 w-4 shrink-0', isUrgent ? 'text-error-vivid' : 'text-warning']"
        aria-hidden="true"
      />
      <div class="min-w-0 flex-1 space-y-0.5 text-xs">
        <p class="font-medium text-white">
          <span class="tabular-nums">{{ expiringSoon }}</span>
          hợp đồng hết hạn trong 30 ngày
        </p>
        <p v-if="expiringUrgent > 0" class="text-error-vivid">
          <span class="tabular-nums font-semibold">{{ expiringUrgent }}</span>
          cần xử lý trong 7 ngày tới
        </p>
      </div>
    </div>
    <div
      v-else
      class="mt-4 flex items-center gap-2 rounded-lg border border-dark-border px-3 py-2.5 text-xs text-muted"
    >
      <IconCheckCircle class="h-4 w-4 text-success-neon" aria-hidden="true" />
      Không có hợp đồng sắp hết hạn
    </div>
  </div>
</template>
