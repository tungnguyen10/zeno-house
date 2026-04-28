<template>
  <div>
    <div class="mb-6 flex items-center gap-3">
      <UButton variant="ghost" @click="navigateTo('/manager/rooms')">
        <IconArrowLeft class="size-4" />
      </UButton>
      <h1 class="text-2xl font-bold text-[--color-title]">{{ $t('navigation.sidebar.rooms') }}</h1>
    </div>

    <UCard>
      <p class="text-[--color-body]">{{ $t('loading') }}</p>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'manager', middleware: ['auth', 'role'] })
</script>
