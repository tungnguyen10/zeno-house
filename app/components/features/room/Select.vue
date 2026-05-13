<script setup lang="ts">
const props = defineProps<{
  buildingId?: string;
}>();

const modelValue = defineModel<string>({ default: "" });

const { t } = useI18n();
const { rooms, loading, fetchRooms } = useRooms();

const options = computed(() =>
  rooms.value.map((r) => ({
    label: `${r.room_number}${r.floor !== null ? ` (${t("rooms.detail.floor")} ${r.floor})` : ""}`,
    value: r.id,
  })),
);

onMounted(() => {
  fetchRooms(props.buildingId ? { building_id: props.buildingId } : {});
});

watch(() => props.buildingId, (id) => {
  fetchRooms(id ? { building_id: id } : {});
});
</script>

<template>
  <USelect
    v-model="modelValue"
    :options="options"
    :loading="loading"
    :placeholder="t('rooms.select_placeholder')"
    class="w-full"
  />
</template>
