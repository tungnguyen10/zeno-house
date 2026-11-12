<script setup lang="ts">
import type { BuildingFormData } from '~/types/building-form'
import { buildingFormToApiPayload } from '~/utils/mappers/building-form'

const preview = useQuickRoomPreview()

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

watch(duplicateRoomNumbers, value => preview.markServerDuplicates(value))

const submitLabel = computed(() => preview.enabled.value ? 'Tạo tòa nhà & phòng' : 'Tạo tòa nhà')

async function onSubmit(data: BuildingFormData) {
  if (isLoading.value || (preview.enabled.value && preview.duplicateRoomNumbers.value.length > 0)) return
  await submitCreate({
    ...buildingFormToApiPayload(data),
    rooms: preview.enabled.value ? preview.toPayload() : undefined,
  })
}
</script>

<template>
  <div class="min-w-0">
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
          description="Tạo trước một loạt phòng cùng lúc với tòa nhà. Có thể chỉnh tầng, giá, diện tích từng phòng."
        >
          <UiCheckbox v-model="preview.enabled.value" label="Bật tạo phòng nhanh" :disabled="isLoading" />
          <template v-if="preview.enabled.value">
            <UiAlert v-if="errors.rooms?.length" severity="danger" class="mt-4">
              Kiểm tra thông tin phòng: {{ errors.rooms.join(' ') }}
            </UiAlert>
            <RoomBatchGenerator class="mt-4" :preview="preview" :disabled="isLoading" />
          </template>
        </UiFormSection>
      </template>
    </BuildingForm>
  </div>
</template>
