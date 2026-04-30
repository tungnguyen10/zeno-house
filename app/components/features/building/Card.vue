<script setup lang="ts">
import type { Building } from "~/types/buildings";

defineProps<{ building: Building }>();
const emit = defineEmits<{
  (e: "edit", building: Building): void;
  (e: "delete", building: Building): void;
}>();

const { t } = useI18n();
</script>

<template>
  <UCard class="transition-shadow hover:shadow-md">
    <div class="space-y-3">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <NuxtLink
            :to="`/app/buildings/${building.id}`"
            class="text-base font-semibold text-[--color-title] hover:text-[--color-theme] hover:underline"
          >
            {{ building.name }}
          </NuxtLink>
          <p class="mt-0.5 truncate text-sm text-[--color-body]">{{ building.address }}</p>
          <p class="text-xs text-[--color-body]">
            {{ t("buildings.detail.total_floors") }}: {{ building.total_floors }}
          </p>
        </div>
        <div class="flex shrink-0 gap-1">
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            :aria-label="t('actions.edit')"
            @click="emit('edit', building)"
          >
            <IconPencilSquare class="size-4" />
          </UButton>
          <UButton
            size="xs"
            variant="ghost"
            color="error"
            :aria-label="t('actions.delete')"
            @click="emit('delete', building)"
          >
            <IconTrash class="size-4" />
          </UButton>
        </div>
      </div>

      <BuildingStats v-if="building.stats" :stats="building.stats" />
    </div>
  </UCard>
</template>
