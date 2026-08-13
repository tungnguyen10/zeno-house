<script setup lang="ts">
import type { Tenant } from '~/types/tenants'

defineProps<{
  tenant: Tenant
  activeContractCount?: number
  currentRoomLabel?: string | null
  occupancyCount?: number
}>()
</script>

<template>
  <UiSurfacePanel as="section">
    <div class="min-w-0">
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="text-lg font-semibold text-ui-primary truncate">{{ tenant.fullName }}</h2>
        <UiBadge variant="neutral">#{{ tenant.code }}</UiBadge>
        <UiBadge :variant="tenant.status === 'archived' ? 'warning' : 'success'" pill>
          {{ tenant.status === 'archived' ? 'Đã lưu trữ' : 'Đang hoạt động' }}
        </UiBadge>
      </div>
      <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ui-muted">
        <span v-if="tenant.phone" class="inline-flex items-center gap-1">
          <IconPhone class="h-3.5 w-3.5" aria-hidden="true" />
          <a :href="`tel:${tenant.phone}`" class="hover:text-ui-primary">{{ tenant.phone }}</a>
        </span>
        <span v-if="tenant.email" class="inline-flex items-center gap-1">
          <IconMail class="h-3.5 w-3.5" aria-hidden="true" />
          <a :href="`mailto:${tenant.email}`" class="hover:text-ui-primary">{{ tenant.email }}</a>
        </span>
        <span v-if="tenant.idNumber" class="inline-flex items-center gap-1">
          <IconDocumentText class="h-3.5 w-3.5" aria-hidden="true" />
          <span>{{ tenant.idNumber }}</span>
        </span>
      </div>
    </div>

    <dl class="mt-4 grid grid-cols-1 divide-y divide-ui-border overflow-hidden rounded-lg border border-ui-border bg-ui-deep/30 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      <div class="px-4 py-2.5">
        <dt class="flex items-center gap-1.5 text-xs text-ui-muted">
          <IconDocument class="h-3.5 w-3.5" aria-hidden="true" />
          Hợp đồng đang hoạt động
        </dt>
        <dd class="mt-0.5 text-base font-semibold text-ui-primary">{{ activeContractCount ?? 0 }}</dd>
      </div>

      <div class="px-4 py-2.5">
        <dt class="flex items-center gap-1.5 text-xs text-ui-muted">
          <IconDoor class="h-3.5 w-3.5" aria-hidden="true" />
          Phòng hiện tại
        </dt>
        <dd class="mt-0.5 text-base font-medium text-ui-primary truncate">
          {{ currentRoomLabel || '—' }}
        </dd>
      </div>

      <div class="px-4 py-2.5">
        <dt class="flex items-center gap-1.5 text-xs text-ui-muted">
          <IconUsers class="h-3.5 w-3.5" aria-hidden="true" />
          Đang đồng cư
        </dt>
        <dd class="mt-0.5 text-base font-semibold text-ui-primary">{{ occupancyCount ?? 0 }}</dd>
      </div>
    </dl>
  </UiSurfacePanel>
</template>
