<script setup lang="ts">
import type { BuildingFormData } from '~/components/buildings/BuildingForm.vue'
import { buildingPath } from '~/utils/routes/operational'

const route = useRoute()
const id = route.params.id as string

const { building, error } = useBuildingDetail(id)

watchEffect(() => {
  if (error.value?.statusCode === 404) navigateTo('/buildings')
})

const { isLoading, errors, apiError, submitUpdate } = useBuildingForm()

const formData = ref<BuildingFormData>({
  name: building.value?.name ?? '',
  address: building.value?.address ?? '',
  description: building.value?.description ?? '',
  status: building.value?.status ?? 'active',
  ownerName: building.value?.ownerName ?? '',
  ownerPhone: building.value?.ownerPhone ?? '',
  ownerEmail: building.value?.ownerEmail ?? '',
  electricityPricingType: building.value?.electricityPricingType ?? 'per_kwh',
  defaultElectricityRate: building.value?.defaultElectricityRate?.toString() ?? '',
  waterPricingType: building.value?.waterPricingType ?? 'per_m3',
  defaultWaterRate: building.value?.defaultWaterRate?.toString() ?? '',
  meterReadingDay: building.value?.meterReadingDay?.toString() ?? '',
  billingGenerationDay: building.value?.billingGenerationDay?.toString() ?? '',
  paymentDueDay: building.value?.paymentDueDay?.toString() ?? '',
  gracePeriodDays: building.value?.gracePeriodDays?.toString() ?? '0',
})

watch(() => building.value, (b) => {
  if (!b) return
  formData.value = {
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
  }
})

const toNum = (v: string) => v === '' ? null : Number(v)
const toDay = (v: string) => v === '' ? null : Number(v)

async function onSubmit(data: BuildingFormData) {
  await submitUpdate(id, {
    name: data.name,
    address: data.address,
    description: data.description || null,
    status: data.status,
    owner_name: data.ownerName || null,
    owner_phone: data.ownerPhone || null,
    owner_email: data.ownerEmail || null,
    electricity_pricing_type: data.electricityPricingType,
    default_electricity_rate: toNum(data.defaultElectricityRate),
    water_pricing_type: data.waterPricingType,
    default_water_rate: toNum(data.defaultWaterRate),
    meter_reading_day: toDay(data.meterReadingDay),
    billing_generation_day: toDay(data.billingGenerationDay),
    payment_due_day: toDay(data.paymentDueDay),
    grace_period_days: data.gracePeriodDays === '' ? 0 : Number(data.gracePeriodDays),
  })
}
</script>

<template>
  <div class="max-w-3xl">
    <UiPageHeader title="Chỉnh sửa tòa nhà">
      <NuxtLink :to="building ? buildingPath(building) : `/buildings/${id}`" class="text-sm text-muted hover:text-white transition-colors">
        ← {{ building?.name ?? 'Chi tiết tòa nhà' }}
      </NuxtLink>
    </UiPageHeader>

    <UiAlert v-if="apiError" severity="danger" class="mb-4">
      {{ apiError }}
    </UiAlert>

    <div class="rounded-xl border border-dark-border bg-dark-surface p-6">
      <BuildingForm
        v-model="formData"
        :loading="isLoading"
        :errors="errors"
        @submit="onSubmit"
        @cancel="navigateTo(building ? buildingPath(building) : `/buildings/${id}`)"
      />
    </div>
  </div>
</template>
