<script setup lang="ts">
definePageMeta({
  title: 'Dashboard',
})

const { summary, isLoading } = useDashboardSummary()
</script>

<template>
  <div>
    <div class="mb-6">
      <h2 class="text-xl font-semibold text-white">Dashboard</h2>
      <p class="mt-1 text-sm text-muted">Tổng quan hệ thống</p>
    </div>

    <!-- Stat cards -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <template v-if="isLoading">
        <div v-for="i in 4" :key="i" class="rounded-2xl border border-dark-border bg-dark-surface p-5">
          <UiSkeleton class="h-3 w-20 mb-3 rounded" />
          <UiSkeleton class="h-8 w-14 rounded" />
        </div>
      </template>
      <template v-else-if="summary">
        <AppStatCard
          title="Tòa nhà"
          :value="summary.buildings.total"
        />
        <AppStatCard
          title="Phòng"
          :value="summary.rooms.total"
          :description="`${summary.rooms.available} trống · ${summary.rooms.occupied} đang thuê · ${summary.rooms.maintenance} bảo trì`"
        />
        <AppStatCard
          title="Khách thuê"
          :value="summary.tenants.total"
        />
        <AppStatCard
          title="Hợp đồng đang hoạt động"
          :value="summary.contracts.active"
        />
      </template>
    </div>

    <!-- Building occupancy -->
    <div class="mt-6 rounded-2xl border border-dark-border bg-dark-surface overflow-hidden">
      <div class="px-5 py-4 border-b border-dark-border">
        <h3 class="text-sm font-semibold text-white">Tình trạng phòng theo tòa nhà</h3>
      </div>

      <!-- Loading -->
      <div v-if="isLoading" class="p-5 space-y-3">
        <UiSkeleton v-for="i in 3" :key="i" class="h-10 rounded-lg" />
      </div>

      <!-- Empty -->
      <div v-else-if="!summary?.buildingBreakdown.length" class="p-5">
        <UiEmptyState
          title="Chưa có tòa nhà"
          description="Thêm tòa nhà để xem tình trạng phòng"
        />
      </div>

      <!-- Table -->
      <template v-else>
        <div class="divide-y divide-dark-border">
          <NuxtLink
            v-for="b in summary.buildingBreakdown"
            :key="b.id"
            :to="`/rooms?buildingId=${b.id}`"
            class="flex items-center justify-between px-5 py-3 hover:bg-dark-hover transition-colors"
          >
            <span class="text-sm font-medium text-white">{{ b.name }}</span>
            <div class="flex items-center gap-4 text-xs">
              <span class="text-muted">{{ b.rooms.total }} phòng</span>
              <span class="text-emerald-400">{{ b.rooms.available }} trống</span>
              <span class="text-cyan-400">{{ b.rooms.occupied }} thuê</span>
              <span class="text-yellow-400">{{ b.rooms.maintenance }} bảo trì</span>
            </div>
          </NuxtLink>
        </div>
      </template>
    </div>
  </div>
</template>
