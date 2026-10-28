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
      <IconBuilding class="h-5 w-5 text-ui-muted" aria-hidden="true" />
    </template>
  </UiEmptyState>
  <div v-else data-occupancy-list class="overflow-hidden">
    <NuxtLink
      v-for="row in rows"
      :key="row.id"
      :to="buildingPath(row)"
      class="group grid grid-cols-[minmax(0,1fr)_2.75rem_1rem] items-center gap-x-3 gap-y-2 border-b border-ui-border px-1 py-3 last:border-b-0 hover:bg-ui-hover active:bg-ui-hover sm:grid-cols-[minmax(10rem,1.2fr)_minmax(6rem,1fr)_3rem_1rem] sm:gap-x-4 sm:px-3"
    >
      <div class="col-start-1 row-start-1 min-w-0 sm:col-start-auto sm:row-start-auto">
        <div class="truncate text-sm font-medium text-ui-primary">{{ row.name }}</div>
        <div class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ui-muted">
          <span>
            <span class="tabular-nums text-ui-primary">{{ row.occupied }}</span>/<span class="tabular-nums">{{ row.total }}</span> {{ row.total === 0 ? 'phòng' : 'đang thuê' }}
          </span>
          <template v-if="row.available > 0">
            <span class="text-ui-border-strong" aria-hidden="true">·</span>
            <span>
              <span class="tabular-nums text-status-success">{{ row.available }}</span> trống
            </span>
          </template>
          <template v-if="row.maintenance > 0">
            <span class="text-ui-border-strong" aria-hidden="true">·</span>
            <span>
              <span class="tabular-nums text-status-warning">{{ row.maintenance }}</span> bảo trì
            </span>
          </template>
        </div>
      </div>

      <div
        v-if="row.occupancyPercent !== null"
        class="col-start-1 row-start-2 flex h-1.5 overflow-hidden rounded-full bg-ui-border sm:col-start-auto sm:row-start-auto sm:h-2"
        role="img"
        :aria-label="`${row.occupancyPercent}% phòng đang thuê`"
      >
        <div class="bg-ui-accent transition-[width]" :style="{ width: `${row.occupiedPercent}%` }" />
        <div class="bg-status-success/80 transition-[width]" :style="{ width: `${row.availablePercent}%` }" />
        <div class="bg-status-warning transition-[width]" :style="{ width: `${row.maintenancePercent}%` }" />
      </div>
      <div v-else class="col-start-1 row-start-2 text-xs text-ui-muted sm:col-start-auto sm:row-start-auto">Chưa có phòng</div>

      <div class="col-start-2 row-span-2 row-start-1 text-right text-sm font-semibold tabular-nums text-ui-primary sm:col-start-auto sm:row-span-1 sm:row-start-auto">
        <template v-if="row.occupancyPercent !== null">{{ row.occupancyPercent }}%</template>
        <span v-else class="text-ui-muted">—</span>
      </div>

      <IconChevronRight
        class="col-start-3 row-span-2 row-start-1 h-4 w-4 shrink-0 text-ui-muted transition group-hover:translate-x-0.5 group-hover:text-ui-accent sm:col-start-auto sm:row-span-1 sm:row-start-auto"
        aria-hidden="true"
      />
    </NuxtLink>
  </div>
</template>
