<script setup lang="ts">
definePageMeta({ title: 'Khách thuê' })

const authStore = useAuthStore()
const { tenants, total, totalPages, page, isLoading, error, q } = useTenantList()

const searchInput = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null

function onSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    q.value = searchInput.value || undefined
  }, 300)
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-semibold text-white">Khách thuê</h1>
        <p class="text-sm text-muted mt-0.5">{{ total }} khách thuê</p>
      </div>
      <NuxtLink v-if="authStore.isAdmin" to="/tenants/create">
        <UiButton>Thêm khách thuê</UiButton>
      </NuxtLink>
    </div>

    <!-- Search -->
    <div class="mb-6">
      <input
        v-model="searchInput"
        type="text"
        placeholder="Tìm theo tên hoặc số điện thoại..."
        class="w-full max-w-sm rounded-md border border-dark-border bg-dark-surface px-3 py-1.5 text-sm text-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan/70"
        @input="onSearch"
      >
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="space-y-3">
      <UiSkeleton v-for="n in 5" :key="n" class="h-16 rounded-xl" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-sm text-error p-4 rounded-lg bg-error/10 border border-error/20">
      Không thể tải danh sách khách thuê. Vui lòng thử lại.
    </div>

    <!-- Empty -->
    <UiEmptyState
      v-else-if="tenants.length === 0"
      title="Chưa có khách thuê nào"
      description="Bắt đầu bằng cách thêm khách thuê đầu tiên."
    >
      <template v-if="authStore.isAdmin" #action>
        <NuxtLink to="/tenants/create">
          <UiButton>Thêm khách thuê đầu tiên</UiButton>
        </NuxtLink>
      </template>
    </UiEmptyState>

    <!-- List -->
    <div v-else class="space-y-2">
      <NuxtLink
        v-for="tenant in tenants"
        :key="tenant.id"
        :to="`/tenants/${tenant.id}`"
        class="flex items-center justify-between px-4 py-3 rounded-xl bg-dark-surface border border-dark-border hover:border-cyan/40 transition-colors"
      >
        <div>
          <p class="text-sm font-medium text-white">{{ tenant.fullName }}</p>
          <p class="text-xs text-muted mt-0.5">{{ tenant.phone }}{{ tenant.idNumber ? ` · CMND/CCCD: ${tenant.idNumber}` : '' }}</p>
        </div>
        <span class="text-muted text-xs">›</span>
      </NuxtLink>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex items-center justify-between mt-6 pt-4 border-t border-dark-border">
      <p class="text-sm text-muted">Trang {{ page }} / {{ totalPages }}</p>
      <div class="flex gap-2">
        <UiButton variant="secondary" size="sm" :disabled="page <= 1" @click="page--">← Trước</UiButton>
        <UiButton variant="secondary" size="sm" :disabled="page >= totalPages" @click="page++">Tiếp →</UiButton>
      </div>
    </div>
  </div>
</template>
