<script setup lang="ts">
definePageMeta({ layout: "app", middleware: ["auth", "app-guard"] });

const authStore = useAuthStore();
const { role } = storeToRefs(authStore);

if (role.value !== "admin") {
  await navigateTo("/app");
}

const { t } = useI18n();
const toast = useToast();

interface BuildingAssignment {
  building_id: string;
  building_name: string;
  permissions: string[];
}

interface Manager {
  id: string;
  full_name: string | null;
  email: string;
  building_assignments: BuildingAssignment[];
}

const { data: managers, refresh } = await useFetch<Manager[]>("/api/managers");

const { data: buildings } = await useFetch<Array<{ id: string; name: string }>>("/api/buildings");

const selectedManager = ref<Manager | null>(null);
const showAssignModal = ref(false);

function openAssign(manager: Manager) {
  selectedManager.value = manager;
  showAssignModal.value = true;
}

async function revokeAssignment(managerId: string, buildingId: string) {
  try {
    await $fetch(`/api/managers/${managerId}/buildings/${buildingId}`, { method: "DELETE" });
    toast.add({ title: t("managers.assignment.revoked"), color: "success" });
    await refresh();
  } catch {
    toast.add({ title: t("managers.assignment.error"), color: "error" });
  }
}

async function onAssignmentSaved() {
  showAssignModal.value = false;
  await refresh();
}

const columns = [
  { accessorKey: "full_name", header: t("managers.list.name") },
  { accessorKey: "email", header: t("managers.list.email") },
  { id: "buildings", header: t("managers.list.buildings") },
  { id: "actions", header: "" },
];
</script>

<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold text-[--color-title]">
        {{ t("navigation.sidebar.managers") }}
      </h1>
    </div>

    <UCard>
      <UTable :rows="managers ?? []" :columns="columns">
        <template #buildings-data="{ row }">
          <div class="flex flex-wrap gap-1">
            <span
              v-for="a in (row as unknown as Manager).building_assignments"
              :key="a.building_id"
              class="inline-flex items-center gap-1 rounded bg-[--color-smoke-blue] px-2 py-0.5 text-xs text-[--color-title]"
            >
              {{ a.building_name }}
              <button
                type="button"
                class="ml-1 text-[--color-body] hover:text-red-500"
                :aria-label="`${t('actions.remove')} ${a.building_name}`"
                @click="revokeAssignment((row as unknown as Manager).id, a.building_id)"
              >
                ×
              </button>
            </span>
            <span v-if="(row as unknown as Manager).building_assignments.length === 0" class="text-xs text-[--color-body]">
              {{ t("managers.list.noBuildings") }}
            </span>
          </div>
        </template>

        <template #actions-data="{ row }">
          <UButton size="xs" variant="ghost" @click="openAssign(row as unknown as Manager)">
            {{ t("managers.assignment.assign") }}
          </UButton>
        </template>

        <template #empty-state>
          <div class="py-8 text-center text-[--color-body]">{{ t("empty") }}</div>
        </template>
      </UTable>
    </UCard>

    <UModal v-model:open="showAssignModal">
      <template #header>
        <h3 class="text-lg font-semibold text-[--color-title]">
          {{ t("managers.assignment.title") }} — {{ selectedManager?.full_name ?? selectedManager?.email }}
        </h3>
      </template>

      <ManagersAssignmentForm
        v-if="selectedManager"
        :manager-id="selectedManager.id"
        :buildings="buildings ?? []"
        :existing-assignments="selectedManager.building_assignments"
        @saved="onAssignmentSaved"
      />
    </UModal>
  </div>
</template>
