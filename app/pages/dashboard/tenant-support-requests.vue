<script setup lang="ts">
import type { UiTableColumn } from '~/components/ui/UiTable.vue'
import type { OperatorTenantSupportRequest } from '~/types/tenant-support-requests'
import { SUPPORT_REQUEST_STATUSES } from '~/utils/constants/statuses'
import { tenantPath } from '~/utils/routes/operational'

definePageMeta({
  middleware: () => {
    if (!useAuthStore().can('tenants.read')) return navigateTo('/dashboard')
  },
})
const auth = useAuthStore()
const { selectedStatus, page, requests, meta, status, error, refresh, updating, actionError, updateStatus } = useTenantSupportRequestQueue()
const selected = ref<OperatorTenantSupportRequest | null>(null)
const drawerOpen = ref(false)
const successMessage = ref<string | null>(null)
const publicResponse = ref('')
const responseDirty = computed(() => Boolean(selected.value) && publicResponse.value.trim() !== (selected.value?.publicResponse ?? ''))
const replyGuard = usePortalUnsavedChanges(computed(() => responseDirty.value || updating.value))
onBeforeRouteLeave(() => updating.value ? false : replyGuard.guardRouteLeave())
onMounted(() => window.addEventListener('beforeunload', replyGuard.onBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', replyGuard.onBeforeUnload))
const statusOptions = [
  { value: '', label: 'Tất cả trạng thái' },
  ...Object.entries(SUPPORT_REQUEST_STATUSES).map(([value, item]) => ({ value, label: item.label })),
]
const columns: UiTableColumn<OperatorTenantSupportRequest>[] = [
  { key: 'request', label: 'Yêu cầu' },
  { key: 'createdAt', label: 'Ngày gửi', hideOnMobile: true },
  { key: 'status', label: 'Trạng thái' },
  { key: 'actions', label: 'Chi tiết', action: true },
]
async function open(request: OperatorTenantSupportRequest) {
  if (updating.value) return
  if (!await replyGuard.guardRouteLeave()) return
  selected.value = request
  publicResponse.value = request.publicResponse ?? ''
  actionError.value = null
  successMessage.value = null
  drawerOpen.value = true
}
async function closeDrawer(open: boolean) {
  if (updating.value) return
  if (!open) {
    if (!await replyGuard.guardRouteLeave()) return
    publicResponse.value = selected.value?.publicResponse ?? ''
  }
  drawerOpen.value = open
}
async function reloadQueue() {
  if (updating.value || !await replyGuard.guardRouteLeave()) return
  publicResponse.value = selected.value?.publicResponse ?? ''
  drawerOpen.value = false
  await refresh()
}
watch(publicResponse, () => { actionError.value = null; successMessage.value = null })
async function changeStatus(target: 'in_progress' | 'resolved') {
  if (!selected.value || updating.value) return
  if (responseDirty.value && !publicResponse.value.trim()) {
    actionError.value = 'Phản hồi không được để trống. Nhập nội dung hoặc giữ phản hồi hiện tại.'
    return
  }
  const requestId = selected.value.id
  const hasResponseChange = responseDirty.value
  const updated = await updateStatus(selected.value, target, hasResponseChange ? publicResponse.value : undefined)
  if (updated && drawerOpen.value && selected.value?.id === requestId) {
    selected.value = updated
    publicResponse.value = updated.publicResponse ?? ''
    await nextTick()
    successMessage.value = hasResponseChange ? 'Đã lưu phản hồi gửi người thuê và cập nhật tiến độ.' : `Đã chuyển sang “${SUPPORT_REQUEST_STATUSES[updated.status]!.label}”.`
  }
}
const dateLabel = (value: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(value))
</script>

<template>
  <div class="space-y-5">
    <header class="space-y-1">
      <h1 class="text-xl font-semibold text-ui-primary">Yêu cầu người thuê</h1>
      <p class="max-w-2xl text-sm text-ui-muted">Đọc yêu cầu, kiểm tra minh chứng và cập nhật tiến độ xử lý.</p>
    </header>

    <UiListToolbar
      filter-aria-label="Lọc yêu cầu người thuê"
      :filter-count="selectedStatus ? 1 : 0"
      :has-active-filters="Boolean(selectedStatus)"
      @reset="selectedStatus = ''"
    >
      <template #filters>
        <UiSelect v-model="selectedStatus" label="Trạng thái" :options="statusOptions" />
      </template>
    </UiListToolbar>

    <UiAlert v-if="error" severity="danger">
      <p>Không thể tải yêu cầu. Vui lòng kiểm tra kết nối hoặc quyền truy cập.</p>
      <UiButton class="mt-2" variant="secondary" size="sm" @click="refresh()">Thử lại</UiButton>
    </UiAlert>
    <template v-else>
      <UiTable
        :rows="requests"
        :columns="columns"
        :loading="status === 'pending'"
        empty-title="Chưa có yêu cầu trong phạm vi của bạn"
        empty-description="Yêu cầu mới sẽ xuất hiện tại đây khi người thuê gửi đến ban quản lý."
        caption="Yêu cầu người thuê được phép xử lý"
      >
        <template #cell-request="{ row }">
          <div class="min-w-0 max-w-[28rem]">
            <p class="break-words font-medium text-ui-primary">{{ row.title }}</p>
            <p class="mt-1 break-words text-xs text-ui-muted">{{ row.tenantLabel }}</p>
          </div>
        </template>
        <template #cell-createdAt="{ row }"><span class="whitespace-nowrap text-ui-muted">{{ dateLabel(row.createdAt) }}</span></template>
        <template #cell-status="{ row }">
          <UiBadge :variant="SUPPORT_REQUEST_STATUSES[row.status]!.variant" pill>{{ SUPPORT_REQUEST_STATUSES[row.status]!.label }}</UiBadge>
        </template>
        <template #cell-actions="{ row }">
          <UiButton variant="secondary" size="sm" class="min-h-11 sm:min-h-0" :aria-label="`Xem yêu cầu của ${row.tenantLabel}`" :disabled="updating" @click="open(row)">Xem</UiButton>
        </template>
      </UiTable>
      <UiPagination v-model:page="page" :total-pages="meta.totalPages" :total-label="`${meta.total} yêu cầu`" />
    </template>

    <UiDrawer :model-value="drawerOpen" title="Chi tiết yêu cầu" width="lg:w-[32rem]" @update:model-value="closeDrawer">
      <div v-if="selected" class="min-w-0 space-y-5">
        <div class="space-y-2">
          <p class="break-words text-sm font-semibold text-ui-primary">{{ selected.title }}</p>
          <p class="break-words text-sm text-ui-muted">{{ selected.tenantLabel }} · {{ dateLabel(selected.createdAt) }}</p>
          <UiBadge :variant="SUPPORT_REQUEST_STATUSES[selected.status]!.variant" pill>{{ SUPPORT_REQUEST_STATUSES[selected.status]!.label }}</UiBadge>
        </div>
        <section class="space-y-2 border-t border-ui-border pt-4" aria-label="Nội dung yêu cầu">
          <h2 class="text-sm font-semibold text-ui-primary">Nội dung người thuê gửi</h2>
          <p class="whitespace-pre-wrap break-words text-sm text-ui-primary">{{ selected.description }}</p>
        </section>
        <section class="space-y-2" aria-label="Minh chứng">
          <a v-if="selected.attachmentSignedUrl" :href="selected.attachmentSignedUrl" target="_blank" rel="noopener noreferrer" class="inline-flex min-h-11 items-center rounded-md text-sm text-ui-accent underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/40">Mở tệp minh chứng</a>
          <p v-else-if="selected.attachmentUnavailable" class="text-sm text-status-warning">Tệp đính kèm không còn khả dụng</p>
          <p v-else class="text-sm text-ui-muted">Không có tệp đính kèm.</p>
        </section>
        <section class="space-y-3 border-t border-ui-border pt-4" aria-label="Phản hồi gửi người thuê">
          <template v-if="auth.can('tenants.update')">
            <UiTextarea v-model="publicResponse" label="Phản hồi gửi người thuê" hint="Người thuê sẽ thấy nội dung này trong chi tiết yêu cầu. Không nhập ghi chú nội bộ." :rows="5" :maxlength="4000" :disabled="updating" placeholder="Ví dụ: Đã hẹn kỹ thuật kiểm tra vào chiều mai. Bạn vui lòng giữ liên lạc." />
            <UiButton variant="secondary" :disabled="!responseDirty || updating || !publicResponse.trim()" :loading="updating" @click="changeStatus(selected.status === 'new' ? 'in_progress' : selected.status)">Lưu phản hồi</UiButton>
          </template>
          <template v-else>
            <h2 class="text-sm font-semibold text-ui-primary">Phản hồi gửi người thuê</h2>
            <p class="whitespace-pre-wrap break-words text-sm text-ui-primary">{{ selected.publicResponse || 'Chưa có phản hồi.' }}</p>
          </template>
          <p v-if="selected.respondedAt" class="text-xs text-ui-muted">Phản hồi gần nhất: {{ dateLabel(selected.respondedAt) }}</p>
        </section>
        <UiAlert severity="info">Thông tin hồ sơ không tự động thay đổi. Kiểm tra và chỉnh sửa hồ sơ bằng thao tác riêng trước khi đánh dấu đã xử lý.</UiAlert>
        <NuxtLink :to="tenantPath({ code: selected.tenantCode })" class="inline-flex min-h-11 items-center rounded-md text-sm text-ui-accent underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/40">Xem hồ sơ người thuê</NuxtLink>
        <NuxtLink v-if="auth.can('tenants.update')" :to="`${tenantPath({ code: selected.tenantCode })}/edit`" class="ml-4 inline-flex min-h-11 items-center rounded-md text-sm text-ui-accent underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/40">Chỉnh sửa hồ sơ</NuxtLink>
        <UiAlert v-if="actionError" severity="danger">{{ actionError }} <UiButton variant="secondary" size="sm" class="mt-2" @click="reloadQueue">Tải lại danh sách</UiButton></UiAlert>
        <p v-if="successMessage" role="status" class="text-sm text-status-success">{{ successMessage }}</p>
      </div>
      <template #footer>
        <div v-if="selected && auth.can('tenants.update')" class="flex flex-wrap gap-3">
          <UiButton v-if="selected.status !== 'in_progress'" :loading="updating" :disabled="Boolean(actionError)" @click="changeStatus('in_progress')">{{ selected.status === 'new' ? 'Bắt đầu xử lý' : 'Mở lại yêu cầu' }}</UiButton>
          <UiButton v-if="selected.status === 'in_progress'" :loading="updating" :disabled="Boolean(actionError)" @click="changeStatus('resolved')">Đánh dấu đã xử lý</UiButton>
        </div>
      </template>
    </UiDrawer>
    <UiConfirmModal :open="replyGuard.discardOpen.value" title="Bỏ phản hồi đang soạn?" message="Phản hồi chưa được lưu và chưa gửi cho người thuê." confirm-label="Bỏ bản nháp" @confirm="replyGuard.discardChanges" @cancel="replyGuard.keepEditing" />
  </div>
</template>
