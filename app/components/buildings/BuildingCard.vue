<script setup lang="ts">
import type { Building } from '~/types/buildings'
import { buildingPath } from '~/utils/routes/operational'

defineProps<{
  building: Building
}>()
</script>

<template>
  <NuxtLink
    :to="buildingPath(building)"
    class="group block rounded-xl border border-dark-border bg-dark-surface p-5 hover:border-cyan/40 hover:bg-dark-hover transition-colors"
  >
    <div class="flex items-start gap-3 mb-3">
      <div
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan/10 text-cyan group-hover:bg-cyan/15 transition-colors"
        aria-hidden="true"
      >
        <IconBuilding class="h-5 w-5" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-2">
          <h3 class="text-sm font-semibold text-white truncate">{{ building.name }}</h3>
          <UiStatusBadge :status="building.status" />
        </div>
        <p class="text-xs text-muted truncate mt-0.5">{{ building.address }}</p>
      </div>
    </div>

    <div class="flex items-center gap-3 text-xs text-muted">
      <span class="inline-flex items-center gap-1">
        <IconDoor class="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        {{ building.totalRooms }} phòng
      </span>
      <span class="inline-flex items-center gap-1">
        <span class="h-1 w-1 rounded-full bg-dark-border" aria-hidden="true" />
        {{ building.serviceSummary.activeCount }} dịch vụ
      </span>
    </div>
    <p v-if="building.serviceSummary.activeNames.length" class="mt-2 truncate text-xs text-muted">
      {{ building.serviceSummary.activeNames.slice(0, 3).join(' · ') }}
    </p>
  </NuxtLink>
</template>

