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
definePageMeta({ layout: 'tenant', middleware: ['auth', 'tenant'] })

const { t } = useI18n()

const columns = [
  { accessorKey: "billing_month", header: t("invoices.columns.billing_month") },
  { accessorKey: "total_amount", header: t("invoices.columns.total_amount") },
  { accessorKey: "due_date", header: t("invoices.columns.due_date") },
  { accessorKey: "status", header: t("invoices.columns.status") },
  { id: "actions", header: t("actions.view") },
];
</script>
