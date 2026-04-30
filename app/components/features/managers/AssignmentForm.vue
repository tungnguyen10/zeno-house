<script setup lang="ts">
const FEATURES = ["rooms", "contracts", "invoices", "tenants", "utilities"] as const;
type Feature = (typeof FEATURES)[number];

interface BuildingAssignment {
  building_id: string;
  building_name: string;
  permissions: string[];
}

const props = defineProps<{
  managerId: string;
  buildings: Array<{ id: string; name: string }>;
  existingAssignments?: BuildingAssignment[];
}>();

const emit = defineEmits<{
  (e: "saved"): void;
}>();

const { t } = useI18n();
const toast = useToast();

const selectedBuilding = ref("");
const selectedPermissions = ref<Feature[]>([...FEATURES]);
const saving = ref(false);

watch(selectedBuilding, (buildingId) => {
  const existing = props.existingAssignments?.find((a) => a.building_id === buildingId);
  selectedPermissions.value = existing
    ? (existing.permissions.filter((p): p is Feature => FEATURES.includes(p as Feature)))
    : [...FEATURES];
});

async function save() {
  if (!selectedBuilding.value) return;
  saving.value = true;
  try {
    await $fetch(`/api/managers/${props.managerId}/buildings`, {
      method: "POST",
      body: {
        building_id: selectedBuilding.value,
        permissions: selectedPermissions.value,
      },
    });
    toast.add({ title: t("managers.assignment.saved"), color: "success" });
    emit("saved");
  } catch {
    toast.add({ title: t("managers.assignment.error"), color: "error" });
  } finally {
    saving.value = false;
  }
}

const buildingOptions = computed(() =>
  props.buildings.map((b) => ({ label: b.name, value: b.id })),
);

function featureLabel(feature: Feature) {
  return t(`managers.features.${feature}`);
}
</script>

<template>
  <div class="space-y-4">
    <UFormField :label="t('managers.assignment.building')">
      <USelect
        v-model="selectedBuilding"
        :options="buildingOptions"
        :placeholder="t('managers.assignment.selectBuilding')"
        class="w-full"
      />
    </UFormField>

    <fieldset>
      <legend class="mb-2 text-sm font-medium text-[--color-title]">
        {{ t("managers.assignment.permissions") }}
      </legend>
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label
          v-for="feature in FEATURES"
          :key="feature"
          class="flex cursor-pointer items-center gap-2 rounded border border-[--color-border] px-3 py-2 text-sm"
        >
          <input
            v-model="selectedPermissions"
            type="checkbox"
            :value="feature"
            class="accent-[--color-theme]"
          />
          {{ featureLabel(feature) }}
        </label>
      </div>
    </fieldset>

    <div class="flex justify-end gap-3">
      <UButton
        color="primary"
        :loading="saving"
        :disabled="!selectedBuilding || selectedPermissions.length === 0"
        @click="save"
      >
        {{ t("actions.save") }}
      </UButton>
    </div>
  </div>
</template>
