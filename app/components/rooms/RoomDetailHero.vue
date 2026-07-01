<script setup lang="ts">
import type { Building } from '~/types/buildings'
import type { ContractWithDetails } from '~/types/contracts'
import type { Room } from '~/types/rooms'
import { buildingPath } from '~/utils/routes/operational'

const props = defineProps<{
  room: Room
  building?: Building | null
  activeContract?: ContractWithDetails | null
  occupantCount?: number
  meterDeviceCount?: number
}>()

const roomName = computed(() => {
  const buildingName = props.building?.name
  return buildingName ? `${buildingName} · Phòng ${props.room.roomNumber}` : `Phòng ${props.room.roomNumber}`
})
</script>

<template>
  <section class="rounded-xl border border-dark-border bg-dark-surface p-5">
    <div class="min-w-0">
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="truncate text-lg font-semibold text-white">{{ roomName }}</h2>
        <UiBadge variant="neutral">#{{ room.code }}</UiBadge>
        <UiStatusBadge :status="room.status" />
      </div>
      <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <span class="inline-flex items-center gap-1">
          <IconLayers class="h-3.5 w-3.5" aria-hidden="true" />
          Tầng {{ room.floor }}
        </span>
        <span v-if="room.area" class="inline-flex items-center gap-1">
          <IconTag class="h-3.5 w-3.5" aria-hidden="true" />
          {{ room.area }} m²
        </span>
        <NuxtLink
          v-if="building"
          :to="buildingPath(building)"
          class="inline-flex items-center gap-1 text-cyan hover:underline"
        >
          <IconBuilding class="h-3.5 w-3.5" aria-hidden="true" />
          {{ building.name }}
        </NuxtLink>
      </div>
    </div>

    <dl class="mt-4 grid grid-cols-1 divide-y divide-dark-border overflow-hidden rounded-lg border border-dark-border bg-dark-deep/30 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      <div class="px-4 py-2.5">
        <dt class="flex items-center gap-1.5 text-xs text-muted">
          <IconDocumentText class="h-3.5 w-3.5" aria-hidden="true" />
          Hợp đồng
        </dt>
        <dd class="mt-0.5 flex items-baseline gap-2">
          <span class="text-base font-semibold text-white">{{ activeContract ? 'Đang thuê' : 'Trống' }}</span>
          <NuxtLink
            v-if="!activeContract"
            :to="`/contracts/create?room_id=${room.code}`"
            class="text-xs text-cyan hover:underline"
          >
            Giao phòng
          </NuxtLink>
        </dd>
      </div>

      <div class="px-4 py-2.5">
        <dt class="flex items-center gap-1.5 text-xs text-muted">
          <IconUsers class="h-3.5 w-3.5" aria-hidden="true" />
          Người ở
        </dt>
        <dd class="mt-0.5 text-base font-semibold text-white">{{ occupantCount ?? 0 }} người</dd>
      </div>

      <div class="px-4 py-2.5">
        <dt class="flex items-center gap-1.5 text-xs text-muted">
          <IconChart class="h-3.5 w-3.5" aria-hidden="true" />
          Đồng hồ
        </dt>
        <dd class="mt-0.5 text-base font-semibold text-white">{{ meterDeviceCount ?? 0 }} đồng hồ</dd>
      </div>
    </dl>
  </section>
</template>
