<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { InventoryApplyInput } from '~/utils/validators/inventory'

interface ApplyRoom {
  id: string
  roomNumber: string
  floor: number
}

const props = withDefaults(defineProps<{
  open: boolean
  rooms: ApplyRoom[]
  saving?: boolean
  error?: string | null
}>(), {
  saving: false,
  error: null,
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'apply', input: InventoryApplyInput): void
}>()

const selected = ref<string[]>([])
const mode = ref<InventoryApplyInput['mode']>('merge')
const confirmingReplace = ref(false)

watch(() => props.open, (open) => {
  if (!open) return
  selected.value = []
  mode.value = 'merge'
  confirmingReplace.value = false
})
watch(mode, () => { confirmingReplace.value = false })

const floors = computed(() => {
  const byFloor = new Map<number, ApplyRoom[]>()
  for (const room of props.rooms) byFloor.set(room.floor, [...(byFloor.get(room.floor) ?? []), room])
  return [...byFloor.entries()].sort(([a], [b]) => a - b).map(([floor, rooms]) => ({ floor, rooms }))
})
const allSelected = computed(() => props.rooms.length > 0 && selected.value.length === props.rooms.length)

function toggleAll(checked: boolean) {
  selected.value = checked ? props.rooms.map(room => room.id) : []
}

function toggleFloor(rooms: ApplyRoom[], checked: boolean) {
  const ids = new Set(rooms.map(room => room.id))
  const rest = selected.value.filter(id => !ids.has(id))
  selected.value = checked ? [...rest, ...ids] : rest
}

function floorChecked(rooms: ApplyRoom[]) {
  return rooms.every(room => selected.value.includes(room.id))
}

function toggleRoom(id: string, checked: boolean) {
  selected.value = checked ? [...selected.value, id] : selected.value.filter(item => item !== id)
}

function submit() {
  if (selected.value.length === 0 || props.saving) return
  if (mode.value === 'replace' && !confirmingReplace.value) {
    confirmingReplace.value = true
    return
  }
  emit('apply', { room_ids: selected.value, mode: mode.value })
}

const modeOptions = [
  { value: 'merge', label: 'Thêm món còn thiếu', hint: 'Giữ nội thất hiện có của phòng, chỉ thêm món chưa có.' },
  { value: 'replace', label: 'Thay toàn bộ', hint: 'Xóa nội thất hiện có của phòng và dùng đúng danh sách mẫu.' },
] as const
</script>

<template>
  <UiModal :open="open" title="Áp dụng nội thất mẫu" size="lg" @close="emit('close')">
    <div class="space-y-4">
      <fieldset class="space-y-2" :disabled="saving">
        <legend class="mb-1 text-xs font-medium uppercase tracking-wide text-ui-muted">Cách áp dụng</legend>
        <label v-for="option in modeOptions" :key="option.value" class="flex cursor-pointer items-start gap-2">
          <input v-model="mode" type="radio" name="inventory-apply-mode" :value="option.value" class="mt-1 accent-ui-accent">
          <span>
            <span class="block text-sm font-medium text-ui-primary">{{ option.label }}</span>
            <span class="block text-xs text-ui-muted">{{ option.hint }}</span>
          </span>
        </label>
      </fieldset>

      <div class="space-y-3">
        <UiCheckbox
          :model-value="allSelected"
          :indeterminate="selected.length > 0 && !allSelected"
          :label="`Chọn tất cả (${selected.length}/${rooms.length} phòng)`"
          :disabled="saving || rooms.length === 0"
          @update:model-value="toggleAll"
        />
        <p v-if="rooms.length === 0" class="text-sm text-ui-muted">Tòa nhà chưa có phòng.</p>
        <div class="max-h-72 space-y-3 overflow-y-auto rounded-xl border border-ui-border p-3">
          <section v-for="group in floors" :key="group.floor">
            <UiCheckbox
              :model-value="floorChecked(group.rooms)"
              :label="`Tầng ${group.floor}`"
              label-class="text-xs font-medium uppercase tracking-wide text-ui-muted"
              :disabled="saving"
              @update:model-value="(v: boolean) => toggleFloor(group.rooms, v)"
            />
            <div class="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1.5 pl-6 sm:grid-cols-4">
              <UiCheckbox
                v-for="room in group.rooms"
                :key="room.id"
                :model-value="selected.includes(room.id)"
                :label="room.roomNumber"
                :disabled="saving"
                @update:model-value="(v: boolean) => toggleRoom(room.id, v)"
              />
            </div>
          </section>
        </div>
      </div>

      <UiAlert v-if="confirmingReplace" severity="warning">
        Nội thất hiện có của {{ selected.length }} phòng sẽ bị thay bằng danh sách mẫu. Bấm xác nhận để tiếp tục.
      </UiAlert>
      <UiAlert v-if="error" severity="danger">{{ error }}</UiAlert>
    </div>

    <template #footer>
      <UiButton variant="secondary" :disabled="saving" @click="emit('close')">Huỷ</UiButton>
      <UiButton
        :variant="confirmingReplace ? 'danger' : 'primary'"
        :loading="saving"
        :disabled="selected.length === 0"
        @click="submit"
      >
        {{ confirmingReplace ? 'Xác nhận thay toàn bộ' : 'Áp dụng' }}
      </UiButton>
    </template>
  </UiModal>
</template>
