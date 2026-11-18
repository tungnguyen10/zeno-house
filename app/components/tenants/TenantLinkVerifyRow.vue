<script setup lang="ts">
defineProps<{
  phone: string
  proof: string
  verifying?: boolean
  disabled?: boolean
  error?: string | null
}>()

const emit = defineEmits<{ 'update:proof': [value: string]; 'submit': [] }>()
</script>

<template>
  <div data-test="tenant-link-verify">
    <p class="text-xs text-ui-muted">
      Khách cũ ở tòa khác? Nhập CCCD hoặc họ tên để dùng lại hồ sơ <span class="text-ui-primary">{{ phone }}</span>.
    </p>
    <div data-test="tenant-link-controls" class="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start">
      <UiInput
        :model-value="proof"
        data-test="tenant-link-proof"
        class="min-w-0 sm:flex-1"
        placeholder="CCCD hoặc họ tên"
        aria-label="Số CCCD hoặc họ tên khách"
        :disabled="disabled || verifying"
        @update:model-value="(v: string | number | null) => emit('update:proof', String(v ?? ''))"
        @keydown.enter.prevent="emit('submit')"
      />
      <UiButton
        data-test="tenant-link-submit"
        class="w-full sm:w-auto sm:shrink-0"
        variant="secondary"
        size="md"
        :loading="verifying"
        :disabled="disabled || !proof.trim()"
        @click="emit('submit')"
      >
        Xác minh
      </UiButton>
    </div>
    <p v-if="error" data-test="tenant-link-error" role="alert" class="mt-1.5 text-xs text-status-danger">{{ error }}</p>
  </div>
</template>
