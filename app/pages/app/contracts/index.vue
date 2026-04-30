<script setup lang="ts">
definePageMeta({ layout: "app", middleware: ["auth", "app-guard"] });

const { t } = useI18n();

const columns = [
  { accessorKey: "tenant", header: t("contracts.columns.tenant") },
  { accessorKey: "room", header: t("contracts.columns.room") },
  { accessorKey: "start_date", header: t("contracts.columns.start_date") },
  { accessorKey: "end_date", header: t("contracts.columns.end_date") },
  { accessorKey: "status", header: t("contracts.columns.status") },
  { id: "actions", header: t("actions.view") },
];
</script>

<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold text-[--color-title]">{{ t("navigation.sidebar.contracts") }}</h1>
      <UButton @click="navigateTo('/app/contracts/new')">
        <IconPlus class="size-4" />
        {{ t("actions.create") }}
      </UButton>
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
