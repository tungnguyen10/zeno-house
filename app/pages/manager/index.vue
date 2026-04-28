<script setup lang="ts">
definePageMeta({ layout: "manager", middleware: ["auth", "role"] });

const { t } = useI18n();

const stats = [
  { label: t("navigation.sidebar.rooms"), value: "—", icon: "IconDoorOpen" },
  { label: t("navigation.sidebar.tenants"), value: "—", icon: "IconUsers" },
  { label: t("navigation.sidebar.contracts"), value: "—", icon: "IconFileText" },
  { label: t("navigation.sidebar.invoices"), value: "—", icon: "IconReceipt" },
];
</script>

<template>
  <div>
    <h1 class="mb-6 text-2xl font-bold text-[--color-title]">
      {{ t("navigation.sidebar.dashboard") }}
    </h1>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <UCard v-for="stat in stats" :key="stat.label">
        <div class="flex items-center gap-4">
          <component :is="stat.icon" class="size-8 text-[--color-theme]" />
          <div>
            <p class="text-sm text-[--color-body]">{{ stat.label }}</p>
            <p class="text-2xl font-bold text-[--color-title]">{{ stat.value }}</p>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
