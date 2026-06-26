<script setup lang="ts">
import type { Room } from '~/types/rooms'
import { formatCurrency } from '~/utils/format/currency'

defineProps<{
  room: Room
  buildingName?: string
}>()
</script>

<template>
  <div class="group rounded-xl border border-dark-border bg-dark-surface p-4 hover:border-cyan/40 hover:bg-dark-hover transition-colors">
    <div class="flex items-start gap-3 mb-3">
      <div
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan/10 text-cyan group-hover:bg-cyan/15 transition-colors"
        aria-hidden="true"
      >
        <IconDoor class="h-4 w-4" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-2">
          <p class="text-base font-semibold text-white truncate">Phòng {{ room.roomNumber }}</p>
          <UiStatusBadge :status="room.status" />
        </div>
        <p class="text-xs text-muted mt-0.5">Tầng {{ room.floor }}</p>
      </div>
    </div>

    <dl class="space-y-1 text-sm">
      <div class="flex items-center justify-between gap-2">
        <dt class="text-muted">Giá thuê</dt>
        <dd class="text-white font-medium truncate">{{ formatCurrency(room.monthlyRent) }}/tháng</dd>
      </div>
      <div v-if="room.area" class="flex items-center justify-between gap-2">
        <dt class="text-muted">Diện tích</dt>
        <dd class="text-white font-medium">{{ room.area }} m²</dd>
      </div>
    </dl>
  </div>
</template>

