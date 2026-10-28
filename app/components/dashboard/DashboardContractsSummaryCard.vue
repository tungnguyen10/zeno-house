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
    <div>
      <p class="text-2xl font-semibold tabular-nums text-ui-accent">{{ active }}</p>
      <p class="mt-0.5 text-xs text-ui-muted">
        <span class="sm:hidden"><span class="tabular-nums text-ui-primary">{{ tenantCount }}</span> khách thuê</span>
        <span class="hidden sm:inline">hợp đồng đang hoạt động</span>
      </p>
    </div>

    <div class="mt-auto flex items-center justify-between gap-2 pt-3 text-xs sm:hidden">
      <span class="text-ui-muted">Sắp hết hạn</span>
      <span
        class="font-semibold tabular-nums"
        :class="isUrgent ? 'text-status-danger' : expiringSoon > 0 ? 'text-status-warning' : 'text-ui-primary'"
      >
        {{ expiringSoon }}
      </span>
    </div>

    <dl data-contracts-stats class="mt-4 hidden space-y-1.5 text-xs sm:block">
      <div class="flex items-center justify-between gap-3">
        <dt class="text-ui-muted">Khách thuê</dt>
        <dd class="font-semibold tabular-nums text-ui-primary">{{ tenantCount }}</dd>
      </div>
      <div class="flex items-center justify-between gap-3">
        <dt class="text-ui-muted">Hết hạn trong 30 ngày</dt>
        <dd
          class="font-semibold tabular-nums"
          :class="expiringSoon > 0 ? 'text-status-warning' : 'text-ui-primary'"
        >
          {{ expiringSoon }}
        </dd>
      </div>
      <div class="flex items-center justify-between gap-3">
        <dt class="text-ui-muted">Hết hạn trong 7 ngày</dt>
        <dd
          class="font-semibold tabular-nums"
          :class="expiringUrgent > 0 ? 'text-status-danger' : 'text-ui-primary'"
        >
          {{ expiringUrgent }}
        </dd>
      </div>
    </dl>

    <div class="mt-3 hidden items-center gap-1.5 border-t border-ui-border pt-3 text-xs sm:mt-auto sm:flex">
      <template v-if="hasExpiring">
        <IconAlertCircle
          :class="['h-3.5 w-3.5 shrink-0', isUrgent ? 'text-status-danger' : 'text-status-warning']"
          aria-hidden="true"
        />
        <span :class="isUrgent ? 'text-status-danger' : 'text-ui-primary'">
          {{ isUrgent ? 'Cần xử lý hợp đồng trong 7 ngày tới' : 'Có hợp đồng sắp hết hạn' }}
        </span>
      </template>
      <template v-else>
        <IconCheckCircle class="h-3.5 w-3.5 shrink-0 text-status-success" aria-hidden="true" />
        <span class="text-ui-muted">Không có hợp đồng sắp hết hạn</span>
      </template>
    </div>
  </div>
</template>
