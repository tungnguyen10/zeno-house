<script setup lang="ts">
import type { Room } from '~/types/rooms'
import { formatCurrency } from '~/utils/format/currency'

defineProps<{
  room: Room
  buildingName?: string
}>()
</script>

<template>
  <div class="rounded-xl border border-dark-border bg-dark-card p-4 hover:border-cyan/30 transition-colors">
    <div class="flex items-start justify-between gap-2 mb-3">
      <div class="min-w-0">
        <p class="text-base font-semibold text-white truncate">Phòng {{ room.roomNumber }}</p>
        <p v-if="buildingName" class="text-xs text-muted truncate mt-0.5">{{ buildingName }}</p>
      </div>
      <UiStatusBadge :status="room.status" />
    </div>

    <dl class="space-y-1 text-sm">
      <div class="flex items-center justify-between">
        <dt class="text-muted">Tầng</dt>
        <dd class="text-white font-medium">{{ room.floor }}</dd>
      </div>
      <div class="flex items-center justify-between">
        <dt class="text-muted">Giá thuê</dt>
        <dd class="text-white font-medium">{{ formatCurrency(room.monthlyRent) }}/tháng</dd>
      </div>
      <div v-if="room.area" class="flex items-center justify-between">
        <dt class="text-muted">Diện tích</dt>
        <dd class="text-white font-medium">{{ room.area }} m²</dd>
      </div>
    </dl>
  </div>
</template>
