<script setup lang="ts">
import type { Room } from '~/types/rooms'
import { formatCurrency } from '~/utils/format/currency'
import { roomPath } from '~/utils/routes/operational'

const props = defineProps<{
  room: Room
  buildingName?: string
  selectable?: boolean
  selected?: boolean
}>()

const emit = defineEmits<{
  'toggle-select': [id: string]
  'edit': [room: Room]
  'edit-services': [room: Room]
}>()

function onSelectedChange() {
  emit('toggle-select', props.room.id)
}

function onEdit() {
  emit('edit', props.room)
}

function onEditServices() {
  emit('edit-services', props.room)
}

const to = computed(() => roomPath(props.room))
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
    <UiCheckbox
      v-if="selectable"
      class="absolute left-3 top-3 z-10 flex h-6 w-6 items-center justify-center"
      :model-value="selected"
      :aria-label="`Chọn phòng ${room.roomNumber}`"
      @click.stop
      @update:model-value="onSelectedChange"
    />

    <NuxtLink
      :to="to"
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
          <IconDoor class="h-4 w-4" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-start justify-between gap-2">
            <p class="truncate text-sm font-semibold text-ui-primary group-hover:text-ui-accent">Phòng {{ room.roomNumber }}</p>
            <UiStatusBadge :status="room.status" />
          </div>
          <div class="mt-0.5 flex items-baseline justify-between gap-3 text-xs">
            <span class="min-w-0 truncate text-ui-muted">
              <template v-if="buildingName">{{ buildingName }} · </template>Tầng {{ room.floor }}<template v-if="room.area"> · {{ room.area }} m²</template>
            </span>
            <span class="shrink-0 font-medium tabular-nums text-ui-primary">
              {{ formatCurrency(room.monthlyRent) }}<span class="font-normal text-ui-muted">/tháng</span>
            </span>
          </div>
        </div>
      </div>
    </NuxtLink>

    <div
      v-if="!selectable"
      class="pointer-events-none absolute inset-x-0 bottom-0 z-10 hidden items-center justify-end gap-1 rounded-b-xl bg-gradient-to-t from-dark-deep/90 via-dark-deep/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 md:flex"
    >
      <UiButton
        v-if="room.status === 'occupied'"
        variant="secondary"
        size="sm"
        icon-only
        title="Chỉnh dịch vụ của phòng"
        :aria-label="`Chỉnh dịch vụ phòng ${room.roomNumber}`"
        class="pointer-events-auto text-ui-muted hover:border-ui-accent/40 hover:text-ui-accent"
        @click.stop.prevent="onEditServices"
      >
        <IconSettings class="h-3.5 w-3.5" aria-hidden="true" />
      </UiButton>
      <UiButton
        variant="secondary"
        size="sm"
        icon-only
        title="Chỉnh sửa nhanh"
        :aria-label="`Chỉnh sửa phòng ${room.roomNumber}`"
        class="pointer-events-auto text-ui-muted hover:border-ui-accent/40 hover:text-ui-accent"
        @click.stop.prevent="onEdit"
      >
        <IconPencilSquare class="h-3.5 w-3.5" aria-hidden="true" />
      </UiButton>
    </div>
  </div>
</template>
