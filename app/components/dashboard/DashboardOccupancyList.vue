<script setup lang="ts">
import type { BuildingBreakdownEntry } from '~/types/dashboard'
import { buildingPath } from '~/utils/routes/operational'

const props = defineProps<{
  buildings: BuildingBreakdownEntry[]
}>()

interface Row {
  id: string
  slug: string
  name: string
  total: number
  available: number
  occupied: number
  maintenance: number
  occupancyPercent: number | null
  availablePercent: number
  occupiedPercent: number
  maintenancePercent: number
}

const rows = computed<Row[]>(() =>
  props.buildings.map((building) => {
    const { total, available, occupied, maintenance } = building.rooms
    if (total === 0) {
      return {
        id: building.id,
        slug: building.slug,
        name: building.name,
        total,
        available,
        occupied,
        maintenance,
        occupancyPercent: null,
        availablePercent: 0,
        occupiedPercent: 0,
        maintenancePercent: 0,
      }
    }
    return {
      id: building.id,
      slug: building.slug,
      name: building.name,
      total,
      available,
      occupied,
      maintenance,
      occupancyPercent: Math.round((occupied / total) * 100),
      availablePercent: (available / total) * 100,
      occupiedPercent: (occupied / total) * 100,
      maintenancePercent: (maintenance / total) * 100,
    }
  }),
)
</script>

<template>
  <UiEmptyState
    v-if="!rows.length"
    title="Chưa có tòa nhà"
    description="Thêm tòa nhà để xem tỷ lệ phòng."
  />
  <div v-else class="space-y-3">
    <NuxtLink
      v-for="row in rows"
      :key="row.id"
      :to="buildingPath(row)"
      class="block rounded-lg border border-dark-border bg-dark-surface p-4 transition hover:border-cyan/40 hover:bg-dark-hover"
    >
      <div class="mb-2 flex items-baseline justify-between gap-3">
        <span class="text-sm font-medium text-white">{{ row.name }}</span>
        <span class="text-xs text-muted">
          <template v-if="row.occupancyPercent !== null">
            <span class="font-semibold text-white">{{ row.occupancyPercent }}%</span>
            · {{ row.occupied }}/{{ row.total }} phòng
          </template>
          <template v-else>0/0 phòng</template>
        </span>
      </div>
      <div class="flex h-2.5 overflow-hidden rounded-full bg-dark-border">
        <div class="bg-cyan transition-[width]" :style="{ width: `${row.occupiedPercent}%` }" />
        <div class="bg-success-neon/80 transition-[width]" :style="{ width: `${row.availablePercent}%` }" />
        <div class="bg-warning transition-[width]" :style="{ width: `${row.maintenancePercent}%` }" />
      </div>
      <div class="mt-2 flex gap-4 text-xs text-muted">
        <span class="inline-flex items-center gap-1.5">
          <span class="inline-block h-2 w-2 rounded-sm bg-cyan" /> Đang thuê {{ row.occupied }}
        </span>
        <span class="inline-flex items-center gap-1.5">
          <span class="inline-block h-2 w-2 rounded-sm bg-success-neon/80" /> Trống {{ row.available }}
        </span>
        <span v-if="row.maintenance > 0" class="inline-flex items-center gap-1.5">
          <span class="inline-block h-2 w-2 rounded-sm bg-warning" /> Bảo trì {{ row.maintenance }}
        </span>
      </div>
    </NuxtLink>
  </div>
</template>
