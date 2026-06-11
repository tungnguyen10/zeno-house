<script setup lang="ts">
import type { BuildingStatus, ElectricityPricingType, WaterPricingType } from '~/types/buildings'

export interface BuildingFormData {
  name: string
  address: string
  description: string
  status: BuildingStatus
  ownerName: string
  ownerPhone: string
  ownerEmail: string
  electricityPricingType: ElectricityPricingType
  defaultElectricityRate: string
  waterPricingType: WaterPricingType
  defaultWaterRate: string
  meterReadingDay: string
  billingGenerationDay: string
  paymentDueDay: string
  gracePeriodDays: string
}

const props = withDefaults(defineProps<{
  modelValue: BuildingFormData
  loading?: boolean
  errors?: Record<string, string[]>
}>(), {
  loading: false,
  errors: () => ({}),
})

const emit = defineEmits<{
  'update:modelValue': [value: BuildingFormData]
  'submit': [value: BuildingFormData]
  'cancel': []
}>()

function update(field: keyof BuildingFormData, value: string) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}

function onSubmit() {
  emit('submit', props.modelValue)
}
</script>

<template>
  <form class="space-y-8" @submit.prevent="onSubmit">
    <!-- Basic info -->
    <div class="space-y-5">
      <h3 class="text-sm font-semibold text-white border-b border-dark-border pb-2">Thông tin cơ bản</h3>

      <UiInput
        :model-value="modelValue.name"
        label="Tên tòa nhà"
        placeholder="Ví dụ: Tòa nhà Sunrise"
        required
        :disabled="loading"
        :error="errors?.name?.[0]"
        @update:model-value="update('name', $event)"
      />

      <UiInput
        :model-value="modelValue.address"
        label="Địa chỉ"
        placeholder="Ví dụ: 123 Nguyễn Huệ, Q.1, TP.HCM"
        required
        :disabled="loading"
        :error="errors?.address?.[0]"
        @update:model-value="update('address', $event)"
      />

      <UiInput
        :model-value="modelValue.description"
        label="Mô tả"
        placeholder="Mô tả ngắn về tòa nhà (tuỳ chọn)"
        :disabled="loading"
        :error="errors?.description?.[0]"
        @update:model-value="update('description', $event)"
      />

      <UiSelect
        :model-value="modelValue.status"
        label="Trạng thái"
        :options="[
          { value: 'active', label: 'Đang hoạt động' },
          { value: 'inactive', label: 'Ngừng hoạt động' },
        ]"
        :disabled="loading"
        @update:model-value="update('status', String($event))"
      />
    </div>

    <!-- Owner / Contact -->
    <div class="space-y-5">
      <h3 class="text-sm font-semibold text-white border-b border-dark-border pb-2">Chủ sở hữu</h3>

      <UiInput
        :model-value="modelValue.ownerName"
        label="Tên chủ nhà"
        placeholder="Ví dụ: Nguyễn Văn A"
        :disabled="loading"
        :error="errors?.owner_name?.[0]"
        @update:model-value="update('ownerName', $event)"
      />

      <UiInput
        :model-value="modelValue.ownerPhone"
        label="Số điện thoại chủ nhà"
        placeholder="Ví dụ: 0901234567"
        :disabled="loading"
        :error="errors?.owner_phone?.[0]"
        @update:model-value="update('ownerPhone', $event)"
      />

      <UiInput
        :model-value="modelValue.ownerEmail"
        label="Email chủ nhà"
        placeholder="Ví dụ: chuunha@gmail.com"
        :disabled="loading"
        :error="errors?.owner_email?.[0]"
        @update:model-value="update('ownerEmail', $event)"
      />
    </div>

    <!-- Billing defaults -->
    <div class="space-y-5">
      <h3 class="text-sm font-semibold text-white border-b border-dark-border pb-2">Cấu hình tính phí mặc định</h3>

      <div class="grid grid-cols-2 gap-4">
        <UiSelect
          :model-value="modelValue.electricityPricingType"
          label="Loại tính tiền điện"
          :options="[
            { value: 'per_kwh', label: 'Theo kWh' },
            { value: 'fixed', label: 'Cố định' },
            { value: 'tiered', label: 'Lũy kế' },
          ]"
          :disabled="loading"
          @update:model-value="update('electricityPricingType', String($event))"
        />

        <UiInput
          :model-value="modelValue.defaultElectricityRate"
          label="Đơn giá điện (đ/kWh)"
          placeholder="Ví dụ: 3500"
          :disabled="loading"
          :error="errors?.default_electricity_rate?.[0]"
          @update:model-value="update('defaultElectricityRate', $event)"
        />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <UiSelect
          :model-value="modelValue.waterPricingType"
          label="Loại tính tiền nước"
          :options="[
            { value: 'per_m3', label: 'Theo m³' },
            { value: 'per_person', label: 'Theo người' },
            { value: 'fixed_per_room', label: 'Cố định/phòng' },
          ]"
          :disabled="loading"
          @update:model-value="update('waterPricingType', String($event))"
        />

        <UiInput
          :model-value="modelValue.defaultWaterRate"
          label="Đơn giá nước"
          placeholder="Ví dụ: 15000"
          :disabled="loading"
          :error="errors?.default_water_rate?.[0]"
          @update:model-value="update('defaultWaterRate', $event)"
        />
      </div>
    </div>

    <!-- Operational schedule -->
    <div class="space-y-5">
      <h3 class="text-sm font-semibold text-white border-b border-dark-border pb-2">Lịch vận hành</h3>

      <div class="grid grid-cols-2 gap-4">
        <UiInput
          :model-value="modelValue.meterReadingDay"
          label="Ngày chốt số (1–31)"
          placeholder="Ví dụ: 25"
          :disabled="loading"
          :error="errors?.meter_reading_day?.[0]"
          @update:model-value="update('meterReadingDay', $event)"
        />

        <UiInput
          :model-value="modelValue.billingGenerationDay"
          label="Ngày lập hóa đơn (1–31)"
          placeholder="Ví dụ: 28"
          :disabled="loading"
          :error="errors?.billing_generation_day?.[0]"
          @update:model-value="update('billingGenerationDay', $event)"
        />

        <UiInput
          :model-value="modelValue.paymentDueDay"
          label="Ngày đến hạn (1–31)"
          placeholder="Ví dụ: 5"
          :disabled="loading"
          :error="errors?.payment_due_day?.[0]"
          @update:model-value="update('paymentDueDay', $event)"
        />

        <UiInput
          :model-value="modelValue.gracePeriodDays"
          label="Số ngày gia hạn"
          placeholder="Ví dụ: 5"
          :disabled="loading"
          :error="errors?.grace_period_days?.[0]"
          @update:model-value="update('gracePeriodDays', $event)"
        />
      </div>
    </div>

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
