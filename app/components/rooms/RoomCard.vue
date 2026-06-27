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
}>()

function onCheckboxChange(event: Event) {
  event.stopPropagation()
  emit('toggle-select', props.room.id)
}

function onEdit() {
  emit('edit', props.room)
}

const to = computed(() => roomPath(props.room))
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
    <label
      v-if="selectable"
      class="absolute left-3 top-3 z-10 flex h-6 w-6 items-center justify-center"
      @click.stop
    >
      <input
        type="checkbox"
        :checked="selected"
        :aria-label="`Chọn phòng ${room.roomNumber}`"
        class="h-4 w-4 rounded border-dark-border bg-dark-surface text-cyan focus:ring-cyan/40"
        @click.stop
        @change="onCheckboxChange"
      >
    </label>

    <NuxtLink
      :to="to"
      :class="[
        'block rounded-xl p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40',
        selectable ? 'pl-12' : '',
      ]"
    >
      <div class="flex items-start gap-3 mb-3">
        <div
          v-if="!selectable"
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan/10 text-cyan group-hover:bg-cyan/15 transition-colors"
          aria-hidden="true"
        >
          <IconDoor class="h-4 w-4" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between gap-2">
            <p class="text-base font-semibold text-white truncate group-hover:text-cyan">Phòng {{ room.roomNumber }}</p>
            <UiStatusBadge :status="room.status" />
          </div>
          <p class="text-xs text-muted mt-0.5">
            <span v-if="buildingName">{{ buildingName }} · </span>Tầng {{ room.floor }}
          </p>
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
    </NuxtLink>

    <div
      v-if="!selectable"
      class="pointer-events-none absolute inset-x-0 bottom-0 z-10 hidden items-center justify-end gap-1 rounded-b-xl bg-gradient-to-t from-dark-deep/90 via-dark-deep/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 md:flex"
    >
      <button
        type="button"
        title="Chỉnh sửa nhanh"
        :aria-label="`Chỉnh sửa phòng ${room.roomNumber}`"
        class="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-md border border-dark-border bg-dark-surface text-muted hover:border-cyan/40 hover:text-cyan focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40"
        @click.stop.prevent="onEdit"
      >
        <IconPencilSquare class="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
