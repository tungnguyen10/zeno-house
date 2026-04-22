<template>
  <div>
    <div class="flex items-center gap-3 mb-6">
      <UButton variant="ghost" icon="i-heroicons-arrow-left" @click="navigateTo('/admin/contracts')" />
      <h1 class="text-2xl font-bold">{{ $t('nav.contracts') }}</h1>
    </div>

    <UCard>
      <p class="text-gray-500">{{ $t('loading') }}</p>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] })
</script>
