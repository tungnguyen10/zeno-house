<script setup lang="ts">
import type { Building } from '~/types/buildings'
import type { BuildingFormData } from '~/types/building-form'
import { buildingFormToApiPayload, buildingToFormData } from '~/utils/mappers/building-form'

const props = withDefaults(defineProps<{ building: Building, submitLabel?: string }>(), { submitLabel: 'Lưu thông tin' })

const emit = defineEmits<{
  saved: [building: Building]
  cancel: []
  'update:dirty': [dirty: boolean]
}>()

const formData = ref<BuildingFormData>(buildingToFormData(props.building))
const initialSnapshot = computed<BuildingFormData>(() => buildingToFormData(props.building))

const {
  isLoading,
  errors,
  apiError,
  submitUpdate,
  hasDraft,
  restoreDraft,
  clearDraft,
  isDirty,
} = useBuildingForm<BuildingFormData>({
  draftKey: { mode: 'edit', id: props.building.id },
  formData,
  initialSnapshot,
  onUpdated: saved => emit('saved', saved),
})

// A refresh from another step must not overwrite edits in progress.
watch(() => props.building, (next) => {
  if (!isDirty.value) formData.value = buildingToFormData(next)
})
watch(isDirty, dirty => emit('update:dirty', dirty), { immediate: true })

async function onSubmit(data: BuildingFormData) {
  await submitUpdate(props.building.id, buildingFormToApiPayload(data))
}
</script>

<template>
  <div class="space-y-4">
    <UiAlert v-if="apiError" severity="danger">{{ apiError }}</UiAlert>
    <BuildingForm
      v-model="formData"
      variant="basics"
      :loading="isLoading"
      :errors="errors"
      :has-draft="hasDraft"
      :is-dirty="isDirty"
      :submit-label="submitLabel"
      @submit="onSubmit"
      @cancel="emit('cancel')"
      @restore-draft="restoreDraft"
      @discard-draft="clearDraft"
    />
  </div>
</template>
