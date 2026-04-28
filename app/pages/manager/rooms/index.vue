<script setup lang="ts">
definePageMeta({ layout: "manager", middleware: ["auth", "role"] });

const { t } = useI18n();

const columns = [
  { key: "room_number", label: "Phòng" },
  { key: "status", label: "Trạng thái" },
  { key: "base_price", label: "Giá thuê" },
  { key: "tenant", label: t("navigation.sidebar.tenants") },
  { key: "actions", label: t("actions.view") },
] as const;
</script>

<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold text-[--color-title]">{{ t("navigation.sidebar.rooms") }}</h1>
      <UButton @click="navigateTo('/manager/rooms/new')">
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
