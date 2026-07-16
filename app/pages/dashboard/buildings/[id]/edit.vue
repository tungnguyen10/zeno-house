<script setup lang="ts">

import type { BuildingFormData } from '~/types/building-form'
import { buildingFormToApiPayload } from '~/utils/mappers/building-form'
import { buildingPath } from '~/utils/routes/operational'

const route = useRoute()
const id = route.params.id as string

const { building, error } = useBuildingDetail(id)

watchEffect(() => {
  if (error.value?.statusCode === 404) navigateTo('/dashboard/buildings')
})

function emptyForm(): BuildingFormData {
  return {
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
  }
}

function buildingToForm(b: NonNullable<typeof building.value>): BuildingFormData {
  return {
    name: b.name,
    address: b.address,
    description: b.description ?? '',
    status: b.status,
    ownerName: b.ownerName ?? '',
    ownerPhone: b.ownerPhone ?? '',
    ownerEmail: b.ownerEmail ?? '',
    electricityPricingType: b.electricityPricingType,
    defaultElectricityRate: b.defaultElectricityRate?.toString() ?? '',
    waterPricingType: b.waterPricingType,
    defaultWaterRate: b.defaultWaterRate?.toString() ?? '',
    meterReadingDay: b.meterReadingDay?.toString() ?? '',
    billingGenerationDay: b.billingGenerationDay?.toString() ?? '',
    paymentDueDay: b.paymentDueDay?.toString() ?? '',
    gracePeriodDays: b.gracePeriodDays?.toString() ?? '0',
    operationalStartYear: b.operationalStartYear?.toString() ?? '',
    operationalStartMonth: b.operationalStartMonth?.toString() ?? '',
  }
}

const formData = ref<BuildingFormData>(building.value ? buildingToForm(building.value) : emptyForm())

// Snapshot drives isDirty; refreshed whenever the server data refetches.
const initialSnapshot = computed<BuildingFormData | null>(() =>
  building.value ? buildingToForm(building.value) : null,
)

watch(() => building.value, (b) => {
  if (!b) return
  formData.value = buildingToForm(b)
})

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
  draftKey: { mode: 'edit', id },
  formData,
  initialSnapshot,
})
async function onSubmit(data: BuildingFormData) {
  await submitUpdate(id, buildingFormToApiPayload(data))
}
</script>

<template>
  <div>
    <UiPageHeader
      :title="building?.name ? `Chỉnh sửa · ${building.name}` : 'Chỉnh sửa tòa nhà'"
      description="Cập nhật thông tin chung và cấu hình vận hành."
      :back-to="building ? buildingPath(building) : `/dashboard/buildings/${id}`"
      :back-label="building?.name ?? 'Chi tiết tòa nhà'"
    />

    <UiAlert v-if="apiError" severity="danger" class="mb-4">
      {{ apiError }}
    </UiAlert>

    <div class="rounded-xl border border-dark-border bg-dark-surface p-6">
      <BuildingForm
        v-model="formData"
        :loading="isLoading"
        :errors="errors"
        :has-draft="hasDraft"
        :is-dirty="isDirty"
        submit-label="Cập nhật"
        @submit="onSubmit"
        @cancel="navigateTo(building ? buildingPath(building) : `/dashboard/buildings/${id}`)"
        @restore-draft="restoreDraft"
        @discard-draft="clearDraft"
      />
    </div>
  </div>
</template>
