<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">{{ $t('nav.dashboard') }}</h1>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <UCard v-for="stat in stats" :key="stat.label">
        <div class="flex items-center gap-4">
          <UIcon :name="stat.icon" class="text-3xl text-primary" />
          <div>
            <p class="text-sm text-gray-500">{{ stat.label }}</p>
            <p class="text-2xl font-bold">{{ stat.value }}</p>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] })

const { t } = useI18n()

const stats = [
  { label: t('nav.properties'), value: '—', icon: 'i-heroicons-building-office' },
  { label: t('nav.rooms'), value: '—', icon: 'i-heroicons-home' },
  { label: t('nav.tenants'), value: '—', icon: 'i-heroicons-users' },
  { label: t('nav.invoices'), value: '—', icon: 'i-heroicons-document-text' },
]
</script>
