<script setup lang="ts">
import clsx from 'clsx'
import type { BuildingFormData } from '~/types/building-form'
import { buildingFormToApiPayload } from '~/utils/mappers/building-form'
import type { UiTableColumn } from '~/components/ui/UiTable.vue'

import type { PreviewRoom } from '~/composables/buildings/useQuickRoomPreview'
import { QUICK_ROOM_MAX } from '~/utils/validators/buildings'

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

const flaggedRooms = computed(() => new Set([
  ...preview.duplicateRoomNumbers.value,
  ...preview.serverDuplicates.value,
]))

const previewColumns: UiTableColumn<PreviewRoom>[] = [
  { key: 'roomNumber', label: 'Mã phòng' },
  { key: 'floor', label: 'Tầng', numeric: true },
  { key: 'rent', label: 'Giá thuê (đ)', numeric: true },
  { key: 'area', label: 'Diện tích (m²)', numeric: true },
]

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
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <UiInput
                label="Số lượng phòng"
                type="number"
                number-mode="integer"
                min="1"
                :max="QUICK_ROOM_MAX"
                :hint="`Tối đa ${QUICK_ROOM_MAX} phòng`"
                :disabled="isLoading"
                :model-value="String(preview.count.value)"
                @update:model-value="(v) => preview.count.value = Math.min(QUICK_ROOM_MAX, Math.max(1, Math.trunc(Number(v)) || 1))"
              />
              <UiInput
                v-model="preview.prefix.value"
                label="Tiền tố mã phòng"
                placeholder="Ví dụ: P, A, B"
                :disabled="isLoading"
              />
              <UiInput
                label="Số bắt đầu"
                type="number"
                number-mode="integer"
                :disabled="isLoading"
                :model-value="String(preview.start.value)"
                @update:model-value="(v) => preview.start.value = Math.trunc(Number(v)) || 0"
              />
              <UiInput
                label="Tầng mặc định"
                type="number"
                number-mode="integer"
                min="1"
                max="100"
                :disabled="isLoading"
                :model-value="String(preview.defaultFloor.value)"
                @update:model-value="(v) => preview.defaultFloor.value = Math.min(100, Math.max(1, Math.trunc(Number(v)) || 1))"
              />
              <UiInput
                label="Giá thuê mặc định (đ)"
                type="number"
                number-mode="currency"
                :disabled="isLoading"
                :model-value="String(preview.defaultRent.value)"
                @update:model-value="(v) => preview.defaultRent.value = Number(v) || 0"
              />
              <UiInput
                label="Diện tích mặc định (m²)"
                type="number"
                number-mode="area"
                min="0"
                placeholder="Tùy chọn"
                :disabled="isLoading"
                :model-value="preview.defaultArea.value !== null ? String(preview.defaultArea.value) : ''"
                @update:model-value="(v) => preview.defaultArea.value = v === '' ? null : Number(v)"
              />
            </div>

            <UiAlert v-if="errors.rooms?.length" severity="danger" class="mt-4">
              Kiểm tra thông tin phòng: {{ errors.rooms.join(' ') }}
            </UiAlert>
            <UiAlert v-if="flaggedRooms.size" severity="warning" class="mt-4 break-words">
              Các mã phòng bị trùng: {{ [...flaggedRooms].join(', ') }}. Đổi tiền tố hoặc số bắt đầu rồi thử lại.
            </UiAlert>

            <div v-if="preview.rows.value.length" class="mt-5 min-w-0">
              <p class="mb-2 text-xs text-ui-muted">Xem trước {{ preview.rows.value.length }} phòng sẽ được tạo:</p>
              <UiCheckbox
                v-model="preview.samePrice.value"
                label="Đồng giá cho tất cả phòng"
                :disabled="isLoading"
                class="mb-3"
              />
              <p class="mb-3 text-xs text-ui-muted">
                Ô đã sửa giữ giá trị khi đổi mặc định. Bật đồng giá sẽ đặt lại giá thuê của tất cả phòng.
              </p>
              <div class="max-w-full overflow-x-auto" role="region" aria-label="Xem trước phòng" tabindex="0">
                <UiTable :rows="preview.rows.value" :columns="previewColumns" row-key="roomNumber" caption="Phòng sẽ được tạo cùng tòa nhà" class="min-w-[640px]">
                  <template #cell-roomNumber="{ row }">
                    <span :class="clsx('font-mono break-all', flaggedRooms.has(row.roomNumber) ? 'text-status-danger' : 'text-ui-primary')">
                      {{ row.roomNumber }}
                    </span>
                    <span v-if="flaggedRooms.has(row.roomNumber)" class="block text-xs text-status-danger">Mã trùng</span>
                  </template>
                  <template #cell-floor="{ row }">
                    <div :class="clsx('min-w-24 rounded-md', row.overridden.includes('floor') && 'bg-ui-accent/10')">
                      <UiInput
                        density="compact"
                        type="number"
                        number-mode="integer"
                        min="1"
                        max="100"
                        :disabled="isLoading"
                        :aria-label="`Tầng phòng ${row.roomNumber}`"
                        :model-value="String(row.floor)"
                        @update:model-value="(v) => preview.setCell(row.roomNumber, 'floor', Math.min(100, Math.max(1, Math.trunc(Number(v)) || 1)))"
                      />
                      <div v-if="row.overridden.includes('floor')" class="flex items-center justify-end gap-1 whitespace-nowrap">
                        <span class="text-xs text-ui-muted">Đã sửa</span>
                        <UiButton
                          variant="ghost"
                          size="sm"
                          :disabled="isLoading"
                          :aria-label="`Khôi phục tầng mặc định cho phòng ${row.roomNumber}`"
                          @click="preview.resetCell(row.roomNumber, 'floor')"
                        >
                          Mặc định
                        </UiButton>
                      </div>
                    </div>
                  </template>
                  <template #cell-rent="{ row }">
                    <div v-if="!preview.samePrice.value" :class="clsx('min-w-40 rounded-md', row.overridden.includes('rent') && 'bg-ui-accent/10')">
                      <UiInput
                        density="compact"
                        type="number"
                        number-mode="currency"
                        :disabled="isLoading"
                        :aria-label="`Giá thuê phòng ${row.roomNumber}`"
                        :model-value="String(row.rent)"
                        @update:model-value="(v) => preview.setCell(row.roomNumber, 'rent', Number(v) || 0)"
                      />
                      <div v-if="row.overridden.includes('rent')" class="flex items-center justify-end gap-1 whitespace-nowrap">
                        <span class="text-xs text-ui-muted">Đã sửa</span>
                        <UiButton
                          variant="ghost"
                          size="sm"
                          :disabled="isLoading"
                          :aria-label="`Khôi phục giá thuê mặc định cho phòng ${row.roomNumber}`"
                          @click="preview.resetCell(row.roomNumber, 'rent')"
                        >
                          Mặc định
                        </UiButton>
                      </div>
                    </div>
                    <span v-else>{{ row.rent.toLocaleString('vi-VN') }}</span>
                  </template>
                  <template #cell-area="{ row }">
                    <div :class="clsx('min-w-32 rounded-md', row.overridden.includes('area') && 'bg-ui-accent/10')">
                      <UiInput
                        density="compact"
                        type="number"
                        number-mode="area"
                        min="0"
                        placeholder="—"
                        :disabled="isLoading"
                        :aria-label="`Diện tích phòng ${row.roomNumber}`"
                        :model-value="row.area !== null ? String(row.area) : ''"
                        @update:model-value="(v) => preview.setCell(row.roomNumber, 'area', v === '' ? null : Number(v))"
                      />
                      <div v-if="row.overridden.includes('area')" class="flex items-center justify-end gap-1 whitespace-nowrap">
                        <span class="text-xs text-ui-muted">Đã sửa</span>
                        <UiButton
                          variant="ghost"
                          size="sm"
                          :disabled="isLoading"
                          :aria-label="`Khôi phục diện tích mặc định cho phòng ${row.roomNumber}`"
                          @click="preview.resetCell(row.roomNumber, 'area')"
                        >
                          Mặc định
                        </UiButton>
                      </div>
                    </div>
                  </template>
                </UiTable>
              </div>
            </div>
          </template>
        </UiFormSection>
      </template>
    </BuildingForm>
  </div>
</template>
