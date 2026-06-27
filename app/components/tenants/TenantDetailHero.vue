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
  <section class="rounded-xl border border-dark-border bg-dark-surface p-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="text-xl font-semibold text-white truncate">{{ tenant.fullName }}</h2>
          <UiBadge variant="neutral">#{{ tenant.code }}</UiBadge>
          <UiBadge :variant="tenant.status === 'archived' ? 'warning' : 'success'" pill>
            {{ tenant.status === 'archived' ? 'Đã lưu trữ' : 'Đang hoạt động' }}
          </UiBadge>
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
          <span v-if="tenant.phone" class="inline-flex items-center gap-1">
            <IconPhone class="h-4 w-4" aria-hidden="true" />
            <a :href="`tel:${tenant.phone}`" class="hover:text-white">{{ tenant.phone }}</a>
          </span>
          <span v-if="tenant.email" class="inline-flex items-center gap-1">
            <IconMail class="h-4 w-4" aria-hidden="true" />
            <a :href="`mailto:${tenant.email}`" class="hover:text-white">{{ tenant.email }}</a>
          </span>
          <span v-if="tenant.idNumber" class="inline-flex items-center gap-1">
            <IconDocumentText class="h-4 w-4" aria-hidden="true" />
            <span>{{ tenant.idNumber }}</span>
          </span>
        </div>
      </div>
    </div>

    <dl class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div class="rounded-lg border border-dark-border bg-dark-deep/40 px-4 py-3">
        <dt class="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
          <IconDocument class="h-3.5 w-3.5" aria-hidden="true" />
          Hợp đồng đang hoạt động
        </dt>
        <dd class="mt-1 text-2xl font-semibold text-white">{{ activeContractCount ?? 0 }}</dd>
      </div>

      <div class="rounded-lg border border-dark-border bg-dark-deep/40 px-4 py-3">
        <dt class="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
          <IconDoor class="h-3.5 w-3.5" aria-hidden="true" />
          Phòng hiện tại
        </dt>
        <dd class="mt-1 text-base font-medium text-white truncate">
          {{ currentRoomLabel || '—' }}
        </dd>
      </div>

      <div class="rounded-lg border border-dark-border bg-dark-deep/40 px-4 py-3">
        <dt class="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
          <IconUsers class="h-3.5 w-3.5" aria-hidden="true" />
          Đang đồng cư
        </dt>
        <dd class="mt-1 text-2xl font-semibold text-white">{{ occupancyCount ?? 0 }}</dd>
      </div>
    </dl>
  </section>
</template>
