<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label: string;
    value: string | number;
    icon: string;
    variant?: "default" | "warning" | "danger";
    hint?: string;
  }>(),
  { variant: "default" },
);

const borderClass = computed(() =>
  props.variant === "warning"
    ? "border-l-4 border-l-amber-400"
    : props.variant === "danger"
      ? "border-l-4 border-l-red-500"
      : "",
);

const iconClass = computed(() =>
  props.variant === "warning"
    ? "text-[--color-warning]"
    : props.variant === "danger"
      ? "text-[--color-error]"
      : "text-[--color-body]",
);

const hintClass = computed(() =>
  props.variant === "warning"
    ? "text-[--color-warning]"
    : props.variant === "danger"
      ? "text-[--color-error]"
      : "text-[--color-body]",
);
</script>

<template>
  <UCard :class="cn('overflow-hidden', borderClass)">
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0 space-y-1">
        <p class="text-sm text-[--color-body]">{{ label }}</p>
        <p class="text-3xl font-bold tracking-tight text-[--color-title]">
          {{ value }}
        </p>
        <p v-if="hint" :class="cn('text-xs', hintClass)">{{ hint }}</p>
      </div>
      <component :is="icon" :class="cn('size-5 shrink-0 mt-0.5', iconClass)" />
    </div>
  </UCard>
</template>
