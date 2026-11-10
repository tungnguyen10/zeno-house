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
const correctionIntent = useRoute().query.intent === 'profile-correction'
const isProfileCorrection = ref(false)
const { contract, status: housingStatus, error: housingError, refresh: refreshHousing } = usePortalContract()
const canRouteRequest = computed(() => housingStatus.value === 'success' && Boolean(contract.value))

const { requests, status, error, refresh, submit, submitting, apiError } = usePortalRequests()
const toast = usePortalToast()

const mode = ref<'list' | 'create'>('list')
const attachmentInput = ref<HTMLInputElement | null>(null)
const attachment = ref<File | null>(null)
const form = reactive({ title: '', description: '' })
const formErrors = reactive({ title: '', description: '' })
const attachmentError = ref('')

watch(mode, (val) => {
  setChrome(val === 'create'
    ? { title: isProfileCorrection.value ? 'Yêu cầu chỉnh sửa hồ sơ' : 'Yêu cầu mới', back: null }
    : { title: 'Yêu cầu', back: null },
  )
}, { immediate: true })

function openCreate(intent?: unknown) {
  apiError.value = null
  isProfileCorrection.value = intent === 'profile-correction'
  form.title = isProfileCorrection.value ? 'Yêu cầu chỉnh sửa hồ sơ' : ''
  form.description = ''
  formErrors.title = ''
  formErrors.description = ''
  attachment.value = null
  attachmentError.value = ''
  if (attachmentInput.value) attachmentInput.value.value = ''
  mode.value = 'create'
}

function cancelCreate() {
  if (submitting.value) return
  mode.value = 'list'
}

// Consume only the literal intent once; query updates must not reset an in-progress form.
if (correctionIntent) openCreate('profile-correction')

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
  if (!canRouteRequest.value || submitting.value) return
  formErrors.title = form.title.trim() ? '' : 'Vui lòng nhập tiêu đề.'
  formErrors.description = form.description.trim() ? '' : 'Vui lòng mô tả yêu cầu.'
  if (formErrors.title || formErrors.description || attachmentError.value) return

  const ok = await submit({
    title: form.title.trim(),
    description: form.description.trim(),
    attachment: attachment.value ?? undefined,
  })
  if (ok) {
    mode.value = 'list'
    toast.success(isProfileCorrection.value
      ? 'Đã gửi yêu cầu, thông tin hồ sơ chưa thay đổi'
      : 'Đã gửi yêu cầu.')
  }
  else {
    toast.error(apiError.value ?? 'Không gửi được yêu cầu. Vui lòng thử lại.')
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
    <div v-else>
      <div v-if="housingStatus === 'pending' || housingStatus === 'idle'" class="mx-auto max-w-2xl px-4 py-5 lg:px-8 lg:py-8">
        <PortalSkeleton variant="card" />
      </div>
      <PortalEmptyState
        v-else-if="housingError"
        tone="error"
        title="Không xác định được nơi tiếp nhận"
        description="Hãy kiểm tra kết nối và thử lại trước khi gửi yêu cầu."
        action-label="Thử lại"
        @action="refreshHousing"
      />
      <PortalEmptyState
        v-else-if="!canRouteRequest"
        title="Chưa có nơi tiếp nhận"
        description="Hồ sơ chưa có nơi tiếp nhận yêu cầu. Vui lòng liên hệ trực tiếp ban quản lý"
        action-label="Quay lại yêu cầu"
        @action="cancelCreate"
      />
      <form v-else class="mx-auto w-full max-w-2xl space-y-5 px-4 py-5 lg:px-8 lg:py-8" @submit.prevent="onSubmit">
      <p v-if="isProfileCorrection" class="px-1 portal-type-body text-body">
        Mô tả thông tin cần chỉnh sửa để ban quản lý đối chiếu. Thông tin hồ sơ chỉ thay đổi sau khi ban quản lý đối chiếu và cập nhật.
      </p>
      <section class="space-y-3">
        <h3 class="portal-type-heading px-1 text-title">Thông tin yêu cầu</h3>
        <PortalCard class="space-y-4">
          <UiInput
            v-model="form.title"
            label="Tiêu đề"
            placeholder="Ví dụ: Vòi nước bị rò rỉ"
            :error="formErrors.title"
            :readonly="isProfileCorrection"
            :disabled="submitting"
            required
          />
          <UiTextarea
            v-model="form.description"
            label="Mô tả"
            :rows="4"
            placeholder="Mô tả chi tiết vấn đề của bạn"
            :error="formErrors.description"
            :disabled="submitting"
            required
          />
        </PortalCard>
      </section>

      <section class="space-y-3">
        <h3 class="portal-type-heading px-1 text-title">Tệp đính kèm</h3>
        <PortalCard>
          <p class="mb-3 portal-type-caption text-body">
            Một tệp JPEG, PNG, WebP hoặc PDF, tối đa 5MB. Tài liệu hai mặt có thể gộp thành một tệp PDF.
          </p>
          <label
            class="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-dark-border px-3 py-2 text-sm text-body focus-within:ring-2 focus-within:ring-theme/30"
            :class="attachmentError
              ? 'border-portal-danger text-portal-danger focus-within:ring-portal-danger/30'
              : 'focus-within:border-theme/70'"
          >
            <IconDocumentText class="h-5 w-5 shrink-0 text-theme" aria-hidden="true" />
            <span class="min-w-0 flex-1 truncate">
              {{ attachment?.name ?? 'Chọn ảnh hoặc PDF, tối đa 5MB' }}
            </span>
            <input
              ref="attachmentInput"
              type="file"
              :disabled="submitting"
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

      <p v-if="apiError" role="alert" class="rounded-xl border border-portal-danger/25 bg-portal-danger/5 px-4 py-3 portal-type-body text-portal-danger">
        {{ apiError }}
      </p>
      <div class="flex gap-3">
        <PortalButton variant="secondary" block :disabled="submitting" @click="cancelCreate">Hủy</PortalButton>
        <PortalButton type="submit" block :loading="submitting">Gửi yêu cầu</PortalButton>
      </div>
      </form>
    </div>
  </div>
</template>
