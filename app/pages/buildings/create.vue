<script setup lang="ts">
import type { BuildingFormData } from '~/types/building-form'
import { buildingFormToApiPayload } from '~/utils/mappers/building-form'
import type { UiTableColumn } from '~/components/ui/UiTable.vue'

interface PreviewRoom {
  roomNumber: string
  rent: number
  area: number | null
}

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
  hasDraft,
  restoreDraft,
  clearDraft,
  isDirty,
} = useBuildingForm<BuildingFormData>({
  draftKey: { mode: 'create' },
  formData,
  initialSnapshot,
})

// Quick room setup state
const enableQuickRooms = ref(false)
const quickRoomCount = ref(3)
const quickRoomPrefix = ref('P')
const quickRoomNumberStart = ref(101)
const quickDefaultRent = ref(0)
const quickDefaultArea = ref<number | null>(null)
const quickSamePriceForAll = ref(true)
const quickRoomError = ref<string | null>(null)

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

const previewColumns: UiTableColumn<PreviewRoom>[] = [
  { key: 'roomNumber', label: 'Mã phòng' },
  { key: 'rent', label: 'Giá thuê (đ)', numeric: true },
  { key: 'area', label: 'Diện tích (m²)', numeric: true },
]

const submitLabel = computed(() => enableQuickRooms.value ? 'Tạo tòa nhà & phòng' : 'Tạo tòa nhà')

async function onSubmit(data: BuildingFormData) {
  quickRoomError.value = null
  if (enableQuickRooms.value && hasDuplicateRoomCodes.value) {
    quickRoomError.value = 'Mã phòng bị trùng. Vui lòng kiểm tra lại.'
    return
  }
  await submitCreate({
    ...buildingFormToApiPayload(data),
    quickRooms: enableQuickRooms.value
      ? previewRooms.value.map(r => ({
          room_number: r.roomNumber,
          monthly_rent: r.rent,
          area: r.area,
        }))
      : undefined,
  } as Parameters<typeof submitCreate>[0])
}
</script>

<template>
  <div>
    <UiPageHeader
      title="Thêm tòa nhà mới"
      description="Khai báo thông tin toà nhà và tuỳ chọn tạo phòng ngay từ đầu."
      :back-to="'/buildings'"
      back-label="Danh sách tòa nhà"
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
      :submit-label="submitLabel"
      @submit="onSubmit"
      @cancel="navigateTo('/buildings')"
      @restore-draft="restoreDraft"
      @discard-draft="clearDraft"
    >
      <template #extras>
        <div class="border-t border-dark-border" />
        <section class="space-y-4">
          <header class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-sm font-semibold text-white">Tạo phòng nhanh</h3>
              <p class="text-xs text-muted mt-0.5">Tạo trước một loạt phòng (mã, giá thuê) cùng lúc với toà nhà — tuỳ chọn.</p>
            </div>
            <UiCheckbox v-model="enableQuickRooms" label="Bật" />
          </header>

          <template v-if="enableQuickRooms">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <UiInput
                label="Số lượng phòng"
                type="number"
                :model-value="String(quickRoomCount)"
                @update:model-value="(v) => quickRoomCount = Math.max(1, Number(v) || 1)"
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
                @update:model-value="(v) => quickRoomNumberStart = Number(v) || 0"
              />
              <UiInput
                label="Giá thuê mặc định (đ)"
                type="number"
                :model-value="String(quickDefaultRent)"
                @update:model-value="(v) => quickDefaultRent = Number(v) || 0"
              />
              <UiInput
                label="Diện tích (m²)"
                type="number"
                placeholder="Tuỳ chọn"
                :model-value="quickDefaultArea !== null ? String(quickDefaultArea) : ''"
                @update:model-value="(v) => quickDefaultArea = v === '' ? null : Number(v)"
              />
            </div>

            <div v-if="previewRooms.length" class="mt-5">
              <UiAlert v-if="hasDuplicateRoomCodes" severity="warning" class="mb-3">
                Mã phòng bị trùng. Vui lòng thay đổi tiền tố hoặc số bắt đầu.
              </UiAlert>
              <p class="mb-2 text-xs text-muted">Xem trước {{ previewRooms.length }} phòng sẽ được tạo:</p>
              <UiTable :rows="previewRooms" :columns="previewColumns" row-key="roomNumber">
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

            <UiAlert v-if="quickRoomError" severity="danger" class="mt-4">
              {{ quickRoomError }}
            </UiAlert>
          </template>
        </section>
      </template>
      </BuildingForm>
    </div>
  </div>
</template>
