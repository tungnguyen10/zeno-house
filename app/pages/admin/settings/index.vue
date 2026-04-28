<script setup lang="ts">
definePageMeta({ layout: "admin", middleware: ["auth", "role"] });
</script>

<template>
  <div>
    <h1 class="mb-6 text-2xl font-bold text-[--color-title]">{{ $t("navigation.sidebar.settings") }}</h1>

    <div class="space-y-4">
      <UCard>
        <template #header>
          <h2 class="font-semibold text-[--color-title]">Tài khoản quản trị</h2>
        </template>
        <p class="text-[--color-body]">{{ $t("loading") }}</p>
      </UCard>
    </div>
  </div>
</template>
