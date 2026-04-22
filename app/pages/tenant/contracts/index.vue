<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">{{ $t('nav.contracts') }}</h1>

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
definePageMeta({ layout: 'tenant', middleware: ['auth', 'role'] })

const { t } = useI18n()

const columns = [
  { key: 'room', label: 'Phòng' },
  { key: 'start_date', label: 'Ngày bắt đầu' },
  { key: 'end_date', label: 'Ngày kết thúc' },
  { key: 'monthly_rent', label: 'Tiền thuê/tháng' },
  { key: 'status', label: 'Trạng thái' },
  { key: 'actions', label: t('actions.view') },
] as any[]
</script>
