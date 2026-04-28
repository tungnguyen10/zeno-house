<script setup lang="ts">
definePageMeta({ layout: "admin", middleware: ["auth", "role"] });

const { t } = useI18n();

const columns = [
  { key: "full_name", label: "Họ tên" },
  { key: "phone", label: "SĐT" },
  { key: "room", label: "Phòng" },
  { key: "status", label: "Trạng thái" },
  { key: "actions", label: t("actions.view") },
] as const;
</script>

<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold text-[--color-title]">{{ t("navigation.sidebar.tenants") }}</h1>
      <UButton @click="navigateTo('/admin/tenants/new')">
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
