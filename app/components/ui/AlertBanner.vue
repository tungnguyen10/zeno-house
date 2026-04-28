<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    message: string;
    action?: { label: string; to: string };
    variant?: "warning" | "danger";
  }>(),
  { variant: "warning" },
);

const dismissed = ref(false);

const classes = computed(() =>
  props.variant === "warning"
    ? "bg-[--color-warning-bg] border-[--color-warning] text-[--color-warning]"
    : "bg-[--color-error-bg] border-[--color-error] text-[--color-error]",
);
</script>

<template>
  <div
    v-if="!dismissed"
    :class="cn('flex items-center gap-3 rounded-lg border px-4 py-3 text-sm', classes)"
    role="alert"
  >
    <IconAlertCircle class="size-4 shrink-0" />
    <span class="flex-1">{{ message }}</span>
    <NuxtLink
      v-if="action"
      :to="action.to"
      class="shrink-0 font-medium underline underline-offset-2 hover:no-underline"
    >
      {{ action.label }}
    </NuxtLink>
    <button
      class="shrink-0 opacity-50 transition-opacity hover:opacity-100"
      aria-label="Đóng"
      @click="dismissed = true"
    >
      <IconX class="size-4" />
    </button>
  </div>
</template>
