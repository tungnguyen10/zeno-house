<script setup lang="ts">
import type { Building } from '~/types/buildings'

defineProps<{
  building: Building
  occupiedRooms?: number
  activeServices?: number
}>()
</script>

<template>
  <section class="rounded-xl border border-dark-border bg-dark-surface p-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="text-xl font-semibold text-white truncate">{{ building.name }}</h2>
          <UiBadge variant="neutral">#{{ building.code }}</UiBadge>
          <UiStatusBadge :status="building.status" />
        </div>
        <p class="mt-1 flex items-start gap-1 text-sm text-muted">
          <IconMapPin class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span class="truncate">{{ building.address }}</span>
        </p>
        <p v-if="building.description" class="mt-2 text-sm text-muted">{{ building.description }}</p>
      </div>
    </div>

    <dl class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div class="rounded-lg border border-dark-border bg-dark-deep/40 px-4 py-3">
        <dt class="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
          <IconDoor class="h-3.5 w-3.5" aria-hidden="true" />
          Phòng
        </dt>
        <dd class="mt-1 flex items-baseline gap-2">
          <span class="text-2xl font-semibold text-white">{{ building.totalRooms }}</span>
          <NuxtLink
            v-if="building.totalRooms === 0"
            :to="`/rooms?building=${building.slug}`"
            class="text-xs text-cyan hover:underline"
          >
            Thêm phòng
          </NuxtLink>
        </dd>
      </div>

      <div class="rounded-lg border border-dark-border bg-dark-deep/40 px-4 py-3">
        <dt class="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
          <IconUsers class="h-3.5 w-3.5" aria-hidden="true" />
          Đang ở
        </dt>
        <dd class="mt-1 text-2xl font-semibold text-white">{{ occupiedRooms ?? 0 }}</dd>
      </div>

      <div class="rounded-lg border border-dark-border bg-dark-deep/40 px-4 py-3">
        <dt class="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
          <IconLayers class="h-3.5 w-3.5" aria-hidden="true" />
          Dịch vụ
        </dt>
        <dd class="mt-1 text-2xl font-semibold text-white">{{ activeServices ?? building.serviceSummary.activeCount }}</dd>
      </div>
    </dl>
  </section>
</template>
