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
  >
    <template #icon>
      <IconBuilding class="h-5 w-5 text-muted" aria-hidden="true" />
    </template>
  </UiEmptyState>
  <div v-else class="overflow-hidden rounded-xl border border-dark-border bg-dark-surface">
    <NuxtLink
      v-for="row in rows"
      :key="row.id"
      :to="buildingPath(row)"
      class="group grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 gap-y-2 border-b border-dark-border px-4 py-3 last:border-b-0 hover:bg-dark-hover sm:grid-cols-[minmax(10rem,1.2fr)_minmax(6rem,1fr)_3rem_1rem]"
    >
      <div class="min-w-0 col-span-2 sm:col-span-1">
        <div class="truncate text-sm font-medium text-white">{{ row.name }}</div>
        <div class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
          <span>
            <span class="tabular-nums text-white">{{ row.occupied }}</span>/<span class="tabular-nums">{{ row.total }}</span> đang thuê
          </span>
          <template v-if="row.available > 0">
            <span class="text-dark-border" aria-hidden="true">·</span>
            <span>
              <span class="tabular-nums text-success-neon">{{ row.available }}</span> trống
            </span>
          </template>
          <template v-if="row.maintenance > 0">
            <span class="text-dark-border" aria-hidden="true">·</span>
            <span>
              <span class="tabular-nums text-warning">{{ row.maintenance }}</span> bảo trì
            </span>
          </template>
        </div>
      </div>

      <div
        v-if="row.occupancyPercent !== null"
        class="col-span-3 flex h-1.5 overflow-hidden rounded-full bg-dark-border sm:col-span-1 sm:h-2"
        role="img"
        :aria-label="`${row.occupancyPercent}% phòng đang thuê`"
      >
        <div class="bg-cyan transition-[width]" :style="{ width: `${row.occupiedPercent}%` }" />
        <div class="bg-success-neon/80 transition-[width]" :style="{ width: `${row.availablePercent}%` }" />
        <div class="bg-warning transition-[width]" :style="{ width: `${row.maintenancePercent}%` }" />
      </div>
      <div v-else class="col-span-3 text-xs text-muted sm:col-span-1">Chưa có phòng</div>

      <div class="text-right text-sm font-semibold tabular-nums text-white">
        <template v-if="row.occupancyPercent !== null">{{ row.occupancyPercent }}%</template>
        <span v-else class="text-muted">—</span>
      </div>

      <IconChevronRight
        class="h-4 w-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-cyan"
        aria-hidden="true"
      />
    </NuxtLink>
  </div>
</template>
