<script setup lang="ts">
const authStore = useAuthStore()
const { buildings, total, totalPages, page, isLoading, error } = useBuildingList()
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-semibold text-white">Tòa nhà</h1>
        <p class="text-sm text-muted mt-0.5">{{ total }} tòa nhà</p>
      </div>
      <NuxtLink v-if="authStore.isAdmin" to="/buildings/create">
        <UiButton>Thêm tòa nhà</UiButton>
      </NuxtLink>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <UiSkeleton v-for="n in 6" :key="n" class="h-36 rounded-xl" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-sm text-error p-4 rounded-lg bg-error/10 border border-error/20">
      Không thể tải danh sách tòa nhà. Vui lòng thử lại.
    </div>

    <!-- Empty -->
    <UiEmptyState
      v-else-if="buildings.length === 0"
      title="Chưa có tòa nhà nào"
      description="Bắt đầu bằng cách thêm tòa nhà đầu tiên của bạn."
    >
      <template v-if="authStore.isAdmin" #action>
        <NuxtLink to="/buildings/create">
          <UiButton>Thêm tòa nhà đầu tiên</UiButton>
        </NuxtLink>
      </template>
    </UiEmptyState>

    <!-- Grid -->
    <template v-else>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <BuildingCard v-for="building in buildings" :key="building.id" :building="building" />
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-between mt-6 pt-4 border-t border-dark-border">
        <p class="text-sm text-muted">Trang {{ page }} / {{ totalPages }}</p>
        <div class="flex gap-2">
          <UiButton variant="secondary" size="sm" :disabled="page <= 1" @click="page--">
            Trước
          </UiButton>
          <UiButton variant="secondary" size="sm" :disabled="page >= totalPages" @click="page++">
            Tiếp
          </UiButton>
        </div>
      </div>
    </template>
  </div>
</template>
