<script setup lang="ts">
import type { Building } from '~/types/buildings'
import type { BuildingBulkAction, BuildingBulkResult } from '~/composables/buildings/useBuildingBulkActions'

const props = defineProps<{
  selectedIds: string[]
  buildings: Building[]
  /** Owner of the selection state (page) runs the action via the composable. */
  runAction: (action: BuildingBulkAction) => Promise<BuildingBulkResult>
  isRunning?: boolean
}>()

const emit = defineEmits<{
  'clear': []
  'done': [result: BuildingBulkResult, action: BuildingBulkAction]
}>()

const selectedCount = computed(() => props.selectedIds.length)

const selectedBuildings = computed(() => {
  const map = new Map(props.buildings.map(b => [b.id, b]))
  return props.selectedIds.map(id => map.get(id)).filter((b): b is Building => !!b)
})

const previewNames = computed(() => selectedBuildings.value.slice(0, 10).map(b => b.name))
const extraCount = computed(() => Math.max(0, selectedBuildings.value.length - 10))

const pendingAction = ref<BuildingBulkAction | null>(null)
const confirmOpen = ref(false)
const deleteAck = ref(false)

function open(action: BuildingBulkAction) {
  pendingAction.value = action
  deleteAck.value = false
  confirmOpen.value = true
}

function cancel() {
  confirmOpen.value = false
  pendingAction.value = null
}

const actionLabels: Record<BuildingBulkAction, string> = {
  archive: 'Lưu trữ',
  activate: 'Đánh dấu hoạt động',
  delete: 'Xoá vĩnh viễn',
}

const actionDescriptions: Record<BuildingBulkAction, string> = {
  archive: 'Toà nhà sẽ chuyển sang trạng thái lưu trữ.',
  activate: 'Toà nhà sẽ chuyển sang trạng thái đang hoạt động.',
  delete: 'Hành động này không thể hoàn tác. Chỉ xoá được toà nhà không còn phòng và không có hợp đồng đang hoạt động.',
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
        Đánh dấu hoạt động
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
      :title="pendingAction ? `${actionLabels[pendingAction]} ${selectedCount} toà nhà` : ''"
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
          <li v-if="extraCount > 0" class="text-muted">…và {{ extraCount }} toà nhà khác</li>
        </ul>
        <UiCheckbox
          v-if="pendingAction === 'delete'"
          v-model="deleteAck"
          label="Tôi hiểu thao tác này không thể hoàn tác."
          label-class="!text-muted"
        />
      </div>
    </UiConfirmModal>
  </div>
</template>
