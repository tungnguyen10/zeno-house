<script setup lang="ts">
export interface TenantFormData {
  full_name: string
  phone: string
  email: string
  id_number: string
  date_of_birth: string
  permanent_address: string
  notes: string
}

const props = withDefaults(defineProps<{
  modelValue: TenantFormData
  loading?: boolean
  errors?: Record<string, string[]>
}>(), {
  loading: false,
  errors: () => ({}),
})

const emit = defineEmits<{
  'update:modelValue': [value: TenantFormData]
  'submit': [value: TenantFormData]
  'cancel': []
}>()

function update<K extends keyof TenantFormData>(field: K, value: TenantFormData[K]) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}

function onSubmit() {
  emit('submit', props.modelValue)
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="onSubmit">
    <!-- full_name -->
    <UiInput
      label="Họ và tên"
      :model-value="modelValue.full_name"
      :error="errors.full_name?.[0]"
      :disabled="loading"
      required
      placeholder="Nguyễn Văn A"
      @update:model-value="update('full_name', $event)"
    />

    <!-- phone -->
    <UiInput
      label="Số điện thoại"
      :model-value="modelValue.phone"
      :error="errors.phone?.[0]"
      :disabled="loading"
      required
      placeholder="0901234567"
      @update:model-value="update('phone', $event)"
    />

    <!-- email -->
    <UiInput
      label="Email"
      type="email"
      :model-value="modelValue.email"
      :error="errors.email?.[0]"
      :disabled="loading"
      placeholder="example@email.com"
      @update:model-value="update('email', $event)"
    />

    <!-- id_number -->
    <UiInput
      label="Số CMND/CCCD"
      :model-value="modelValue.id_number"
      :error="errors.id_number?.[0]"
      :disabled="loading"
      placeholder="012345678901"
      @update:model-value="update('id_number', $event)"
    />

    <!-- date_of_birth -->
    <UiInput
      label="Ngày sinh"
      type="date"
      :model-value="modelValue.date_of_birth"
      :error="errors.date_of_birth?.[0]"
      :disabled="loading"
      @update:model-value="update('date_of_birth', $event)"
    />

    <!-- permanent_address -->
    <UiInput
      label="Địa chỉ thường trú"
      :model-value="modelValue.permanent_address"
      :error="errors.permanent_address?.[0]"
      :disabled="loading"
      placeholder="Số nhà, đường, phường/xã, tỉnh/thành"
      @update:model-value="update('permanent_address', $event)"
    />

    <!-- notes -->
    <div class="flex flex-col gap-1.5">
      <label class="text-sm font-medium text-white">Ghi chú</label>
      <textarea
        :value="modelValue.notes"
        :disabled="loading"
        rows="3"
        placeholder="Thông tin thêm về khách thuê..."
        class="block w-full rounded-md border border-dark-border bg-dark-surface px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan/70 disabled:bg-dark-hover disabled:text-muted disabled:cursor-not-allowed resize-none"
        @input="update('notes', ($event.target as HTMLTextAreaElement).value)"
      />
      <p v-if="errors.notes?.[0]" class="text-xs text-error">{{ errors.notes[0] }}</p>
    </div>

    <!-- Actions -->
    <div class="flex justify-end gap-3 pt-2">
      <UiButton type="button" variant="secondary" :disabled="loading" @click="emit('cancel')">
        Huỷ
      </UiButton>
      <UiButton type="submit" :loading="loading">
        Lưu
      </UiButton>
    </div>
  </form>
</template>
