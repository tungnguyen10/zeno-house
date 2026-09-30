<script setup lang="ts">
import type { Building } from '~/types/buildings'
import { buildingPath, buildingSettingsPath } from '~/utils/routes/operational'

const props = defineProps<{
  building: Building
  selectable?: boolean
  selected?: boolean
}>()

const emit = defineEmits<{
  'toggle-select': [id: string]
  'edit': [building: Building]
}>()

function onSelectedChange() {
  emit('toggle-select', props.building.id)
}

const settingsPath = computed(() => buildingSettingsPath(props.building))
const meterReadingsPath = computed(() => `${buildingPath(props.building)}/meter-readings`)
</script>

<template>
  <div
    :class="[
      'group relative rounded-xl border bg-ui-surface transition-colors',
      selectable && selected
        ? 'border-ui-accent/60 ring-2 ring-ui-accent/20'
        : 'border-ui-border hover:border-ui-accent/40 hover:bg-ui-hover',
    ]"
  >
    <!-- Checkbox column (selection mode only) — sits ABOVE the link so clicks don't navigate. -->
    <UiCheckbox
      v-if="selectable"
      class="absolute left-3 top-3 z-10 flex h-6 w-6 items-center justify-center"
      :model-value="selected"
      :aria-label="`Chọn ${building.name}`"
      @click.stop
      @update:model-value="onSelectedChange"
    />

    <NuxtLink
      :to="buildingPath(building)"
      :class="[
        'block rounded-xl p-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/40 sm:p-4',
        selectable ? 'pl-12' : '',
      ]"
    >
      <div class="flex items-center gap-3">
        <div
          v-if="!selectable"
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ui-accent/10 text-ui-accent transition-colors group-hover:bg-ui-accent/15"
          aria-hidden="true"
        >
          <IconBuilding class="h-4 w-4" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-start justify-between gap-2">
            <h3 class="truncate text-sm font-semibold text-ui-primary group-hover:text-ui-accent">
              {{ building.name }}
            </h3>
            <!-- Active is the norm, so only the exception earns a badge and the row's width. -->
            <UiStatusBadge v-if="building.status !== 'active'" :status="building.status" />
          </div>
          <div class="mt-0.5 flex items-baseline justify-between gap-3 text-xs text-ui-muted">
            <span class="min-w-0 truncate" :title="building.address">{{ building.address }}</span>
            <span class="shrink-0 tabular-nums">
              {{ building.totalRooms }} phòng · {{ building.serviceSummary.activeCount }} dịch vụ
            </span>
          </div>
        </div>
      </div>
    </NuxtLink>

    <!--
      Hover-revealed quick actions (desktop only).
      Sits above the NuxtLink with z-10. `pointer-events-none` on the wrapper +
      `pointer-events-auto` on each button so the gradient strip doesn't block
      clicks on the underlying card.
    -->
    <div
      v-if="!selectable"
      class="pointer-events-none absolute inset-x-0 bottom-0 z-10 hidden items-center justify-end gap-1 rounded-b-xl bg-gradient-to-t from-dark-deep/90 via-dark-deep/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 md:flex"
    >
      <button
        type="button"
        title="Sửa thông tin"
        aria-label="Sửa thông tin tòa nhà"
        class="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-md border border-ui-border bg-ui-surface text-ui-muted hover:border-ui-accent/40 hover:text-ui-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/40"
        @click.stop="emit('edit', building)"
      >
        <IconPencilSquare class="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <NuxtLink
        :to="settingsPath"
        title="Cấu hình dịch vụ"
        aria-label="Cấu hình dịch vụ và cài đặt tòa nhà"
        class="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-md border border-ui-border bg-ui-surface text-ui-muted hover:border-ui-accent/40 hover:text-ui-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/40"
        @click.stop
      >
        <IconSettings class="h-3.5 w-3.5" aria-hidden="true" />
      </NuxtLink>
      <NuxtLink
        :to="meterReadingsPath"
        title="Xem chỉ số đồng hồ"
        aria-label="Xem chỉ số đồng hồ của tòa nhà"
        class="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-md border border-ui-border bg-ui-surface text-ui-muted hover:border-ui-accent/40 hover:text-ui-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/40"
        @click.stop
      >
        <IconChart class="h-3.5 w-3.5" aria-hidden="true" />
      </NuxtLink>
    </div>
  </div>
</template>
