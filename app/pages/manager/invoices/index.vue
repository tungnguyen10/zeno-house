<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">{{ $t('nav.invoices') }}</h1>
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
definePageMeta({ layout: 'manager', middleware: ['auth', 'role'] })

const { t } = useI18n()

const columns = [
  { key: 'tenant', label: 'Khách thuê' },
  { key: 'room', label: 'Phòng' },
  { key: 'billing_month', label: 'Kỳ thu' },
  { key: 'total_amount', label: 'Số tiền' },
  { key: 'status', label: 'Trạng thái' },
  { key: 'actions', label: t('actions.actions') },
] as any[]
</script>
