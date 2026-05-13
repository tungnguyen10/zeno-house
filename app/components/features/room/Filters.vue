<script setup lang="ts">
import type { Building } from "~/types/buildings";
import type { RoomStatus } from "~/types/rooms";

const props = defineProps<{
  buildings?: Building[];
  initial?: { building_id: string; status: string; floor: string; search: string };
}>();

const emit = defineEmits<{
  (e: "change", filters: { building_id: string; status: string; floor: string; search: string }): void;
}>();

const { t } = useI18n();

const buildingId = ref(props.initial?.building_id ?? "");
const status = ref(props.initial?.status ?? "");
const floor = ref(props.initial?.floor ?? "");
const search = ref(props.initial?.search ?? "");

const buildingOptions = computed(() => [
  { label: t("rooms.filters.all_buildings"), value: "" },
  ...(props.buildings ?? []).map((b) => ({ label: b.name, value: b.id })),
]);

const statusOptions = computed(() => [
  { label: t("rooms.filters.all_statuses"), value: "" },
  ...(["available", "occupied", "maintenance", "reserved"] as RoomStatus[]).map((s) => ({
    label: t(`rooms.status.${s}`),
    value: s,
  })),
]);

watch([buildingId, status, floor, search], () => {
  emit("change", {
    building_id: buildingId.value,
    status: status.value,
    floor: floor.value,
    search: search.value,
  });
});
</script>

<template>
  <div class="flex flex-wrap gap-3">
    <USelect
      v-model="buildingId"
      :options="buildingOptions"
      class="w-full sm:w-48"
    />

    <USelect
      v-model="status"
      :options="statusOptions"
      class="w-full sm:w-40"
    />

    <UInput
      v-model="floor"
      type="number"
      :min="0"
      :placeholder="t('rooms.filters.floor_placeholder')"
      class="w-24"
    />

    <UInput
      v-model="search"
      :placeholder="t('rooms.filters.search_placeholder')"
      class="w-full sm:w-56"
    >
      <template #leading>
        <IconSearch class="size-4 text-[--color-body]" />
      </template>
    </UInput>
  </div>
</template>
