<script setup lang="ts">
import type { TenantRequestStatus } from '~/composables/tenant-portal/usePortalRequests'

definePageMeta({
  layout: 'tenant',
  pageTransition: { name: 'portal-page', mode: 'out-in' },
})

const { setChrome } = usePortalChrome()
setChrome({ title: 'Yêu cầu', back: null })

const { requests, status, error, refresh, submit, submitting } = usePortalRequests()
const toast = usePortalToast()

const STATUS_LABELS: Record<TenantRequestStatus, string> = {
  open: 'Đang chờ',
  in_progress: 'Đang xử lý',
  resolved: 'Đã xử lý',
  closed: 'Đã đóng',
}

const STATUS_CLASS: Record<TenantRequestStatus, string> = {
  open: 'bg-warning/15 text-warning',
  in_progress: 'bg-theme/10 text-theme',
  resolved: 'bg-success/15 text-success',
  closed: 'bg-smoke text-body',
}

const CATEGORIES = [
  { value: 'maintenance', label: 'Sửa chữa' },
  { value: 'billing', label: 'Hoá đơn' },
  { value: 'contract', label: 'Hợp đồng' },
  { value: 'other', label: 'Khác' },
]

const sheetOpen = ref(false)
const form = reactive({ title: '', category: 'maintenance', description: '' })
const formErrors = reactive({ title: '', description: '' })

function openSheet() {
  form.title = ''
  form.category = 'maintenance'
  form.description = ''
  formErrors.title = ''
  formErrors.description = ''
  sheetOpen.value = true
}

async function onSubmit() {
  formErrors.title = form.title.trim() ? '' : 'Vui lòng nhập tiêu đề.'
  formErrors.description = form.description.trim() ? '' : 'Vui lòng mô tả yêu cầu.'
  if (formErrors.title || formErrors.description) return

  const ok = await submit({
    title: form.title.trim(),
    category: form.category,
    description: form.description.trim(),
  })
  if (ok) {
    sheetOpen.value = false
    toast.success('Đã gửi yêu cầu.')
  }
  else {
    toast.error('Không gửi được yêu cầu. Vui lòng thử lại.')
  }
}
</script>

<template>
  <div>
    <Teleport to="#portal-header-action">
      <PortalButton size="sm" @click="openSheet">
        <IconPlus class="h-4 w-4" aria-hidden="true" />
        Mới
      </PortalButton>
    </Teleport>

    <PortalPullToRefresh :on-refresh="refresh">
      <div class="space-y-3 px-4 py-4">
        <template v-if="status === 'pending'">
          <PortalSkeleton v-for="n in 3" :key="n" class="h-24 w-full" />
        </template>

        <PortalEmptyState
          v-else-if="error"
          tone="error"
          title="Không tải được yêu cầu"
          description="Đã xảy ra lỗi khi tải danh sách yêu cầu."
          action-label="Thử lại"
          @action="refresh"
        />

        <PortalEmptyState
          v-else-if="requests.length === 0"
          title="Chưa có yêu cầu"
          description="Gửi yêu cầu hỗ trợ và theo dõi tiến độ tại đây."
          action-label="Tạo yêu cầu"
          @action="openSheet"
        >
          <template #icon>
            <IconMessageCircle class="h-6 w-6" aria-hidden="true" />
          </template>
        </PortalEmptyState>

        <template v-else>
          <PortalCard v-for="request in requests" :key="request.id">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold text-title">{{ request.title }}</p>
                <p class="mt-1 line-clamp-2 text-xs text-body">{{ request.description }}</p>
                <p class="mt-2 text-xs text-body">{{ request.createdAt }}</p>
              </div>
              <span
                class="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                :class="STATUS_CLASS[request.status]"
              >
                {{ STATUS_LABELS[request.status] }}
              </span>
            </div>
          </PortalCard>
        </template>
      </div>
    </PortalPullToRefresh>

    <PortalBottomSheet v-model="sheetOpen" title="Gửi yêu cầu">
      <form class="space-y-4 py-1" @submit.prevent="onSubmit">
        <PortalTextField
          v-model="form.title"
          label="Tiêu đề"
          placeholder="Ví dụ: Vòi nước bị rò rỉ"
          :error="formErrors.title"
        />

        <div class="space-y-1.5">
          <span class="text-sm font-medium text-title">Loại yêu cầu</span>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="category in CATEGORIES"
              :key="category.value"
              type="button"
              class="rounded-full border px-3 py-1.5 text-sm font-medium transition-colors"
              :class="form.category === category.value
                ? 'border-theme bg-theme/10 text-theme'
                : 'border-border-light bg-white text-body'"
              @click="form.category = category.value"
            >
              {{ category.label }}
            </button>
          </div>
        </div>

        <PortalTextField
          v-model="form.description"
          label="Mô tả"
          textarea
          :rows="4"
          placeholder="Mô tả chi tiết vấn đề của bạn"
          :error="formErrors.description"
        />

        <PortalButton type="submit" block size="lg" :loading="submitting">Gửi yêu cầu</PortalButton>
      </form>
    </PortalBottomSheet>
  </div>
</template>
