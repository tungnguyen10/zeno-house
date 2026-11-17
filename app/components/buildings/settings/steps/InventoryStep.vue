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

const { items, saving, error } = props.template
const draft = ref<InventoryItemInput[]>([])
const applyOpen = ref(false)

watchEffect(() => {
  draft.value = items.value.map(item => ({
    name: item.name, quantity: item.quantity, condition: item.condition, unit_value: item.unitValue, note: item.note,
  }))
})

async function handleSave() {
  try {
    await props.template.save(draft.value)
    toast.success('Đã lưu nội thất mẫu của tòa nhà.')
    emit('saved')
  }
  catch {
    // The composable surfaces the standardized error beside the editor.
  }
}

async function handleApply(input: InventoryApplyInput) {
  try {
    const result = await props.template.apply(input)
    applyOpen.value = false
    toast.success(result.addedItems > 0
      ? `Đã thêm ${result.addedItems} món cho ${result.appliedRooms} phòng.`
      : `${result.appliedRooms} phòng đã có đủ nội thất mẫu, không thêm món nào.`)
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
  </UiSection>

  <InventoryApplyModal
    :open="applyOpen"
    :building-id="buildingId"
    @close="applyOpen = false"
    @apply="handleApply"
  />
</template>
