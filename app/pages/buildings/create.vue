<script setup lang="ts">
import type { BuildingFormData } from '~/components/buildings/BuildingForm.vue'
import type { UiTableColumn } from '~/components/ui/UiTable.vue'

interface PreviewRoom {
  roomNumber: string
  rent: number
  area: number | null
}

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

const previewColumns: UiTableColumn<PreviewRoom>[] = [
  { key: 'roomNumber', label: 'Mã phòng' },
  { key: 'rent', label: 'Giá thuê (đ)', numeric: true },
  { key: 'area', label: 'Diện tích (m²)', numeric: true },
]

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
    <UiPageHeader title="Thêm tòa nhà mới">
      <NuxtLink to="/buildings" class="text-sm text-muted hover:text-white transition-colors">
        ← Danh sách tòa nhà
      </NuxtLink>
    </UiPageHeader>

    <UiAlert v-if="apiError" severity="danger" class="mb-4">
      {{ apiError }}
    </UiAlert>

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
        <UiCheckbox
          v-model="enableQuickRooms"
          label="Bật tạo phòng nhanh"
        />
      </div>

      <template v-if="enableQuickRooms">
        <div class="grid grid-cols-2 gap-4 mb-4">
          <UiInput
            label="Số lượng phòng"
            type="number"
            :model-value="String(quickRoomCount)"
            @update:model-value="(v) => quickRoomCount = Number(v)"
          />
          <UiInput
            v-model="quickRoomPrefix"
            label="Tiền tố mã phòng"
            placeholder="Ví dụ: P, A, B"
          />
          <UiInput
            label="Số bắt đầu"
            type="number"
            :model-value="String(quickRoomNumberStart)"
            @update:model-value="(v) => quickRoomNumberStart = Number(v)"
          />
          <UiInput
            label="Giá thuê mặc định (đ)"
            type="number"
            :model-value="String(quickDefaultRent)"
            @update:model-value="(v) => quickDefaultRent = Number(v)"
          />
          <UiInput
            label="Diện tích (m²)"
            type="number"
            :model-value="quickDefaultArea !== null ? String(quickDefaultArea) : ''"
            placeholder="Tuỳ chọn"
            @update:model-value="(v) => quickDefaultArea = v === '' ? null : Number(v)"
          />
        </div>

        <!-- Preview table -->
        <div v-if="previewRooms.length" class="mt-4">
          <UiAlert v-if="hasDuplicateRoomCodes" severity="warning" class="mb-2">
            Mã phòng bị trùng. Vui lòng thay đổi tiền tố hoặc số bắt đầu.
          </UiAlert>
          <p class="text-xs text-muted mb-2">Xem trước {{ previewRooms.length }} phòng sẽ được tạo:</p>
          <UiTable
            :rows="previewRooms"
            :columns="previewColumns"
            row-key="roomNumber"
          >
            <template #cell-roomNumber="{ row }">
              <span class="font-mono text-white">{{ row.roomNumber }}</span>
            </template>
            <template #cell-rent="{ row }">
              <UiInput
                v-if="!quickSamePriceForAll"
                density="compact"
                type="number"
                :model-value="String(row.rent)"
                @update:model-value="(v) => updatePreviewRent(previewRooms.indexOf(row), Number(v))"
              />
              <span v-else>{{ row.rent.toLocaleString('vi-VN') }}</span>
            </template>
            <template #cell-area="{ row }">
              {{ row.area ?? '—' }}
            </template>
          </UiTable>
          <UiCheckbox
            v-model="quickSamePriceForAll"
            label="Đồng giá cho tất cả phòng"
            class="mt-3"
          />
        </div>

        <UiAlert v-if="quickRoomError" severity="danger" class="mt-3">
          {{ quickRoomError }}
        </UiAlert>
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
