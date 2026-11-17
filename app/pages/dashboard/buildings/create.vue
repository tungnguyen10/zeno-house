<script setup lang="ts">

import type { BuildingFormData } from '~/types/building-form'
import { buildingFormToApiPayload } from '~/utils/mappers/building-form'

const formData = ref<BuildingFormData>({
  name: '',
  address: '',
  description: '',
  status: 'active',
  electricityPricingType: 'per_kwh',
  defaultElectricityRate: '',
  waterPricingType: 'per_m3',
  defaultWaterRate: '',
  meterReadingDay: '',
  billingGenerationDay: '',
  paymentDueDay: '',
  gracePeriodDays: '0',
  operationalStartYear: '',
  operationalStartMonth: '',
})

const initialSnapshot = ref<BuildingFormData>({ ...formData.value })

// Starts with no rooms generated: creating a building with zero rooms must stay possible.
const preview = useQuickRoomPreview({ enabled: true, initialRoomsPerFloor: 0 })

const {
  isLoading,
  errors,
  apiError,
  submitCreate,
  duplicateRoomNumbers,
  hasDraft,
  restoreDraft,
  clearDraft,
  isDirty,
} = useBuildingForm<BuildingFormData>({
  draftKey: { mode: 'create' },
  formData,
  initialSnapshot,
})

// Server-reported duplicates stay highlighted until the generator inputs change.
watch(duplicateRoomNumbers, value => preview.markServerDuplicates(value))

const submitLabel = computed(() => {
  const count = preview.toPayload().length
  return count > 0 ? `Tạo tòa nhà và ${count} phòng` : 'Tạo tòa nhà'
})

// An invalid generator would otherwise create the building without the rooms the user configured.
const roomsBlocked = ref(false)
watch(preview.generatorError, (error) => { if (!error) roomsBlocked.value = false })

async function onSubmit(data: BuildingFormData) {
  if (preview.generatorError.value) {
    roomsBlocked.value = true
    return
  }
  if (preview.duplicateRoomNumbers.value.length > 0) return
  const rooms = preview.toPayload()
  await submitCreate({
    ...buildingFormToApiPayload(data),
    rooms: rooms.length ? rooms : undefined,
  } as Parameters<typeof submitCreate>[0])
}
</script>

<template>
  <div>
    <UiPageHeader
      title="Thêm tòa nhà mới"
      description="Khai báo tòa nhà và phòng. Bên cho thuê, giá điện nước, thanh toán sẽ thiết lập ở bước tiếp theo."
      :back-to="'/dashboard/buildings'"
      back-label="Danh sách tòa nhà"
    />

    <UiAlert v-if="apiError" severity="danger" class="mb-4">
      {{ apiError }}
    </UiAlert>

    <UiAlert v-if="roomsBlocked" severity="danger" class="mb-4">
      Sửa lỗi tạo phòng nhanh trước khi tạo tòa nhà.
    </UiAlert>

    <BuildingForm
      v-model="formData"
      variant="create"
      :loading="isLoading"
      :errors="errors"
      :has-draft="hasDraft"
      :is-dirty="isDirty"
      :submit-label="submitLabel"
      @submit="onSubmit"
      @cancel="navigateTo('/dashboard/buildings')"
      @restore-draft="restoreDraft"
      @discard-draft="clearDraft"
    >
      <template #extras>
        <UiFormSection
          title="Phòng"
          description="Tạo luôn các phòng theo tầng. Có thể bỏ trống và thêm phòng sau."
        >
          <RoomBatchGenerator :preview="preview" />
        </UiFormSection>
      </template>
    </BuildingForm>
  </div>
</template>
