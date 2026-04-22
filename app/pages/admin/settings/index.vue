<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">{{ $t('nav.settings') }}</h1>

    <div class="space-y-4">
      <UCard>
        <template #header>
          <h2 class="font-semibold">Tài khoản quản trị</h2>
        </template>
        <p class="text-gray-500">{{ $t('loading') }}</p>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] })
</script>
