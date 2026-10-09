<script setup lang="ts">
/**
 * Shared "unsaved draft" notice for full-page forms. Callers decide which
 * recovery actions apply: restore is always offered, dismiss only hides the
 * banner, clear deletes the stored draft.
 */
const props = withDefaults(defineProps<{
  savedAt?: string
  error?: string | null
  versionMismatch?: boolean
  dismissible?: boolean
  clearLabel?: string
}>(), {
  savedAt: '',
  error: null,
  versionMismatch: false,
  dismissible: false,
  clearLabel: 'Xoá bản nháp',
})

const emit = defineEmits<{
  restore: []
  dismiss: []
  clear: []
}>()

const savedLabel = computed(() => {
  if (!props.savedAt) return ''
  const date = new Date(props.savedAt)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('vi-VN')
})
</script>

<template>
  <UiAlert severity="info" data-test="draft-banner">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-start gap-2">
        <IconCheckCircle class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div>
          <p class="text-sm font-medium text-ui-primary">
            {{ versionMismatch ? 'Bản nháp cũ không tương thích — chỉ có thể xoá' : 'Có bản nháp chưa lưu' }}
          </p>
          <p v-if="error" class="mt-0.5 text-xs text-ui-muted">{{ error }}</p>
          <p v-else-if="savedLabel" class="mt-0.5 text-xs text-ui-muted">Lưu lúc {{ savedLabel }}</p>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <UiButton v-if="!versionMismatch" type="button" size="sm" variant="secondary" @click="emit('restore')">
          Khôi phục
        </UiButton>
        <UiButton
          v-if="dismissible && !versionMismatch"
          type="button"
          size="sm"
          variant="ghost"
          @click="emit('dismiss')"
        >
          Bỏ qua
        </UiButton>
        <UiButton type="button" size="sm" variant="ghost" @click="emit('clear')">
          {{ clearLabel }}
        </UiButton>
      </div>
    </div>
  </UiAlert>
</template>
