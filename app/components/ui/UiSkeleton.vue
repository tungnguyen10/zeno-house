<script setup lang="ts">
// No props — class/style pass through via $attrs (inheritAttrs: true)
</script>

<template>
  <div
    class="ui-skeleton rounded-md bg-dark-border"
    role="status"
    aria-label="Đang tải..."
  />
</template>

<style scoped lang="scss">
.ui-skeleton {
  position: relative;
  overflow: hidden;
}

.ui-skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.045) 50%,
    transparent 100%
  );
  animation: ui-skeleton-shimmer 1.6s ease-in-out infinite;
}

@keyframes ui-skeleton-shimmer {
  100% { transform: translateX(100%); }
}

@media (prefers-reduced-motion: reduce) {
  .ui-skeleton::after {
    animation: none;
    background: rgba(255, 255, 255, 0.025);
    transform: none;
  }
}
</style>
