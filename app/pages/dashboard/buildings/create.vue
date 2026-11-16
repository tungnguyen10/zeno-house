<script setup lang="ts">

import type { BuildingFormData } from '~/types/building-form'
import { buildingFormToApiPayload } from '~/utils/mappers/building-form'

const formData = ref<BuildingFormData>({
  name: '',
  address: '',
  description: '',
  status: 'active',
  ownerName: '',
  ownerPhone: '',
  ownerEmail: '',
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

const preview = useQuickRoomPreview()

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

const submitLabel = computed(() => preview.enabled.value ? 'Tạo tòa nhà & phòng' : 'Tạo tòa nhà')

async function onSubmit(data: BuildingFormData) {
  if (preview.enabled.value && preview.duplicateRoomNumbers.value.length > 0) return
  await submitCreate({
    ...buildingFormToApiPayload(data),
    rooms: preview.enabled.value ? preview.toPayload() : undefined,
  } as Parameters<typeof submitCreate>[0])
}
</script>

<template>
  <div>
    <UiPageHeader
      title="Thêm tòa nhà mới"
      description="Khai báo thông tin toà nhà và tuỳ chọn tạo phòng ngay từ đầu."
      :back-to="'/dashboard/buildings'"
      back-label="Danh sách tòa nhà"
    />

    <UiAlert v-if="apiError" severity="danger" class="mb-4">
      {{ apiError }}
    </UiAlert>

    <BuildingForm
      v-model="formData"
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
          title="Tạo phòng nhanh"
          description="Tạo trước một loạt phòng theo dải tầng cùng lúc với tòa nhà. Có thể chỉnh tầng, giá, diện tích từng phòng."
        >
          <UiCheckbox v-model="preview.enabled.value" label="Bật tạo phòng nhanh" />
          <RoomBatchGenerator v-if="preview.enabled.value" :preview="preview" class="mt-4" />
        </UiFormSection>
      </template>
    </BuildingForm>
  </div>
</template>
