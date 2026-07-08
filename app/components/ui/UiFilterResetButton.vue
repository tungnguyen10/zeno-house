<script setup lang="ts">
withDefaults(defineProps<{
  label?: string
  disabled?: boolean
}>(), {
  label: 'Xoá bộ lọc',
  disabled: false,
})

const emit = defineEmits<{
  (e: 'click'): void
}>()
</script>

<template>
  <UiButton
    variant="ghost"
    size="sm"
    :disabled="disabled"
    @click="emit('click')"
  >
    <IconX class="h-3.5 w-3.5" aria-hidden="true" />
    {{ label }}
  </UiButton>
</template>