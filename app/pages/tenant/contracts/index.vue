<template>
  <div>
    <h1 class="text-2xl font-bold mb-6 text-[--color-title]">{{ $t('navigation.sidebar.contracts') }}</h1>

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
  { accessorKey: "room", header: t("contracts.columns.room") },
  { accessorKey: "start_date", header: t("contracts.columns.start_date") },
  { accessorKey: "end_date", header: t("contracts.columns.end_date") },
  { accessorKey: "monthly_rent", header: t("contracts.columns.monthly_rent") },
  { accessorKey: "status", header: t("contracts.columns.status") },
  { id: "actions", header: t("actions.view") },
];
</script>
