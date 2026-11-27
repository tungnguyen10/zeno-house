<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useContractHandoverInventory } from '~/composables/contracts/useContractHandoverInventory'
import type { InventoryItemInput } from '~/utils/validators/inventory'

const props = withDefaults(defineProps<{
  contractId: string
  roomId?: string
  renewed?: boolean
  editable?: boolean
  locked?: boolean | null
}>(), { roomId: '', editable: false, renewed: false, locked: null })

const emit = defineEmits<{ saved: [] }>()
const auth = useAuthStore()
const inventory = useContractHandoverInventory(() => props.contractId)
const { data, loading, saving, importing, error, errors, serverLocked } = inventory
const editing = ref(false)
const draft = ref<InventoryItemInput[]>([])
const confirmRoom = ref(false)
const saved = ref(false)
const canUpdate = computed(() => props.editable && auth.can('contracts.update'))
const isLocked = computed(() => props.locked !== false || serverLocked.value)
const busy = computed(() => saving.value || importing.value)
const items = computed(() => data.value?.items ?? [])
const sourceNote = computed(() => {
  if (data.value?.sourceContractId && data.value.sourceContractId !== props.contractId) {
    return `Theo biên bản bàn giao của hợp đồng ${data.value.sourceContractCode}`
  }
  return null
})

watch(() => props.locked, (locked) => {
  if (locked === false) serverLocked.value = false
})
onMounted(inventory.load)
watch(() => props.contractId, () => {
  editing.value = false
  confirmRoom.value = false
  saved.value = false
  void inventory.load()
})

function beginEdit() {
  if (!canUpdate.value || isLocked.value || loading.value || !data.value) return
  draft.value = inventory.toDraft(items.value)
  errors.value = {}
  error.value = null
  saved.value = false
  editing.value = true
}

function cancel() {
  if (busy.value) return
  editing.value = false
  confirmRoom.value = false
  error.value = null
  errors.value = {}
}

async function importRoom() {
  if (!canUpdate.value || isLocked.value || !props.roomId) return
  const next = await inventory.fromRoom(props.roomId)
  confirmRoom.value = false
  if (next !== null) {
    draft.value = next
    errors.value = {}
  }
}

async function save() {
  if (!canUpdate.value || isLocked.value) return
  if (props.renewed && draft.value.length === 0) {
    error.value = 'Hợp đồng gia hạn đang kế thừa dữ liệu bàn giao: chưa hỗ trợ lưu danh sách trống. Bạn vẫn có thể thêm, bớt hoặc sửa từng món.'
    return
  }
  if (await inventory.save(draft.value)) {
    editing.value = false
    saved.value = true
    emit('saved')
  }
}
</script>

<template>
  <div class="min-w-0 space-y-3" :aria-busy="loading || busy">
    <p v-if="loading" role="status" class="text-sm text-ui-muted">Đang tải nội thất bàn giao…</p>
    <template v-else>
      <p v-if="sourceNote" class="text-xs text-ui-muted">{{ sourceNote }}</p>
      <UiAlert v-if="error" severity="danger">{{ error }}</UiAlert>
      <UiButton v-if="!data" size="sm" variant="secondary" data-test="handover-retry" @click="inventory.load()">Thử lại</UiButton>
      <template v-else>
        <p v-if="canUpdate && (locked === true || serverLocked)" class="text-xs text-ui-muted">
          Hợp đồng đã phát hành tài liệu. Nội thất bàn giao được khóa để khớp với tài liệu đã phát hành.
        </p>
        <p v-else-if="canUpdate && locked === null" class="text-xs text-ui-muted">
          Chờ tải danh sách tài liệu để xác định quyền chỉnh sửa. Nếu tải lỗi, hãy tải lại trang.
        </p>
        <template v-if="editing">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <p class="text-xs text-ui-muted">Chỉ cập nhật bàn giao của hợp đồng này. Nội thất phòng được giữ nguyên.</p>
            <UiButton
              v-if="roomId && auth.can('rooms.read')" size="sm" variant="secondary"
              class="shrink-0 whitespace-nowrap" data-test="handover-from-room" :disabled="busy || isLocked" @click="error = null; confirmRoom = true"
            >Lấy lại từ phòng</UiButton>
          </div>
          <InventoryItemsEditor v-model="draft" :disabled="busy || isLocked || !canUpdate" :errors="errors" />
          <div class="flex flex-wrap justify-end gap-2 border-t border-ui-border pt-3">
            <UiButton size="sm" variant="secondary" :disabled="busy" data-test="handover-cancel" @click="cancel">Hủy</UiButton>
            <UiButton size="sm" :loading="saving" :disabled="importing || isLocked || !canUpdate" data-test="handover-save" @click="save">Lưu bàn giao</UiButton>
          </div>
        </template>
        <template v-else>
          <p v-if="saved" role="status" class="text-sm text-status-success">Đã lưu nội thất bàn giao.</p>
          <p v-if="items.length === 0" class="text-sm text-ui-muted">Không có dữ liệu bàn giao</p>
          <InventoryItemsList v-else :items="items" />
          <UiButton v-if="canUpdate && !isLocked" size="sm" variant="secondary" data-test="handover-edit" @click="beginEdit">Chỉnh sửa</UiButton>
        </template>
      </template>
    </template>
    <UiConfirmModal
      :open="confirmRoom" title="Lấy lại nội thất từ phòng?"
      message="Danh sách đang sửa sẽ được thay bằng nội thất hiện tại của phòng. Bạn có thể kiểm tra và chỉnh sửa trước khi lưu vào hợp đồng."
      confirm-label="Lấy lại từ phòng" :loading="importing"
      @confirm="importRoom" @cancel="!importing && (confirmRoom = false)"
    />
  </div>
</template>
