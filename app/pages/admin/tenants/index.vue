<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">{{ $t('nav.tenants') }}</h1>
      <UButton icon="i-heroicons-plus" @click="navigateTo('/admin/tenants/new')">
        {{ $t('actions.create') }}
      </UButton>
    </div>

    <UCard>
      <UTable :rows="[]" :columns="columns">
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
  { key: 'full_name', label: 'Họ tên' },
  { key: 'phone', label: 'SĐT' },
  { key: 'room', label: 'Phòng' },
  { key: 'status', label: 'Trạng thái' },
  { key: 'actions', label: t('actions.actions') },
] as any[]
</script>
