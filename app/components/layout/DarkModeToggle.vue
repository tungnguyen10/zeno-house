<script setup lang="ts">
const colorMode = useColorMode();

const isDark = computed(() => colorMode.value === "dark");

function toggle() {
  colorMode.preference = isDark.value ? "light" : "dark";
}
</script>

<template>
  <UButton
    variant="ghost"
    color="neutral"
    :aria-label="isDark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'"
    @click="toggle"
  >
    <IconMoon v-if="!isDark" class="size-5" />
    <IconSun v-else class="size-5" />
  </UButton>
</template>
