<script setup lang="ts">
type EmptyVariant = 'default' | 'success' | 'search'
type EmptySize = 'sm' | 'md'

const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    variant?: EmptyVariant
    size?: EmptySize
  }>(),
  {
    variant: 'default',
    size: 'md',
  },
)

const containerClass = computed(() =>
  props.size === 'sm' ? 'py-6 px-4' : 'py-12 px-4',
)

const iconWrapperSize = computed(() =>
  props.size === 'sm' ? 'h-9 w-9' : 'h-11 w-11',
)

const iconWrapperTone = computed(() => {
  switch (props.variant) {
    case 'success': return 'bg-success-neon/10 ring-success-neon/25'
    default: return 'bg-dark-surface ring-dark-border'
  }
})

const iconSizeClass = computed(() => (props.size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'))

const iconTone = computed(() =>
  props.variant === 'success' ? 'text-success-neon' : 'text-muted',
)

const iconSpacing = computed(() => (props.size === 'sm' ? 'mb-3' : 'mb-4'))
</script>

<template>
  <div :class="['flex flex-col items-center justify-center text-center', containerClass]">
    <div :class="['flex items-center justify-center rounded-full ring-1', iconWrapperSize, iconWrapperTone, iconSpacing]">
      <slot name="icon">
        <IconCheckCircle v-if="variant === 'success'" :class="[iconSizeClass, iconTone]" aria-hidden="true" />
        <IconSearch v-else-if="variant === 'search'" :class="[iconSizeClass, iconTone]" aria-hidden="true" />
        <IconLayers v-else :class="[iconSizeClass, iconTone]" aria-hidden="true" />
      </slot>
    </div>

    <h3 class="text-sm font-semibold text-white">{{ title }}</h3>
    <p v-if="description" class="mt-1 max-w-sm text-sm text-muted">{{ description }}</p>

    <div v-if="$slots.action" class="mt-4">
      <slot name="action" />
    </div>
  </div>
</template>
