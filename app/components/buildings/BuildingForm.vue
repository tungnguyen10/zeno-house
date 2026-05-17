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

      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium text-white">Trạng thái</label>
        <select
          :value="modelValue.status"
          :disabled="loading"
          class="block w-full rounded-md border border-dark-border bg-dark-surface px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan/70 disabled:bg-dark-hover disabled:text-muted disabled:cursor-not-allowed"
          @change="update('status', ($event.target as HTMLSelectElement).value)"
        >
          <option value="active">Đang hoạt động</option>
          <option value="inactive">Ngừng hoạt động</option>
        </select>
      </div>
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
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-white">Loại tính tiền điện</label>
          <select
            :value="modelValue.electricityPricingType"
            :disabled="loading"
            class="block w-full rounded-md border border-dark-border bg-dark-surface px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan/70 disabled:bg-dark-hover disabled:text-muted disabled:cursor-not-allowed"
            @change="update('electricityPricingType', ($event.target as HTMLSelectElement).value)"
          >
            <option value="per_kwh">Theo kWh</option>
            <option value="fixed">Cố định</option>
            <option value="tiered">Lũy kế</option>
          </select>
        </div>

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
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-white">Loại tính tiền nước</label>
          <select
            :value="modelValue.waterPricingType"
            :disabled="loading"
            class="block w-full rounded-md border border-dark-border bg-dark-surface px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan/70 disabled:bg-dark-hover disabled:text-muted disabled:cursor-not-allowed"
            @change="update('waterPricingType', ($event.target as HTMLSelectElement).value)"
          >
            <option value="per_m3">Theo m³</option>
            <option value="per_person">Theo người</option>
            <option value="fixed_per_room">Cố định/phòng</option>
          </select>
        </div>

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
