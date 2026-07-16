<script setup lang="ts">
import type { Building } from '~/types/buildings'

defineProps<{
  building: Building
  occupiedRooms?: number
  activeServices?: number
}>()
</script>

<template>
  <UiSurfacePanel as="section">
    <div class="min-w-0">
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="text-lg font-semibold text-white truncate">{{ building.name }}</h2>
        <UiBadge variant="neutral">#{{ building.code }}</UiBadge>
        <UiStatusBadge :status="building.status" />
      </div>
      <p class="mt-1.5 flex items-start gap-1 text-sm text-muted">
        <IconMapPin class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span class="truncate">{{ building.address }}</span>
      </p>
      <p v-if="building.description" class="mt-1.5 text-sm text-muted">{{ building.description }}</p>
    </div>

    <dl class="mt-4 grid grid-cols-1 divide-y divide-dark-border overflow-hidden rounded-lg border border-dark-border bg-dark-deep/30 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      <div class="px-4 py-2.5">
        <dt class="flex items-center gap-1.5 text-xs text-muted">
          <IconDoor class="h-3.5 w-3.5" aria-hidden="true" />
          Phòng
        </dt>
        <dd class="mt-0.5 flex items-baseline gap-2">
          <span class="text-base font-semibold text-white">{{ building.totalRooms }}</span>
          <NuxtLink
            v-if="building.totalRooms === 0"
            :to="`/dashboard/rooms?building=${building.slug}`"
            class="text-xs text-cyan hover:underline"
          >
            Thêm phòng
          </NuxtLink>
        </dd>
      </div>

      <div class="px-4 py-2.5">
        <dt class="flex items-center gap-1.5 text-xs text-muted">
          <IconUsers class="h-3.5 w-3.5" aria-hidden="true" />
          Đang ở
        </dt>
        <dd class="mt-0.5 text-base font-semibold text-white">{{ occupiedRooms ?? 0 }}</dd>
      </div>

      <div class="px-4 py-2.5">
        <dt class="flex items-center gap-1.5 text-xs text-muted">
          <IconLayers class="h-3.5 w-3.5" aria-hidden="true" />
          Dịch vụ
        </dt>
        <dd class="mt-0.5 text-base font-semibold text-white">{{ activeServices ?? building.serviceSummary.activeCount }}</dd>
      </div>
    </dl>
  </UiSurfacePanel>
</template>
