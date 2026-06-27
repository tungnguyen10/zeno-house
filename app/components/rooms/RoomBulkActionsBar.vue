<script setup lang="ts">
import type { Room } from '~/types/rooms'
import type { RoomBulkAction, RoomBulkResult } from '~/composables/rooms/useRoomBulkActions'

const props = defineProps<{
  selectedIds: string[]
  rooms: Room[]
  runAction: (action: RoomBulkAction) => Promise<RoomBulkResult>
  isRunning?: boolean
}>()

const emit = defineEmits<{
  'clear': []
  'done': [result: RoomBulkResult, action: RoomBulkAction]
}>()

const selectedCount = computed(() => props.selectedIds.length)

const selectedRooms = computed(() => {
  const map = new Map(props.rooms.map(room => [room.id, room]))
  return props.selectedIds.map(id => map.get(id)).filter((room): room is Room => !!room)
})

const previewNames = computed(() => selectedRooms.value.slice(0, 10).map(room => `Phòng ${room.roomNumber}`))
const extraCount = computed(() => Math.max(0, selectedRooms.value.length - 10))

const pendingAction = ref<RoomBulkAction | null>(null)
const confirmOpen = ref(false)
const deleteAck = ref(false)

function open(action: RoomBulkAction) {
  pendingAction.value = action
  deleteAck.value = false
  confirmOpen.value = true
}

function cancel() {
  confirmOpen.value = false
  pendingAction.value = null
}

const actionLabels: Record<RoomBulkAction, string> = {
  archive: 'Lưu trữ',
  activate: 'Đánh dấu trống',
  set_maintenance: 'Bảo trì',
  delete: 'Xoá nhiều',
}

const actionDescriptions: Record<RoomBulkAction, string> = {
  archive: 'Các phòng sẽ chuyển sang trạng thái lưu trữ.',
  activate: 'Các phòng sẽ chuyển sang trạng thái trống.',
  set_maintenance: 'Các phòng sẽ chuyển sang trạng thái đang bảo trì.',
  delete: 'Chỉ xoá được phòng không có hợp đồng đang hoạt động và chưa có chỉ số đồng hồ.',
}

async function confirm() {
  if (!pendingAction.value) return
  if (pendingAction.value === 'delete' && !deleteAck.value) return
  const action = pendingAction.value
  const result = await props.runAction(action)
  confirmOpen.value = false
  pendingAction.value = null
  emit('done', result, action)
}
</script>

<template>
  <div
    role="region"
    aria-label="Thao tác hàng loạt"
    class="sticky bottom-3 z-30 flex flex-col gap-3 rounded-xl border border-dark-border bg-dark-surface/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between"
  >
    <div class="flex items-center gap-3">
      <UiBadge variant="accent">{{ selectedCount }} đã chọn</UiBadge>
      <UiButton variant="ghost" size="sm" @click="emit('clear')">Bỏ chọn</UiButton>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <UiButton variant="secondary" size="sm" :disabled="!!isRunning || selectedCount === 0" @click="open('activate')">
        Đánh dấu trống
      </UiButton>
      <UiButton variant="secondary" size="sm" :disabled="!!isRunning || selectedCount === 0" @click="open('set_maintenance')">
        Bảo trì
      </UiButton>
      <UiButton variant="secondary" size="sm" :disabled="!!isRunning || selectedCount === 0" @click="open('archive')">
        Lưu trữ
      </UiButton>
      <UiButton variant="danger" size="sm" :disabled="!!isRunning || selectedCount === 0" @click="open('delete')">
        Xoá nhiều
      </UiButton>
    </div>

    <UiConfirmModal
      :open="confirmOpen"
      :title="pendingAction ? `${actionLabels[pendingAction]} ${selectedCount} phòng` : ''"
      :message="pendingAction ? actionDescriptions[pendingAction] : ''"
      :confirm-label="pendingAction ? actionLabels[pendingAction] : 'Xác nhận'"
      :loading="!!isRunning"
      @cancel="cancel"
      @confirm="confirm"
    >
      <div class="space-y-3">
        <p class="text-sm text-muted">{{ pendingAction ? actionDescriptions[pendingAction] : '' }}</p>
        <ul class="space-y-1 text-sm text-white">
          <li v-for="name in previewNames" :key="name" class="truncate">• {{ name }}</li>
          <li v-if="extraCount > 0" class="text-muted">...và {{ extraCount }} phòng khác</li>
        </ul>
        <label v-if="pendingAction === 'delete'" class="flex items-start gap-2 text-sm text-muted">
          <input v-model="deleteAck" type="checkbox" class="mt-1 h-4 w-4 rounded border-dark-border bg-dark-surface text-cyan focus:ring-cyan/40">
          <span>Tôi hiểu thao tác này không thể hoàn tác.</span>
        </label>
      </div>
    </UiConfirmModal>
  </div>
</template>
