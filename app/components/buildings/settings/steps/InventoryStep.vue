<script setup lang="ts">
import type { InventoryApplyInput, InventoryItemInput } from '~/utils/validators/inventory'
import { getApiErrorMessage } from '~/utils/api-error'

const props = defineProps<{
  template: ReturnType<typeof useInventoryTemplate>
  buildingId: string
  canEdit: boolean
}>()

const emit = defineEmits<{ saved: [] }>()
const toast = useToast()
const source = useBuildingSettingsSource()

const APPLY_BATCH_LIMIT = 200

const { items, saving, error } = props.template
const draft = ref<InventoryItemInput[]>([])
const applyOpen = ref(false)
const justSaved = ref(false)
const applyingPending = ref(false)
// Rooms already filled in this session, so the alert is correct even before the bootstrap refresh lands.
const appliedRoomIds = ref(new Set<string>())

const pendingRooms = computed(() =>
  (source.settings.value?.roomIdsWithoutInventory ?? []).filter(roomId => !appliedRoomIds.value.has(roomId)),
)
const showApplySuggestion = computed(() =>
  justSaved.value && props.template.items.value.length > 0 && pendingRooms.value.length > 0,
)

watchEffect(() => {
  draft.value = items.value.map(item => ({
    name: item.name, quantity: item.quantity, condition: item.condition, unit_value: item.unitValue, note: item.note,
  }))
})

async function handleSave() {
  try {
    await props.template.save(draft.value)
    toast.success('Đã lưu nội thất mẫu của tòa nhà.')
    justSaved.value = true
    emit('saved')
  }
  catch {
    // The composable surfaces the standardized error beside the editor.
  }
}

async function applyToPending() {
  const batch = pendingRooms.value.slice(0, APPLY_BATCH_LIMIT)
  applyingPending.value = true
  try {
    await props.template.apply({ room_ids: batch, mode: 'merge' })
    appliedRoomIds.value = new Set([...appliedRoomIds.value, ...batch])
    await source.refresh()
    toast.success('Đã áp dụng nội thất mẫu.')
  }
  catch (cause) {
    toast.error(getApiErrorMessage(cause, 'Không áp dụng được nội thất mẫu.'))
  }
  finally {
    applyingPending.value = false
  }
}

async function handleApply(input: InventoryApplyInput) {
  try {
    const result = await props.template.apply(input)
    applyOpen.value = false
    toast.success(`Đã thêm ${result.addedItems} món cho ${result.appliedRooms} phòng.`)
  }
  catch (cause) {
    toast.error(getApiErrorMessage(cause, 'Không áp dụng được nội thất mẫu.'))
  }
}
</script>

<template>
  <UiSection
    title="Nội thất mẫu của tòa nhà"
    description="Danh sách này được sao chép vào phòng khi áp dụng; sửa từng phòng không ảnh hưởng mẫu."
  >
    <template #actions>
      <UiButton size="sm" variant="secondary" @click="applyOpen = true">Áp dụng cho phòng…</UiButton>
    </template>
    <UiSurfacePanel density="compact">
      <UiAlert v-if="error" severity="danger" class="mb-3">{{ error }}</UiAlert>
      <InventoryItemsEditor v-model="draft" :disabled="!canEdit" />
      <div v-if="canEdit" class="mt-3 flex justify-end">
        <UiButton size="sm" :loading="saving" @click="handleSave">Lưu nội thất mẫu</UiButton>
      </div>
    </UiSurfacePanel>

    <UiAlert v-if="showApplySuggestion" severity="info" class="mt-3" data-test="inventory-apply-suggestion">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span>{{ pendingRooms.length }} phòng chưa có nội thất.</span>
        <UiButton size="sm" variant="secondary" :loading="applyingPending" @click="applyToPending">
          Áp dụng cho {{ pendingRooms.length }} phòng
        </UiButton>
      </div>
    </UiAlert>
  </UiSection>

  <InventoryApplyModal
    :open="applyOpen"
    :building-id="buildingId"
    @close="applyOpen = false"
    @apply="handleApply"
  />
</template>
