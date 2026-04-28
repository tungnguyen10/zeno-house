<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
  backTo?: string;
}>();
</script>

<template>
  <div class="flex items-start justify-between gap-4">
    <div class="flex items-start gap-3">
      <UButton
        v-if="backTo"
        :to="backTo"
        variant="ghost"
        color="neutral"
        class="-ml-2 mt-0.5"
        aria-label="Quay lại"
      >
        <IconArrowLeft class="size-5" />
      </UButton>
      <div>
        <h1 class="text-2xl font-semibold text-[--color-title]">
          {{ title }}
        </h1>
        <p v-if="description" class="mt-1 text-sm text-[--color-body]">
          {{ description }}
        </p>
      </div>
    </div>

    <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2 pt-0.5">
      <slot name="actions" />
    </div>
  </div>
</template>
