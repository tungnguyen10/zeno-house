<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">{{ $t('nav.dashboard') }}</h1>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <UCard>
        <div class="flex items-center gap-4">
          <UIcon name="i-heroicons-home" class="text-3xl text-primary" />
          <div>
            <p class="text-sm text-gray-500">{{ $t('nav.rooms') }}</p>
            <p class="font-semibold">—</p>
          </div>
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center gap-4">
          <UIcon name="i-heroicons-document-check" class="text-3xl text-green-500" />
          <div>
            <p class="text-sm text-gray-500">{{ $t('nav.contracts') }}</p>
            <p class="font-semibold">—</p>
          </div>
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center gap-4">
          <UIcon name="i-heroicons-document-text" class="text-3xl text-orange-500" />
          <div>
            <p class="text-sm text-gray-500">{{ $t('nav.invoices') }}</p>
            <p class="font-semibold">—</p>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'tenant', middleware: ['auth', 'role'] })
</script>
