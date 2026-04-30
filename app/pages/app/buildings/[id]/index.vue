<script setup lang="ts">
definePageMeta({ layout: "app", middleware: ["auth", "app-guard"] });

const { t } = useI18n();
const route = useRoute();
const id = route.params.id as string;

const { getBuilding } = useBuildings();
const building = ref(await getBuilding(id));

if (!building.value) {
  await navigateTo("/app/buildings");
}
</script>

<template>
  <div v-if="building" class="space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <NuxtLink to="/app/buildings" class="mb-1 flex items-center gap-1 text-sm text-[--color-body] hover:text-[--color-title]">
          <IconChevronLeft class="size-4" />
          {{ t("navigation.sidebar.buildings") }}
        </NuxtLink>
        <h1 class="text-2xl font-bold text-[--color-title]">{{ building.name }}</h1>
        <p class="text-sm text-[--color-body]">{{ building.address }}</p>
      </div>
      <UButton variant="outline" color="neutral" :to="`/app/buildings/${id}/edit`">
        <IconPencilSquare class="size-4" />
        {{ t("actions.edit") }}
      </UButton>
    </div>

    <BuildingStats v-if="building.stats" :stats="building.stats" />

    <UCard>
      <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <dt class="text-xs font-medium uppercase tracking-wide text-[--color-body]">
            {{ t("buildings.detail.total_floors") }}
          </dt>
          <dd class="mt-1 text-sm text-[--color-title]">{{ building.total_floors }}</dd>
        </div>
        <div v-if="building.description">
          <dt class="text-xs font-medium uppercase tracking-wide text-[--color-body]">
            {{ t("buildings.detail.description") }}
          </dt>
          <dd class="mt-1 text-sm text-[--color-title]">{{ building.description }}</dd>
        </div>
      </dl>
    </UCard>
  </div>
</template>
