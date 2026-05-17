<script setup lang="ts">
import type { BuildingFormData } from '~/components/buildings/BuildingForm.vue'

const { isLoading, errors, apiError, submitCreate } = useBuildingForm()

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
})

// Quick room setup state
const enableQuickRooms = ref(false)
const quickRoomCount = ref(3)
const quickRoomPrefix = ref('P')
const quickRoomNumberStart = ref(101)
const quickDefaultRent = ref(0)
const quickDefaultArea = ref<number | null>(null)
const quickSamePriceForAll = ref(true)

interface PreviewRoom {
  roomNumber: string
  rent: number
  area: number | null
}

const previewRooms = computed<PreviewRoom[]>(() => {
  if (!enableQuickRooms.value) return []
  return Array.from({ length: quickRoomCount.value }, (_, i) => ({
    roomNumber: `${quickRoomPrefix.value}${quickRoomNumberStart.value + i}`,
    rent: quickDefaultRent.value,
    area: quickDefaultArea.value,
  }))
})

const hasDuplicateRoomCodes = computed(() => {
  const codes = previewRooms.value.map(r => r.roomNumber)
  return new Set(codes).size !== codes.length
})

function updatePreviewRent(index: number, value: number) {
  previewRooms.value[index]!.rent = value
}


const quickRoomError = ref<string | null>(null)

async function onSubmit(data: BuildingFormData) {
  quickRoomError.value = null

  if (enableQuickRooms.value && hasDuplicateRoomCodes.value) {
    quickRoomError.value = 'Mã phòng bị trùng. Vui lòng kiểm tra lại.'
    return
  }

  const toNum = (v: string) => v === '' ? null : Number(v)
  const toDay = (v: string) => v === '' ? null : Number(v)

  await submitCreate({
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
    quickRooms: enableQuickRooms.value ? previewRooms.value.map(r => ({
      room_number: r.roomNumber,
      monthly_rent: r.rent,
      area: r.area,
    })) : undefined,
  } as Parameters<typeof submitCreate>[0])
}
</script>

<template>
  <div class="max-w-3xl">
    <div class="mb-6">
      <NuxtLink to="/buildings" class="text-sm text-muted hover:text-white transition-colors">
        ← Danh sách tòa nhà
      </NuxtLink>
      <h1 class="text-xl font-semibold text-white mt-2">Thêm tòa nhà mới</h1>
    </div>

    <div v-if="apiError" class="mb-4 rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
      {{ apiError }}
    </div>

    <div class="rounded-xl border border-dark-border bg-dark-surface p-6 mb-6">
      <BuildingForm
        v-model="formData"
        :loading="isLoading"
        :errors="errors"
        @submit="onSubmit"
        @cancel="navigateTo('/buildings')"
      >
        <template #actions>
          <!-- actions rendered below after quick room section -->
          <span />
        </template>
      </BuildingForm>
    </div>

    <!-- Quick room setup -->
    <div class="rounded-xl border border-dark-border bg-dark-surface p-6 mb-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-semibold text-white">Tạo phòng nhanh</h3>
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            v-model="enableQuickRooms"
            type="checkbox"
            class="h-4 w-4 rounded border-dark-border accent-cyan"
          >
          <span class="text-sm text-muted">Bật tạo phòng nhanh</span>
        </label>
      </div>

      <template v-if="enableQuickRooms">
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-white">Số lượng phòng</label>
            <input
              v-model.number="quickRoomCount"
              type="number"
              min="1"
              max="100"
              class="block w-full rounded-md border border-dark-border bg-dark-surface px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan/70"
            >
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-white">Tiền tố mã phòng</label>
            <input
              v-model="quickRoomPrefix"
              type="text"
              maxlength="10"
              placeholder="Ví dụ: P, A, B"
              class="block w-full rounded-md border border-dark-border bg-dark-surface px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan/70"
            >
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-white">Số bắt đầu</label>
            <input
              v-model.number="quickRoomNumberStart"
              type="number"
              min="1"
              class="block w-full rounded-md border border-dark-border bg-dark-surface px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan/70"
            >
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-white">Giá thuê mặc định (đ)</label>
            <input
              v-model.number="quickDefaultRent"
              type="number"
              min="0"
              class="block w-full rounded-md border border-dark-border bg-dark-surface px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan/70"
            >
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-white">Diện tích (m²)</label>
            <input
              v-model.number="quickDefaultArea"
              type="number"
              min="1"
              placeholder="Tuỳ chọn"
              class="block w-full rounded-md border border-dark-border bg-dark-surface px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan/70"
            >
          </div>
        </div>

        <!-- Preview table -->
        <div v-if="previewRooms.length" class="mt-4">
          <div v-if="hasDuplicateRoomCodes" class="mb-2 text-sm text-error">
            ⚠ Mã phòng bị trùng. Vui lòng thay đổi tiền tố hoặc số bắt đầu.
          </div>
          <p class="text-xs text-muted mb-2">Xem trước {{ previewRooms.length }} phòng sẽ được tạo:</p>
          <div class="overflow-x-auto rounded-lg border border-dark-border">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-dark-border bg-dark-hover">
                  <th class="px-3 py-2 text-left text-xs text-muted font-medium">Mã phòng</th>
                  <th class="px-3 py-2 text-left text-xs text-muted font-medium">Giá thuê (đ)</th>
                  <th class="px-3 py-2 text-left text-xs text-muted font-medium">Diện tích (m²)</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(room, i) in previewRooms"
                  :key="room.roomNumber"
                  class="border-b border-dark-border last:border-0"
                >
                  <td class="px-3 py-2 text-white font-mono">{{ room.roomNumber }}</td>
                  <td class="px-3 py-2">
                    <input
                      v-if="!quickSamePriceForAll"
                      :value="room.rent"
                      type="number"
                      min="0"
                      class="w-full rounded border border-dark-border bg-dark-hover px-2 py-1 text-sm text-white"
                      @input="updatePreviewRent(i, Number(($event.target as HTMLInputElement).value))"
                    >
                    <span v-else class="text-white">{{ room.rent.toLocaleString('vi-VN') }}</span>
                  </td>
                  <td class="px-3 py-2 text-muted">{{ room.area ?? '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <label class="flex items-center gap-2 mt-3 cursor-pointer">
            <input
              v-model="quickSamePriceForAll"
              type="checkbox"
              class="h-4 w-4 rounded border-dark-border accent-cyan"
            >
            <span class="text-sm text-muted">Đồng giá cho tất cả phòng</span>
          </label>
        </div>

        <div v-if="quickRoomError" class="mt-3 text-sm text-error">
          {{ quickRoomError }}
        </div>
      </template>
    </div>

    <div class="flex items-center justify-end gap-3">
      <UiButton variant="secondary" type="button" @click="navigateTo('/buildings')">
        Huỷ
      </UiButton>
      <UiButton :loading="isLoading" @click="onSubmit(formData)">
        {{ enableQuickRooms ? 'Tạo tòa nhà & phòng' : 'Tạo tòa nhà' }}
      </UiButton>
    </div>
  </div>
</template>
