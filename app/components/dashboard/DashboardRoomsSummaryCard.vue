<script setup lang="ts">
import type { BuildingRoomStats } from '~/types/dashboard'

const props = defineProps<{
  rooms: BuildingRoomStats
  buildingCount: number
}>()

const occupancyPercent = computed(() => {
  if (props.rooms.total === 0) return 0
  return Math.round((props.rooms.occupied / props.rooms.total) * 100)
})

const segments = computed(() => {
  const { total, occupied, available, maintenance } = props.rooms
  if (total === 0) return { occupied: 0, available: 0, maintenance: 0 }
  return {
    occupied: (occupied / total) * 100,
    available: (available / total) * 100,
    maintenance: (maintenance / total) * 100,
  }
})
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex items-baseline justify-between gap-3">
      <div>
        <p class="text-2xl font-semibold tabular-nums text-cyan">{{ occupancyPercent }}%</p>
        <p class="mt-0.5 text-xs text-muted">tỷ lệ lấp đầy</p>
      </div>
      <p class="text-xs tabular-nums text-muted">
        <span class="font-medium text-white">{{ rooms.occupied }}</span> / {{ rooms.total }} phòng
      </p>
    </div>

    <div
      class="mt-4 flex h-2 overflow-hidden rounded-full bg-dark-border"
      role="img"
      :aria-label="`${occupancyPercent}% phòng đang thuê`"
    >
      <div class="bg-cyan transition-[width]" :style="{ width: `${segments.occupied}%` }" />
      <div class="bg-success-neon/80 transition-[width]" :style="{ width: `${segments.available}%` }" />
      <div class="bg-warning transition-[width]" :style="{ width: `${segments.maintenance}%` }" />
    </div>

    <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      <span class="inline-flex items-center gap-1.5">
        <span class="inline-block h-2 w-2 rounded-sm bg-cyan" aria-hidden="true" />
        Đang thuê <span class="tabular-nums text-white">{{ rooms.occupied }}</span>
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="inline-block h-2 w-2 rounded-sm bg-success-neon/80" aria-hidden="true" />
        Trống <span class="tabular-nums text-white">{{ rooms.available }}</span>
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="inline-block h-2 w-2 rounded-sm bg-warning" aria-hidden="true" />
        Bảo trì <span class="tabular-nums text-white">{{ rooms.maintenance }}</span>
      </span>
    </div>

    <div class="mt-auto border-t border-dark-border pt-3 text-xs text-muted">
      <span class="tabular-nums text-white">{{ buildingCount }}</span> tòa nhà ·
      <span class="tabular-nums text-white">{{ rooms.total }}</span> phòng quản lý
    </div>
  </div>
</template>
