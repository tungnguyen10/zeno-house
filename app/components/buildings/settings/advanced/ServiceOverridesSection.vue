<script setup lang="ts">
const source = useBuildingSettingsSource()
const id = source.id
const settings = source.settings
const contractRows = source.contractRows
const sharedSettingsSource = { status: source.status, error: source.error, refresh: source.refresh }

const {
  allServices: contractServices,
  isLoading: loadingContractServices,
  updateService: updateContractService,
} = useBuildingContractServices(id, {
  ...sharedSettingsSource,
  data: computed(() => settings.value?.contractServices ?? []),
})
</script>

<template>
  <UiSection
    title="Dịch vụ theo phòng"
    description="Bật/tắt, chỉnh đơn giá và số lượng riêng cho từng phòng. Thay đổi ở đây chỉ ảnh hưởng phòng đó."
  >
    <UiSurfacePanel density="compact">
      <BuildingContractServicesList
        :contracts="contractRows"
        :services="contractServices"
        :loading="loadingContractServices"
        @update="updateContractService"
      />
    </UiSurfacePanel>
  </UiSection>
</template>
