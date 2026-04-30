<script setup lang="ts">
definePageMeta({ layout: "app", middleware: ["auth", "app-guard"] });
</script>

<template>
  <div>
    <div class="mb-6 flex items-center gap-3">
      <UButton variant="ghost" @click="navigateTo('/app/contracts')">
        <IconArrowLeft class="size-4" />
      </UButton>
      <h1 class="text-2xl font-bold text-[--color-title]">{{ $t("navigation.sidebar.contracts") }}</h1>
    </div>

    <UCard>
      <p class="text-[--color-body]">{{ $t("loading") }}</p>
    </UCard>
  </div>
</template>
