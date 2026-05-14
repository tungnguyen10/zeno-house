<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'
import type { Building } from '~/types/buildings'

const route = useRoute()
const authStore = useAuthStore()
const id = route.params.id as string

const { data, error, status } = await useFetch<ApiSuccess<Building>>(`/api/buildings/${id}`)
const building = computed(() => data.value?.data ?? null)

const showDeleteModal = ref(false)
const isDeleting = ref(false)

async function confirmDelete() {
  isDeleting.value = true
  try {
    await $fetch(`/api/buildings/${id}`, { method: 'DELETE' })
    await navigateTo('/buildings')
  }
  finally {
    isDeleting.value = false
    showDeleteModal.value = false
  }
}

// 404 redirect
if (error.value?.statusCode === 404) {
  await navigateTo('/buildings')
}
</script>

<template>
  <div>
    <!-- Loading -->
    <div v-if="status === 'pending'" class="space-y-4">
      <UiSkeleton class="h-8 w-64 rounded-lg" />
      <UiSkeleton class="h-48 rounded-xl" />
    </div>

    <!-- Error -->
    <div v-else-if="error && error.statusCode !== 404" class="text-sm text-error p-4 rounded-lg bg-error/10 border border-error/20">
      Không thể tải thông tin tòa nhà.
    </div>

    <!-- Detail -->
    <template v-else-if="building">
      <div class="flex items-start justify-between gap-4 mb-6">
        <div>
          <NuxtLink to="/buildings" class="text-sm text-muted hover:text-white transition-colors">
            ← Danh sách tòa nhà
          </NuxtLink>
          <h1 class="text-xl font-semibold text-white mt-2">{{ building.name }}</h1>
        </div>
        <div v-if="authStore.isAdmin" class="flex gap-2 shrink-0">
          <NuxtLink :to="`/buildings/${building.id}/edit`">
            <UiButton variant="secondary" size="sm">Chỉnh sửa</UiButton>
          </NuxtLink>
          <UiButton variant="danger" size="sm" @click="showDeleteModal = true">Xoá</UiButton>
        </div>
      </div>

      <div class="rounded-xl border border-dark-border bg-dark-surface p-6 space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="text-xs text-muted mb-1">Địa chỉ</p>
            <p class="text-sm text-white">{{ building.address }}</p>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">Trạng thái</p>
            <UiStatusBadge :status="building.status" />
          </div>
          <div>
            <p class="text-xs text-muted mb-1">Số phòng</p>
            <p class="text-sm text-white">{{ building.totalRooms }}</p>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">Ngày tạo</p>
            <p class="text-sm text-white">{{ new Date(building.createdAt).toLocaleDateString('vi-VN') }}</p>
          </div>
        </div>
        <div v-if="building.description">
          <p class="text-xs text-muted mb-1">Mô tả</p>
          <p class="text-sm text-white">{{ building.description }}</p>
        </div>
      </div>
    </template>

    <!-- Delete confirmation modal -->
    <UiModal :open="showDeleteModal" title="Xác nhận xoá" @close="showDeleteModal = false">
      <template #default>
        <p class="text-sm text-muted">
          Bạn có chắc muốn xoá tòa nhà <strong class="text-white">{{ building?.name }}</strong>? Hành động này không thể hoàn tác.
        </p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UiButton variant="secondary" @click="showDeleteModal = false">Huỷ</UiButton>
          <UiButton variant="danger" :loading="isDeleting" @click="confirmDelete">Xoá</UiButton>
        </div>
      </template>
    </UiModal>
  </div>
</template>
