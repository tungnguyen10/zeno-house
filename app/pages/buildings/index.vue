<script setup lang="ts">
const authStore = useAuthStore()
const { buildings, total, totalPages, page, isLoading, error } = useBuildingList()
</script>

<template>
  <div>
    <UiPageHeader
      title="Tòa nhà"
      :description="`${total} tòa nhà`"
    >
      <template v-if="authStore.isAdmin" #actions>
        <NuxtLink to="/buildings/create">
          <UiButton>Thêm tòa nhà</UiButton>
        </NuxtLink>
      </template>
    </UiPageHeader>

    <!-- Loading -->
    <div v-if="isLoading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <UiSkeleton v-for="n in 6" :key="n" class="h-36 rounded-xl" />
    </div>

    <!-- Error -->
    <UiAlert v-else-if="error" severity="danger">
      Không thể tải danh sách tòa nhà. Vui lòng thử lại.
    </UiAlert>

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
