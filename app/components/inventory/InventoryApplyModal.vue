<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ApiSuccess } from '~/types/api'
import type { Room } from '~/types/rooms'
import type { InventoryApplyInput } from '~/utils/validators/inventory'

const props = defineProps<{ open: boolean; buildingId: string }>()
const emit = defineEmits<{ close: []; apply: [input: InventoryApplyInput] }>()

const { data: roomsData, refresh } = await useFetch<ApiSuccess<Room[]>>(
  '/api/rooms',
  { query: { building_id: props.buildingId, limit: 200 }, immediate: false },
)

const selected = ref<Set<string>>(new Set())
const mode = ref<'merge' | 'replace'>('merge')
const confirmReplace = ref(false)

watch(() => props.open, (open) => {
  if (open) {
    selected.value = new Set()
    mode.value = 'merge'
    refresh()
  }
})

const rooms = computed(() => roomsData.value?.data ?? [])
const floorGroups = computed(() => {
  const groups = new Map<number, Room[]>()
  for (const room of rooms.value) {
    const list = groups.get(room.floor) ?? []
    list.push(room)
    groups.set(room.floor, list)
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([floor, items]) => ({ floor, items }))
})

const allSelected = computed(() => rooms.value.length > 0 && selected.value.size === rooms.value.length)

function toggle(roomId: string) {
  const next = new Set(selected.value)
  if (next.has(roomId)) next.delete(roomId)
  else next.add(roomId)
  selected.value = next
}

function toggleAll() {
  selected.value = allSelected.value ? new Set() : new Set(rooms.value.map(r => r.id))
}

function requestApply() {
  if (selected.value.size === 0) return
  if (mode.value === 'replace') {
    confirmReplace.value = true
    return
  }
  emitApply()
}

function emitApply() {
  confirmReplace.value = false
  emit('apply', { room_ids: [...selected.value], mode: mode.value })
}
</script>

<template>
  <UiModal :open="open" title="Áp dụng nội thất mẫu cho phòng" @close="emit('close')">
    <div class="space-y-4">
      <div class="space-y-2">
        <label class="flex items-center gap-2 text-sm">
          <input type="radio" value="merge" :checked="mode === 'merge'" @change="mode = 'merge'">
          Thêm món còn thiếu (giữ nội thất hiện có)
        </label>
        <label class="flex items-center gap-2 text-sm">
          <input type="radio" value="replace" :checked="mode === 'replace'" @change="mode = 'replace'">
          Thay toàn bộ nội thất của phòng
        </label>
      </div>

      <div class="flex items-center justify-between">
        <p class="text-xs text-ui-muted">Đã chọn {{ selected.size }} phòng</p>
        <UiButton variant="ghost" size="sm" :disabled="rooms.length === 0" @click="toggleAll">
          {{ allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả' }}
        </UiButton>
      </div>

      <div class="max-h-72 space-y-3 overflow-y-auto">
        <p v-if="rooms.length === 0" class="text-sm text-ui-muted">Tòa nhà chưa có phòng nào.</p>
        <div v-for="group in floorGroups" :key="group.floor">
          <p class="mb-1 text-xs font-semibold text-ui-accent">Tầng {{ group.floor }}</p>
          <div class="grid grid-cols-2 gap-1 sm:grid-cols-3">
            <label v-for="room in group.items" :key="room.id" class="flex items-center gap-2 text-sm">
              <input type="checkbox" :checked="selected.has(room.id)" @change="toggle(room.id)">
              <span class="font-mono">{{ room.roomNumber }}</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <UiButton variant="secondary" @click="emit('close')">Hủy</UiButton>
      <UiButton :disabled="selected.size === 0" @click="requestApply">Áp dụng</UiButton>
    </template>
  </UiModal>

  <UiConfirmModal
    :open="confirmReplace"
    title="Thay toàn bộ nội thất?"
    :message="`Nội thất hiện có của ${selected.size} phòng sẽ bị thay bằng danh sách mẫu. Thao tác không thể hoàn tác.`"
    confirm-label="Thay toàn bộ"
    @confirm="emitApply"
    @cancel="confirmReplace = false"
  />
</template>
