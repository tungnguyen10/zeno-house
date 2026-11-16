<script setup lang="ts">
// Editing now lives in the "basics" step of building settings; keep old links working.
const route = useRoute()
await navigateTo(`/dashboard/buildings/${route.params.id as string}/settings#basics`, { replace: true })
</script>

<template>
  <div />
</template>
