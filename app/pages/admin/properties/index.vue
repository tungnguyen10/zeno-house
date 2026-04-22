<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">{{ $t('nav.properties') }}</h1>
      <UButton icon="i-heroicons-plus" @click="navigateTo('/admin/properties/new')">
        {{ $t('actions.create') }}
      </UButton>
    </div>

    <UCard>
      <UTable :rows="[]" :columns="columns" :loading="false">
        <template #empty-state>
          <div class="text-center py-8 text-gray-500">{{ $t('empty') }}</div>
        </template>
      </UTable>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] })

const { t } = useI18n()

const columns = [
  { key: 'name', label: 'Tên nhà trọ' },
  { key: 'address', label: 'Địa chỉ' },
  { key: 'rooms', label: 'Số phòng' },
  { key: 'actions', label: t('common.actions') },
] as any[]
</script>
