<script setup lang="ts">
definePageMeta({ layout: "app", middleware: ["auth", "app-guard"] });

const { t } = useI18n();

const columns = [
  { accessorKey: "tenant", header: t("invoices.columns.tenant") },
  { accessorKey: "room", header: t("invoices.columns.room") },
  { accessorKey: "billing_month", header: t("invoices.columns.billing_month") },
  { accessorKey: "total_amount", header: t("invoices.columns.total_amount") },
  { accessorKey: "status", header: t("invoices.columns.status") },
  { id: "actions", header: t("actions.view") },
];
</script>

<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold text-[--color-title]">{{ t("navigation.sidebar.invoices") }}</h1>
    </div>

    <UCard>
      <UTable :rows="[]" :columns="columns">
        <template #empty-state>
          <div class="py-8 text-center text-[--color-body]">{{ t("empty") }}</div>
        </template>
      </UTable>
    </UCard>
  </div>
</template>
