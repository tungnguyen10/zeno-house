<script setup lang="ts">
import type { Building } from "~/types/buildings";
import type { CreateBuildingInput } from "~/types/buildings";

const props = defineProps<{
  initial?: Partial<Building>;
}>();

const emit = defineEmits<{
  (e: "saved"): void;
  (e: "cancel"): void;
}>();

const { createBuilding, updateBuilding } = useBuildings();
const saving = ref(false);

async function onSubmit(data: CreateBuildingInput) {
  saving.value = true;
  try {
    if (props.initial?.id) {
      await updateBuilding(props.initial.id, data);
    } else {
      await createBuilding(data);
    }
    emit("saved");
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <BuildingForm
    :initial="initial"
    :loading="saving"
    @submit="onSubmit"
    @cancel="emit('cancel')"
  />
</template>
