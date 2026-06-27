<script setup lang="ts">
import type { Building } from '~/types/buildings'
import { buildingPath, buildingEditPath, buildingSettingsPath } from '~/utils/routes/operational'

const props = defineProps<{
  building: Building
  selectable?: boolean
  selected?: boolean
}>()

const emit = defineEmits<{
  'toggle-select': [id: string]
}>()

function onCheckboxChange(event: Event) {
  event.stopPropagation()
  emit('toggle-select', props.building.id)
}

const editPath = computed(() => buildingEditPath(props.building))
const settingsPath = computed(() => buildingSettingsPath(props.building))
const meterReadingsPath = computed(() => `${buildingPath(props.building)}/meter-readings`)
</script>

<template>
  <div
    :class="[
      'group relative rounded-xl border bg-dark-surface transition-colors',
      selectable && selected
        ? 'border-cyan/60 ring-2 ring-cyan/20'
        : 'border-dark-border hover:border-cyan/40 hover:bg-dark-hover',
    ]"
  >
    <!-- Checkbox column (selection mode only) — sits ABOVE the link so clicks don't navigate. -->
    <label
      v-if="selectable"
      class="absolute left-3 top-3 z-10 flex h-6 w-6 items-center justify-center"
      @click.stop
    >
      <input
        type="checkbox"
        :checked="selected"
        :aria-label="`Chọn ${building.name}`"
        class="h-4 w-4 rounded border-dark-border bg-dark-surface text-cyan focus:ring-cyan/40"
        @click.stop
        @change="onCheckboxChange"
      >
    </label>

    <NuxtLink
      :to="buildingPath(building)"
      :class="[
        'block rounded-xl p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40',
        selectable ? 'pl-12' : '',
      ]"
    >
      <div class="flex items-start gap-3 mb-3">
        <div
          v-if="!selectable"
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan/10 text-cyan group-hover:bg-cyan/15 transition-colors"
          aria-hidden="true"
        >
          <IconBuilding class="h-5 w-5" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between gap-2">
            <h3 class="text-sm font-semibold text-white truncate group-hover:text-cyan">
              {{ building.name }}
            </h3>
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
      <NuxtLink
        :to="editPath"
        title="Sửa thông tin"
        aria-label="Sửa thông tin tòa nhà"
        class="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-md border border-dark-border bg-dark-surface text-muted hover:border-cyan/40 hover:text-cyan focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40"
        @click.stop
      >
        <IconPencilSquare class="h-3.5 w-3.5" aria-hidden="true" />
      </NuxtLink>
      <NuxtLink
        :to="settingsPath"
        title="Cấu hình dịch vụ"
        aria-label="Cấu hình dịch vụ và cài đặt tòa nhà"
        class="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-md border border-dark-border bg-dark-surface text-muted hover:border-cyan/40 hover:text-cyan focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40"
        @click.stop
      >
        <IconSettings class="h-3.5 w-3.5" aria-hidden="true" />
      </NuxtLink>
      <NuxtLink
        :to="meterReadingsPath"
        title="Xem chỉ số đồng hồ"
        aria-label="Xem chỉ số đồng hồ của tòa nhà"
        class="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-md border border-dark-border bg-dark-surface text-muted hover:border-cyan/40 hover:text-cyan focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40"
        @click.stop
      >
        <IconChart class="h-3.5 w-3.5" aria-hidden="true" />
      </NuxtLink>
    </div>
  </div>
</template>
