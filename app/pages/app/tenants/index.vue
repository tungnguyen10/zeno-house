<script setup lang="ts">
definePageMeta({ layout: "app", middleware: ["auth", "app-guard"] });

const { t } = useI18n();

const columns = [
  { accessorKey: "full_name", header: t("tenants.columns.full_name") },
  { accessorKey: "phone", header: t("tenants.columns.phone") },
  { accessorKey: "room", header: t("tenants.columns.room") },
  { accessorKey: "status", header: t("tenants.columns.status") },
  { id: "actions", header: t("actions.view") },
];
</script>

<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold text-[--color-title]">{{ t("navigation.sidebar.tenants") }}</h1>
      <UButton @click="navigateTo('/app/tenants/new')">
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
