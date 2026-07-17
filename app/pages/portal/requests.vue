<script setup lang="ts">
import type { TenantSupportRequestStatus } from '~/types/tenant-portal'
import {
  TENANT_DOCUMENT_MAX_BYTES,
  TENANT_DOCUMENT_MIME_TYPES,
} from '~/utils/validators/tenant-portal'

definePageMeta({
  layout: 'tenant',
  pageTransition: { name: 'portal-page', mode: 'out-in' },
})

const { setChrome } = usePortalChrome()
setChrome({ title: 'Yêu cầu', back: null })

const { requests, status, error, refresh, submit, submitting } = usePortalRequests()
const toast = usePortalToast()

const STATUS_LABELS: Record<TenantSupportRequestStatus, string> = {
  new: 'Mới gửi',
  in_progress: 'Đang xử lý',
  resolved: 'Đã xử lý',
}

const STATUS_CLASS: Record<TenantSupportRequestStatus, string> = {
  new: 'bg-warning/15 text-warning',
  in_progress: 'bg-theme/10 text-theme',
  resolved: 'bg-success/15 text-success',
}

const sheetOpen = ref(false)
const attachmentInput = ref<HTMLInputElement | null>(null)
const attachment = ref<File | null>(null)
const form = reactive({ title: '', description: '' })
const formErrors = reactive({ title: '', description: '' })
const attachmentError = ref('')

function openSheet() {
  form.title = ''
  form.description = ''
  formErrors.title = ''
  formErrors.description = ''
  attachment.value = null
  attachmentError.value = ''
  if (attachmentInput.value) attachmentInput.value.value = ''
  sheetOpen.value = true
}

function onAttachmentChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  attachmentError.value = ''
  if (!file) {
    attachment.value = null
    return
  }
  if (!TENANT_DOCUMENT_MIME_TYPES.includes(
    file.type as (typeof TENANT_DOCUMENT_MIME_TYPES)[number],
  )) {
    attachment.value = null
    attachmentError.value = 'Tệp phải là ảnh JPEG, PNG, WebP hoặc PDF.'
    return
  }
  if (file.size > TENANT_DOCUMENT_MAX_BYTES) {
    attachment.value = null
    attachmentError.value = 'Tệp không được vượt quá 5MB.'
    return
  }
  attachment.value = file
}

async function onSubmit() {
  formErrors.title = form.title.trim() ? '' : 'Vui lòng nhập tiêu đề.'
  formErrors.description = form.description.trim() ? '' : 'Vui lòng mô tả yêu cầu.'
  if (formErrors.title || formErrors.description) return

  const ok = await submit({
    title: form.title.trim(),
    description: form.description.trim(),
    attachment: attachment.value ?? undefined,
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
                <a
                  v-if="request.attachmentSignedUrl"
                  :href="request.attachmentSignedUrl"
                  target="_blank"
                  rel="noopener"
                  class="mt-2 inline-flex items-center gap-1 text-xs font-medium text-theme"
                >
                  <IconDocumentText class="h-4 w-4" aria-hidden="true" />
                  Xem tệp đính kèm
                </a>
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

        <PortalTextField
          v-model="form.description"
          label="Mô tả"
          textarea
          :rows="4"
          placeholder="Mô tả chi tiết vấn đề của bạn"
          :error="formErrors.description"
        />

        <div class="space-y-1.5">
          <span class="text-sm font-medium text-title">Tệp đính kèm (không bắt buộc)</span>
          <label
            class="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border-light bg-white px-3 py-2.5 text-sm text-body transition-colors hover:border-theme/40"
          >
            <IconDocumentText class="h-5 w-5 shrink-0 text-theme" aria-hidden="true" />
            <span class="min-w-0 flex-1 truncate">
              {{ attachment?.name ?? 'Chọn ảnh hoặc PDF, tối đa 5MB' }}
            </span>
            <input
              ref="attachmentInput"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              class="sr-only"
              @change="onAttachmentChange"
            >
          </label>
          <p v-if="attachmentError" class="text-xs text-error">{{ attachmentError }}</p>
        </div>

        <PortalButton type="submit" block size="lg" :loading="submitting">Gửi yêu cầu</PortalButton>
      </form>
    </PortalBottomSheet>
  </div>
</template>
