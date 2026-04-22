<template>
  <div>
    <div class="flex items-center gap-3 mb-6">
      <UButton variant="ghost" icon="i-heroicons-arrow-left" @click="navigateTo('/manager/invoices')" />
      <h1 class="text-2xl font-bold">{{ $t('nav.invoices') }}</h1>
    </div>

    <UCard>
      <p class="text-gray-500">{{ $t('loading') }}</p>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'manager', middleware: ['auth', 'role'] })
</script>
