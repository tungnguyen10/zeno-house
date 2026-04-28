<template>
  <div>
    <h1 class="text-2xl font-bold mb-6 text-[--color-title]">{{ $t('navigation.sidebar.invoices') }}</h1>

    <UCard>
      <UTable :rows="[]" :columns="columns">
        <template #empty-state>
          <div class="text-center py-8 text-[--color-body]">{{ $t('empty') }}</div>
        </template>
      </UTable>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'tenant', middleware: ['auth', 'role'] })

const { t } = useI18n()

const columns = [
  { key: 'billing_month', label: 'Kỳ thu' },
  { key: 'total_amount', label: 'Số tiền' },
  { key: 'due_date', label: 'Hạn thanh toán' },
  { key: 'status', label: 'Trạng thái' },
  { key: 'actions', label: t('actions.view') },
] as const
</script>
