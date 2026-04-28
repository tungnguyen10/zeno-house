<script setup lang="ts">
defineProps<{
  icon: string;
  title: string;
  description: string;
  action?: { label: string; to: string };
}>();
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16 text-center">
    <div
      class="mb-4 flex size-14 items-center justify-center rounded-full bg-[--color-bg-muted]"
    >
      <component :is="icon" class="size-7 text-[--color-body]" />
    </div>
    <h3 class="text-base font-semibold text-[--color-title]">
      {{ title }}
    </h3>
    <p class="mt-1 max-w-sm text-sm text-[--color-body]">{{ description }}</p>
    <UButton v-if="action" :to="action.to" class="mt-6" color="primary">
      {{ action.label }}
    </UButton>
  </div>
</template>
