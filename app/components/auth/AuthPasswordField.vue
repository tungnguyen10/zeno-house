<script setup lang="ts">
defineOptions({ inheritAttrs: false })

defineProps<{
  modelValue: string
  label: string
  error?: string
  placeholder?: string
  autocomplete?: string
  disabled?: boolean
  required?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const visible = ref(false)
</script>

<template>
  <UiInput
    v-bind="$attrs"
    :model-value="modelValue"
    :label="label"
    :type="visible ? 'text' : 'password'"
    :error="error"
    :placeholder="placeholder"
    :autocomplete="autocomplete"
    :disabled="disabled"
    :required="required"
    @update:model-value="emit('update:modelValue', String($event))"
  >
    <template #suffix>
      <button
        type="button"
        class="-m-1 rounded-md p-1 text-muted transition-colors hover:bg-dark-hover hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40 disabled:cursor-not-allowed disabled:opacity-50"
        :aria-label="visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'"
        :aria-pressed="visible"
        :disabled="disabled"
        @click="visible = !visible"
      >
        <IconEyeOff v-if="visible" class="size-4" aria-hidden="true" />
        <IconEye v-else class="size-4" aria-hidden="true" />
      </button>
    </template>
  </UiInput>
</template>
