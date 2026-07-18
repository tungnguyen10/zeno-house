<script setup lang="ts">
import clsx from 'clsx'

const props = withDefaults(defineProps<{
  title: string
  description?: string
  tone?: 'default' | 'error'
  actionLabel?: string
}>(), {
  tone: 'default',
})

const emit = defineEmits<{
  (e: 'action'): void
}>()

const iconWrapperClass = computed(() =>
  clsx(
    'mb-4 flex h-14 w-14 items-center justify-center rounded-2xl',
    props.tone === 'error'
      ? 'bg-portal-danger/10 text-portal-danger'
      : 'bg-smoke-blue text-theme',
  ),
)
</script>

<template>
  <div
    class="flex flex-col items-center justify-center px-6 py-12 text-center"
    :data-tone="tone"
    :role="tone === 'error' ? 'alert' : undefined"
  >
    <div data-icon :class="iconWrapperClass">
      <slot name="icon">
        <IconAlertCircle v-if="tone === 'error'" class="h-6 w-6" aria-hidden="true" />
        <IconLayers v-else class="h-6 w-6" aria-hidden="true" />
      </slot>
    </div>
    <p class="text-base font-semibold text-title">{{ title }}</p>
    <p v-if="description" class="mt-1 max-w-xs text-sm text-body">{{ description }}</p>
    <PortalButton
      v-if="actionLabel"
      variant="secondary"
      size="sm"
      class="mt-5"
      @click="emit('action')"
    >
      {{ actionLabel }}
    </PortalButton>
  </div>
</template>
