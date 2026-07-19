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

const { requests, status, error, refresh, submit, submitting } = usePortalRequests()
const toast = usePortalToast()

const mode = ref<'list' | 'create'>('list')
const attachmentInput = ref<HTMLInputElement | null>(null)
const attachment = ref<File | null>(null)
const form = reactive({ title: '', description: '' })
const formErrors = reactive({ title: '', description: '' })
const attachmentError = ref('')

watch(mode, (val) => {
  setChrome(val === 'create'
    ? { title: 'Yêu cầu mới', back: null }
    : { title: 'Yêu cầu', back: null },
  )
}, { immediate: true })

function openCreate() {
  form.title = ''
  form.description = ''
  formErrors.title = ''
  formErrors.description = ''
  attachment.value = null
  attachmentError.value = ''
  if (attachmentInput.value) attachmentInput.value.value = ''
  mode.value = 'create'
}

function cancelCreate() {
  mode.value = 'list'
}

function onAttachmentChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  attachmentError.value = ''
  if (!file) { attachment.value = null; return }
  if (!TENANT_DOCUMENT_MIME_TYPES.includes(file.type as (typeof TENANT_DOCUMENT_MIME_TYPES)[number])) {
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
    mode.value = 'list'
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
      <PortalButton v-if="mode === 'list'" size="sm" @click="openCreate">
        <IconPlus class="h-4 w-4" aria-hidden="true" />
        Mới
      </PortalButton>
    </Teleport>

    <!-- List mode -->
    <PortalPullToRefresh v-if="mode === 'list'" :on-refresh="refresh">
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
          @action="openCreate"
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

    <!-- Create mode -->
    <form v-else class="mx-auto w-full max-w-2xl space-y-5 px-4 py-5 lg:px-8 lg:py-8" @submit.prevent="onSubmit">
      <section class="space-y-3">
        <h3 class="portal-type-heading px-1 text-title">Thông tin yêu cầu</h3>
        <PortalCard class="space-y-4">
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
        </PortalCard>
      </section>

      <section class="space-y-3">
        <h3 class="portal-type-heading px-1 text-title">Tệp đính kèm</h3>
        <PortalCard>
          <label
            class="flex min-h-12 cursor-pointer items-center gap-3 text-sm text-body"
            :class="attachmentError ? 'text-portal-danger' : undefined"
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
          <p v-if="attachmentError" id="request-attachment-error" class="portal-type-caption mt-2 text-portal-danger">
            {{ attachmentError }}
          </p>
        </PortalCard>
      </section>

      <div class="flex gap-3">
        <PortalButton variant="secondary" block :disabled="submitting" @click="cancelCreate">Hủy</PortalButton>
        <PortalButton type="submit" block :loading="submitting">Gửi yêu cầu</PortalButton>
      </div>
    </form>
  </div>
</template>
