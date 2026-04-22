<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">{{ $t('nav.rooms') }}</h1>

    <UCard>
      <template #header>
        <h2 class="font-semibold">Thông tin phòng</h2>
      </template>
      <p class="text-gray-500">{{ $t('loading') }}</p>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'tenant', middleware: ['auth', 'role'] })
</script>
