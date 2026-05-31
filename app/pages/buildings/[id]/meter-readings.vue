<script setup lang="ts">
// Legacy meter-readings page — redirect to billing workspace
const route = useRoute()
const id = route.params.id as string
const now = new Date()

navigateTo(`/buildings/${id}/billing?year=${now.getFullYear()}&month=${now.getMonth() + 1}`, { replace: true })
</script>

<template>
  <div class="text-muted text-sm">Đang chuyển hướng...</div>
</template>
