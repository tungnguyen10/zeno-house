<script setup lang="ts">
import type { BuildingContractProfilePatch } from '~/utils/validators/building-contract-profile'

withDefaults(defineProps<{ submitLabel?: string }>(), { submitLabel: 'Lưu' })
const emit = defineEmits<{ saved: [] }>()
const source = useBuildingSettingsSource()
const authStore = useAuthStore()
const toast = useToast()

const { saving, error, patch } = useBuildingContractProfile(source.id, {
  data: computed(() => source.settings.value?.contractProfile ?? null),
  set: (profile) => {
    if (source.settingsData.value) {
      source.settingsData.value = {
        ...source.settingsData.value,
        data: { ...source.settingsData.value.data, contractProfile: profile },
      }
    }
  },
  onSaved: () => source.refresh(),
})

async function onSave(input: BuildingContractProfilePatch) {
  try {
    await patch(input)
    toast.success('Đã lưu điều khoản hợp đồng.')
    emit('saved')
  }
  catch {
    // The composable surfaces the standardized error beside the form.
  }
}
</script>

<template>
  <BuildingContractTermsForm
    v-if="source.building.value"
    :profile="source.settings.value?.contractProfile ?? null"
    :building="source.building.value"
    :can-edit="authStore.can('building-contract-profile.write')"
    :saving="saving"
    :error="error"
    :submit-label="submitLabel"
    @save="onSave"
  />
</template>
