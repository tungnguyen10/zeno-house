<script setup lang="ts">
definePageMeta({
  title: 'Dashboard',
})
</script>

<template>
  <div>
    <div class="mb-6">
      <h2 class="text-xl font-semibold text-white">Dashboard</h2>
      <p class="mt-1 text-sm text-muted">Tổng quan hệ thống</p>
    </div>

    <!-- Stats placeholder -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div
        v-for="i in 4"
        :key="i"
        class="rounded-2xl border border-dark-border bg-dark-surface p-5"
      >
        <UiSkeleton class="h-4 w-24 mb-3" />
        <UiSkeleton class="h-8 w-16" />
      </div>
    </div>

    <!-- Content placeholder -->
    <div class="mt-6 rounded-2xl border border-dark-border bg-dark-surface p-5">
      <UiEmptyState
        title="Dashboard đang được xây dựng"
        description="Dữ liệu thống kê sẽ hiển thị ở đây khi các tính năng sẵn sàng"
      />
    </div>
  </div>
</template>
