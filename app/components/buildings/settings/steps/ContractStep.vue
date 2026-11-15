<script setup lang="ts">
import { buildingEditPath } from '~/utils/routes/operational'
import type { BuildingContractProfileInput } from '~/utils/validators/building-contract-profile'

const emit = defineEmits<{ saved: [] }>()
const source = useBuildingSettingsSource()
const id = source.id
const settings = source.settings
const settingsData = source.settingsData
const building = source.building
const refreshSettings = source.refresh
const authStore = useAuthStore()
const toast = useToast()

const canEditContractProfile = computed(() => authStore.can('building-contract-profile.write'))
const {
  saving: savingContractProfile,
  error: contractProfileError,
  save: saveContractProfile,
} = useBuildingContractProfile(id, {
  data: computed(() => settings.value?.contractProfile ?? null),
  set: (profile) => {
    if (settingsData.value) {
      settingsData.value = {
        ...settingsData.value,
        data: { ...settingsData.value.data, contractProfile: profile },
      }
    }
  },
  onSaved: () => refreshSettings(),
})

async function handleSaveContractProfile(input: BuildingContractProfileInput) {
  try {
    await saveContractProfile(input)
    toast.success('Đã lưu thông tin hợp đồng của tòa nhà.')
    emit('saved')
  }
  catch {
    // The composable surfaces the standardized error beside the form.
  }
}
</script>

<template>
  <UiSection
    title="Thông tin trên hợp đồng"
    description="Áp dụng cho hợp đồng tạo mới. Hợp đồng đã phát hành không thay đổi."
  >
    <UiSurfacePanel density="compact">
      <BuildingContractProfileSettings
        v-if="building"
        :profile="settings?.contractProfile ?? null"
        :building="building"
        :can-edit="canEditContractProfile"
        :saving="savingContractProfile"
        :error="contractProfileError"
        :edit-path="buildingEditPath(building)"
        @save="handleSaveContractProfile"
      />
    </UiSurfacePanel>
  </UiSection>
</template>
