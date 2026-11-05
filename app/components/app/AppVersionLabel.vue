<script setup lang="ts">
const { public: { appVersion } } = useRuntimeConfig()
</script>

<template>
  <p
    v-if="appVersion"
    class="text-[11px] leading-4 text-ui-muted tabular-nums"
    data-app-version
  >
    Phiên bản v{{ appVersion }}
  </p>
</template>
