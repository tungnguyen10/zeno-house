<script setup lang="ts">
definePageMeta({ layout: "app", middleware: ["auth", "app-guard"] });

const { t } = useI18n();

const columns = [
  { accessorKey: "room_number", header: t("rooms.columns.room_number") },
  { accessorKey: "building", header: t("rooms.columns.building") },
  { accessorKey: "status", header: t("rooms.columns.status") },
  { accessorKey: "base_price", header: t("rooms.columns.base_price") },
  { id: "actions", header: t("actions.view") },
];
</script>

<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold text-[--color-title]">{{ t("navigation.sidebar.rooms") }}</h1>
      <UButton @click="navigateTo('/app/rooms/new')">
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
