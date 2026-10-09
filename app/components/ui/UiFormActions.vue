<script setup lang="ts">
/**
 * Shared form action pair: an inline row on desktop, a bar docked to the bottom
 * edge on mobile. While mounted it flags form mode so AppTabBar yields the slot
 * instead of stacking two bottom bars.
 */
withDefaults(defineProps<{
  submitLabel?: string
  cancelLabel?: string
  mobileSubmitLabel?: string
  mobileCancelLabel?: string
  loading?: boolean
  canSubmit?: boolean
}>(), {
  submitLabel: 'Lưu',
  cancelLabel: 'Huỷ',
  mobileSubmitLabel: undefined,
  mobileCancelLabel: undefined,
  loading: false,
  canSubmit: true,
})

const emit = defineEmits<{
  cancel: []
}>()

const formMode = useAppFormMode()
onMounted(() => { formMode.value = true })
onBeforeUnmount(() => { formMode.value = false })
</script>

<template>
  <div>
    <div class="hidden justify-end gap-3 border-t border-ui-border pt-4 sm:flex">
      <UiButton type="button" variant="secondary" :disabled="loading" @click="emit('cancel')">
        {{ cancelLabel }}
      </UiButton>
      <UiButton type="submit" :loading="loading" :disabled="!canSubmit">
        {{ submitLabel }}
      </UiButton>
    </div>

    <div
      data-test="sticky-save-bar"
      class="fixed inset-x-0 bottom-0 z-30 border-t border-ui-border bg-ui-chrome/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md sm:hidden"
    >
      <div class="mx-auto flex max-w-screen-sm gap-2">
        <UiButton
          type="button"
          variant="secondary"
          class="min-h-11 flex-1"
          :disabled="loading"
          @click="emit('cancel')"
        >
          {{ mobileCancelLabel ?? cancelLabel }}
        </UiButton>
        <UiButton type="submit" class="min-h-11 flex-1" :loading="loading" :disabled="!canSubmit">
          {{ mobileSubmitLabel ?? submitLabel }}
        </UiButton>
      </div>
    </div>
  </div>
</template>
