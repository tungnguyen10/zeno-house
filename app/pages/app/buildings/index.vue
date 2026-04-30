<script setup lang="ts">
import type { Building } from "~/types/buildings";

definePageMeta({ layout: "app", middleware: ["auth", "app-guard"] });

const { t } = useI18n();
const toast = useToast();

const {
  filteredBuildings,
  loading,
  search,
  fetchBuildings,
  deleteBuilding,
} = useBuildings();

await fetchBuildings();

const deleteTarget = ref<Building | null>(null);
const showDeleteModal = ref(false);
const deleting = ref(false);

const showFormModal = ref(false);
const editTarget = ref<Building | null>(null);

function openCreate() {
  editTarget.value = null;
  showFormModal.value = true;
}

function openEdit(building: Building) {
  editTarget.value = building;
  showFormModal.value = true;
}

function openDelete(building: Building) {
  deleteTarget.value = building;
  showDeleteModal.value = true;
}

async function confirmDelete() {
  if (!deleteTarget.value) return;
  deleting.value = true;
  try {
    await deleteBuilding(deleteTarget.value.id);
    toast.add({ title: t("common.success"), color: "success" });
    showDeleteModal.value = false;
    await fetchBuildings();
  } catch (err: unknown) {
    const msg = (err as { data?: { message?: string } })?.data?.message;
    toast.add({
      title: msg === "buildings.delete_blocked" ? t("buildings.delete_blocked") : t("common.error"),
      color: "error",
    });
  } finally {
    deleting.value = false;
  }
}

async function onFormSaved() {
  showFormModal.value = false;
  await fetchBuildings();
  toast.add({ title: t("common.success"), color: "success" });
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 class="text-2xl font-bold text-[--color-title]">{{ t("navigation.sidebar.buildings") }}</h1>
      <UButton color="primary" @click="openCreate">
        <IconPlus class="size-4" />
        {{ t("actions.create") }}
      </UButton>
    </div>

    <UInput
      v-model="search"
      :placeholder="t('actions.search')"
      class="max-w-xs"
    >
      <template #leading>
        <IconSearch class="size-4 text-[--color-body]" />
      </template>
    </UInput>

    <div v-if="loading" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <USkeleton v-for="n in 6" :key="n" class="h-40 rounded-xl" />
    </div>

    <div v-else-if="filteredBuildings.length === 0" class="py-16 text-center text-[--color-body]">
      {{ t("buildings.empty") }}
    </div>

    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <BuildingCard
        v-for="building in filteredBuildings"
        :key="building.id"
        :building="building"
        @edit="openEdit"
        @delete="openDelete"
      />
    </div>

    <!-- Form modal (create / edit) -->
    <UModal v-model:open="showFormModal">
      <template #header>
        <h3 class="text-lg font-semibold text-[--color-title]">
          {{ editTarget ? t("buildings.form.edit_title") : t("buildings.form.create_title") }}
        </h3>
      </template>
      <BuildingFormModal
        :initial="editTarget ?? undefined"
        @saved="onFormSaved"
        @cancel="showFormModal = false"
      />
    </UModal>

    <!-- Delete confirm modal -->
    <UModal v-model:open="showDeleteModal">
      <template #header>
        <h3 class="text-lg font-semibold text-[--color-title]">{{ t("actions.delete") }}</h3>
      </template>
      <div class="space-y-4 p-1">
        <p class="text-sm text-[--color-body]">{{ t("buildings.delete_confirm") }}</p>
        <div class="flex justify-end gap-3">
          <UButton color="neutral" variant="ghost" @click="showDeleteModal = false">
            {{ t("actions.cancel") }}
          </UButton>
          <UButton color="error" :loading="deleting" @click="confirmDelete">
            {{ t("actions.delete") }}
          </UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>
