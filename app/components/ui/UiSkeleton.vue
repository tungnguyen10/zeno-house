<script setup lang="ts">
defineProps<{
  // No required props — consumer controls size via class
}>()
</script>

<template>
  <div
    class="animate-pulse rounded-md bg-dark-hover"
    role="status"
    aria-label="Đang tải..."
  />
</template>
