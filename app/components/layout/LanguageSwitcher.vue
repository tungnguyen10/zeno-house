<script setup lang="ts">
const { locale, setLocale } = useI18n();

function toggle() {
  setLocale(locale.value === "vi" ? "en" : "vi");
}
</script>

<template>
  <UButton
    variant="ghost"
    color="neutral"
    size="sm"
    :aria-label="locale === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt'"
    @click="toggle"
  >
    {{ locale === "vi" ? "EN" : "VI" }}
  </UButton>
</template>
