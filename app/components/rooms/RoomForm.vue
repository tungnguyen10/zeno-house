<script setup lang="ts">
import type { Building } from '~/types/buildings'
import type { RoomStatus } from '~/types/rooms'
import type { ApiSuccess } from '~/types/api'

export interface RoomFormData {
  building_id: string
  room_number: string
  floor: number
  status: RoomStatus
  monthly_rent: number
  area: string
  description: string
}

const props = withDefaults(defineProps<{
  modelValue: RoomFormData
  loading?: boolean
  errors?: Record<string, string[]>
}>(), {
  loading: false,
  errors: () => ({}),
})

const emit = defineEmits<{
  'update:modelValue': [value: RoomFormData]
  'submit': [value: RoomFormData]
  'cancel': []
}>()

const { data: buildingsData } = await useFetch<ApiSuccess<Building[]> & { meta: { total: number } }>(
  '/api/buildings',
  { query: { limit: 100 } },
)
const buildings = computed(() => buildingsData.value?.data ?? [])

function update<K extends keyof RoomFormData>(field: K, value: RoomFormData[K]) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}

function onSubmit() {
  emit('submit', props.modelValue)
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="onSubmit">
    <!-- Building selector -->
    <UiSelect
      :model-value="modelValue.building_id"
      label="Tòa nhà"
      :options="buildings.map(b => ({ value: b.id, label: b.name }))"
      placeholder="-- Chọn tòa nhà --"
      required
      :disabled="loading"
      :error="errors?.building_id?.[0]"
      @update:model-value="update('building_id', String($event ?? ''))"
    />

    <UiInput
      :model-value="modelValue.room_number"
      label="Số phòng"
      placeholder="Ví dụ: 101, A2, Tầng 1 góc"
      required
      :disabled="loading"
      :error="errors?.room_number?.[0]"
      @update:model-value="update('room_number', $event)"
    />

    <UiInput
      :model-value="String(modelValue.floor)"
      label="Tầng"
      placeholder="1"
      type="number"
      required
      :disabled="loading"
      :error="errors?.floor?.[0]"
      @update:model-value="update('floor', Number($event))"
    />

    <!-- Status -->
    <UiSelect
      :model-value="modelValue.status"
      label="Trạng thái"
      :options="[
        { value: 'available', label: 'Trống' },
        { value: 'occupied', label: 'Đã có người thuê' },
        { value: 'maintenance', label: 'Đang bảo trì' },
      ]"
      :disabled="loading"
      @update:model-value="update('status', String($event) as RoomStatus)"
    />

    <div class="flex flex-col gap-1">
      <UiInput
        :model-value="String(modelValue.monthly_rent)"
        label="Giá thuê / tháng (VND)"
        placeholder="Ví dụ: 3500000"
        type="number"
        required
        :disabled="loading"
        :error="errors?.monthly_rent?.[0]"
        @update:model-value="update('monthly_rent', Number($event))"
      />
      <p class="text-xs text-muted">
        Đây là giá chuẩn của phòng — hợp đồng mới sẽ mặc định lấy theo giá này.
      </p>
    </div>

    <UiInput
      :model-value="modelValue.area"
      label="Diện tích (m²)"
      placeholder="Ví dụ: 25.5 (tuỳ chọn)"
      type="number"
      :disabled="loading"
      :error="errors?.area?.[0]"
      @update:model-value="update('area', $event)"
    />

    <UiInput
      :model-value="modelValue.description"
      label="Mô tả"
      placeholder="Mô tả ngắn về phòng (tuỳ chọn)"
      :disabled="loading"
      :error="errors?.description?.[0]"
      @update:model-value="update('description', $event)"
    />

    <div class="flex items-center justify-end gap-3 pt-2">
      <slot name="actions">
        <UiButton variant="secondary" type="button" @click="$emit('cancel')">
          Huỷ
        </UiButton>
        <UiButton type="submit" :loading="loading">
          Lưu
        </UiButton>
      </slot>
    </div>
  </form>
</template>
