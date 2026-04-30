<template>
  <div>
    <h1 class="text-2xl font-bold mb-6 text-[--color-title]">{{ $t('navigation.sidebar.rooms') }}</h1>

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ $t('rooms.detail.title') }}</h2>
      </template>
      <p class="text-[--color-body]">{{ $t('loading') }}</p>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'tenant', middleware: ['auth', 'tenant'] })
</script>
