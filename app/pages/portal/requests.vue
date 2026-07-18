<script setup lang="ts">
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
      <div class="px-4 py-5 lg:px-8 lg:py-8">
        <div v-if="status === 'pending'" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <PortalSkeleton v-for="n in 6" :key="n" variant="card" />
        </div>

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

        <div v-else class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <PortalCard v-for="request in requests" :key="request.id">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="portal-type-heading truncate text-title">{{ request.title }}</p>
                <p class="portal-type-body mt-1 line-clamp-2 text-body">{{ request.description }}</p>
                <a
                  v-if="request.attachmentSignedUrl"
                  :href="request.attachmentSignedUrl"
                  target="_blank"
                  rel="noopener"
                  class="portal-type-label mt-2 inline-flex items-center gap-1 rounded-md text-theme focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40"
                >
                  <IconDocumentText class="h-4 w-4" aria-hidden="true" />
                  Xem tệp đính kèm
                </a>
                <p class="portal-type-caption mt-2 text-body">{{ request.createdAt }}</p>
              </div>
              <PortalStatusBadge :status="request.status" />
            </div>
          </PortalCard>
        </div>
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
          <span class="portal-type-label text-title">Tệp đính kèm (không bắt buộc)</span>
          <label
            class="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border-light bg-white px-3 py-2.5 text-sm text-body transition-colors hover:border-theme/40 focus-within:border-theme focus-within:outline-none focus-within:ring-2 focus-within:ring-theme/20"
            :class="attachmentError ? 'border-portal-danger focus-within:border-portal-danger focus-within:ring-portal-danger/20' : undefined"
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
              :aria-invalid="attachmentError ? 'true' : undefined"
              :aria-describedby="attachmentError ? 'request-attachment-error' : undefined"
              @change="onAttachmentChange"
            >
          </label>
          <p v-if="attachmentError" id="request-attachment-error" class="portal-type-caption text-portal-danger">
            {{ attachmentError }}
          </p>
        </div>

        <PortalButton type="submit" block size="lg" :loading="submitting">Gửi yêu cầu</PortalButton>
      </form>
    </PortalBottomSheet>
  </div>
</template>
