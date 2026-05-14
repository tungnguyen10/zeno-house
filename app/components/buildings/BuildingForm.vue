<script setup lang="ts">
import type { BuildingStatus } from '~/types/buildings'

export interface BuildingFormData {
  name: string
  address: string
  description: string
  status: BuildingStatus
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
  <form class="space-y-5" @submit.prevent="onSubmit">
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
