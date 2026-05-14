<script setup lang="ts">
withDefaults(defineProps<{
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  loading?: boolean
}>(), {
  confirmLabel: 'Xoá',
  loading: false,
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <UiModal :open="open" :title="title" @close="emit('cancel')">
    <slot>
      <p class="text-sm text-muted">{{ message }}</p>
    </slot>
    <template #footer>
      <UiButton variant="secondary" @click="emit('cancel')">Huỷ</UiButton>
      <UiButton variant="danger" :loading="loading" @click="emit('confirm')">
        {{ confirmLabel }}
      </UiButton>
    </template>
  </UiModal>
</template>
