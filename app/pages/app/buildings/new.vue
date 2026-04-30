<script setup lang="ts">
definePageMeta({ layout: "app", middleware: ["auth", "app-guard"] });

const { t } = useI18n();
const toast = useToast();

const { createBuilding } = useBuildings();
const saving = ref(false);

async function onSubmit(data: Record<string, unknown>) {
  saving.value = true;
  try {
    await createBuilding(data as Parameters<typeof createBuilding>[0]);
    toast.add({ title: t("common.success"), color: "success" });
    await navigateTo("/app/buildings");
  } catch {
    toast.add({ title: t("common.error"), color: "error" });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <NuxtLink
        to="/app/buildings"
        class="mb-1 flex items-center gap-1 text-sm text-[--color-body] hover:text-[--color-title]"
      >
        <IconChevronLeft class="size-4" />
        {{ t("navigation.sidebar.buildings") }}
      </NuxtLink>
      <h1 class="text-2xl font-bold text-[--color-title]">{{ t("buildings.form.create_title") }}</h1>
    </div>

    <UCard class="max-w-xl">
      <BuildingForm
        :loading="saving"
        @submit="onSubmit"
        @cancel="navigateTo('/app/buildings')"
      />
    </UCard>
  </div>
</template>
