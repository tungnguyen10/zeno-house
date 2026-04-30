<script setup lang="ts">
definePageMeta({ layout: "app", middleware: ["auth", "app-guard"] });

const { t } = useI18n();
const route = useRoute();
const toast = useToast();
const id = route.params.id as string;

const { getBuilding, updateBuilding } = useBuildings();
const building = ref(await getBuilding(id));

if (!building.value) {
  await navigateTo("/app/buildings");
}

const saving = ref(false);

async function onSubmit(data: Record<string, unknown>) {
  saving.value = true;
  try {
    await updateBuilding(id, data as Parameters<typeof updateBuilding>[1]);
    toast.add({ title: t("common.success"), color: "success" });
    await navigateTo(`/app/buildings/${id}`);
  } catch {
    toast.add({ title: t("common.error"), color: "error" });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div v-if="building" class="space-y-6">
    <div>
      <NuxtLink
        :to="`/app/buildings/${id}`"
        class="mb-1 flex items-center gap-1 text-sm text-[--color-body] hover:text-[--color-title]"
      >
        <IconChevronLeft class="size-4" />
        {{ building.name }}
      </NuxtLink>
      <h1 class="text-2xl font-bold text-[--color-title]">{{ t("buildings.form.edit_title") }}</h1>
    </div>

    <UCard class="max-w-xl">
      <BuildingForm
        :initial="building"
        :loading="saving"
        @submit="onSubmit"
        @cancel="navigateTo(`/app/buildings/${id}`)"
      />
    </UCard>
  </div>
</template>
