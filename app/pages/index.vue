<script setup lang="ts">
const user = useSupabaseUser()

if (!user.value) {
  await navigateTo('/login')
}
</script>

<template>
  loading...
</template>
