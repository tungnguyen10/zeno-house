<template>
  <div>
    <!-- Desktop row shared with the floating AppHeader actions; children start below it. -->
    <p class="mb-6 hidden h-10 items-center pr-44 text-xl font-semibold text-ui-primary lg:flex">
      Cài đặt
    </p>
    <div class="lg:flex lg:items-start lg:gap-8">
      <aside class="hidden w-52 shrink-0 lg:sticky lg:top-0 lg:block">
        <AppSettingsNav />
      </aside>
      <div class="min-w-0 flex-1">
        <NuxtPage />
      </div>
    </div>
  </div>
</template>
