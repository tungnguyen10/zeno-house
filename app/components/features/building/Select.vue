<script setup lang="ts">
const modelValue = defineModel<string>({ default: "" });

const { t } = useI18n();
const { buildings, loading, fetchBuildings } = useBuildings();

const options = computed(() =>
  buildings.value.map((b) => ({ label: b.name, value: b.id })),
);

onMounted(fetchBuildings);
</script>

<template>
  <USelect
    v-model="modelValue"
    :options="options"
    :loading="loading"
    :placeholder="t('buildings.form.name_placeholder')"
    class="w-full"
  />
</template>
