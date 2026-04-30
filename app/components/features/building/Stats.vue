<script setup lang="ts">
import type { BuildingStats } from "~/types/buildings";

defineProps<{ stats: BuildingStats }>();

const { t } = useI18n();
</script>

<template>
  <div class="grid grid-cols-3 gap-3">
    <div class="rounded-lg bg-[--color-smoke] px-3 py-2 text-center">
      <p class="text-lg font-bold text-[--color-title]">{{ stats.total_rooms }}</p>
      <p class="text-xs text-[--color-body]">{{ t("buildings.stats.total") }}</p>
    </div>
    <div class="rounded-lg bg-[--color-smoke] px-3 py-2 text-center">
      <p class="text-lg font-bold text-green-600">{{ stats.available_rooms }}</p>
      <p class="text-xs text-[--color-body]">{{ t("buildings.stats.available") }}</p>
    </div>
    <div class="rounded-lg bg-[--color-smoke] px-3 py-2 text-center">
      <p class="text-lg font-bold text-blue-600">{{ stats.occupied_rooms }}</p>
      <p class="text-xs text-[--color-body]">{{ t("buildings.stats.occupied") }}</p>
    </div>
  </div>
</template>
