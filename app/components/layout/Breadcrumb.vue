<script setup lang="ts">
const route = useRoute();
const { t } = useI18n();

const label = computed(() => {
  const key = route.meta.breadcrumb as string | undefined;
  return key ? t(key) : "";
});
</script>

<template>
  <nav aria-label="breadcrumb">
    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
      {{ label }}
    </span>
  </nav>
</template>
