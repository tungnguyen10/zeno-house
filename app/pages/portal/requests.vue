<script setup lang="ts">
import {
  TENANT_DOCUMENT_MAX_BYTES,
  TENANT_DOCUMENT_MIME_TYPES,
} from '~/utils/validators/tenant-portal'
import type { TenantSupportRequest } from '~/types/tenant-portal'
import { getApiErrorMessage } from '~/utils/api-error'

definePageMeta({
  layout: 'tenant',
  pageTransition: { name: 'portal-page', mode: 'out-in' },
})

const { setChrome } = usePortalChrome()
const route = useRoute()
const initialIntent = route.query.intent
const isProfileCorrection = ref(false)
const isPaymentReport = ref(false)
const { contract, status: housingStatus, error: housingError, refresh: refreshHousing } = usePortalContract()
const canRouteRequest = computed(() => housingStatus.value === 'success' && Boolean(contract.value))

const { sessionKey, requests, status, error, refresh, loadMore, hasMore, loadingMore, loadMoreError, loadDetail, submit, submitting, progress, apiError } = usePortalRequests()
const toast = usePortalToast()

const mode = ref<'list' | 'create'>('list')
const attachmentInput = ref<HTMLInputElement | null>(null)
const attachment = ref<File | null>(null)
const form = reactive({ title: '', description: '' })
const formErrors = reactive({ title: '', description: '' })
const attachmentError = ref('')
const baseline = ref({ title: '', description: '' })
const dirty = computed(() => mode.value === 'create' && (
  form.title !== baseline.value.title || form.description !== baseline.value.description || attachment.value !== null || submitting.value
))
const guard = usePortalUnsavedChanges(dirty)
onBeforeRouteLeave(guard.guardRouteLeave)
onMounted(() => window.addEventListener('beforeunload', guard.onBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', guard.onBeforeUnload))

const selected = ref<TenantSupportRequest | null>(null)
const detailOpen = ref(false)
const detailLoading = ref(false)
const detailError = ref<string | null>(null)
let detailVersion = 0
watch(sessionKey, () => {
  detailVersion++
  detailLoading.value = false
  detailOpen.value = false
  selected.value = null
  detailError.value = null
  form.title = ''
  form.description = ''
  baseline.value = { ...form }
  removeAttachment()
  mode.value = 'list'
  guard.keepEditing()
}, { flush: 'sync' })
const dateLabel = (value: string) => new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(value))

async function refreshDetail() {
  if (!selected.value || detailLoading.value) return
  const id = selected.value.id
  const version = ++detailVersion
  detailLoading.value = true
  detailError.value = null
  try {
    const request = await loadDetail(id)
    if (version === detailVersion && selected.value?.id === id && request) selected.value = request
  }
  catch (error) {
    if (version === detailVersion) detailError.value = getApiErrorMessage(error, 'Chưa tải được cập nhật mới. Hãy thử lại.')
  }
  finally { if (version === detailVersion) detailLoading.value = false }
}

function openDetail(request: TenantSupportRequest) {
  detailVersion++
  detailLoading.value = false
  selected.value = request
  detailOpen.value = true
  void refreshDetail()
}

watch(mode, (val) => {
  setChrome(val === 'create'
    ? { title: isProfileCorrection.value ? 'Yêu cầu chỉnh sửa hồ sơ' : isPaymentReport.value ? 'Đối chiếu thanh toán' : 'Yêu cầu mới', back: null }
    : { title: 'Yêu cầu', back: null },
  )
}, { immediate: true })

function openCreate(intent?: unknown) {
  apiError.value = null
  isProfileCorrection.value = intent === 'profile-correction'
  isPaymentReport.value = intent === 'payment-report'
  form.title = isProfileCorrection.value ? 'Yêu cầu chỉnh sửa hồ sơ' : isPaymentReport.value ? 'Yêu cầu đối chiếu thanh toán' : ''
  const invoice = typeof route.query.invoice === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(route.query.invoice) ? route.query.invoice : null
  // An invoice code is plain support text, never authority to read or mutate an invoice.
  form.description = isPaymentReport.value
    ? `Nhờ ban quản lý kiểm tra thanh toán${invoice ? ` cho hóa đơn ${invoice}` : ''}.\nSố tiền đã chuyển: \nThời gian chuyển: `
    : ''
  baseline.value = { ...form }
  formErrors.title = ''
  formErrors.description = ''
  attachment.value = null
  attachmentError.value = ''
  if (attachmentInput.value) attachmentInput.value.value = ''
  mode.value = 'create'
}

async function cancelCreate() {
  if (submitting.value) return
  if (!await guard.guardRouteLeave()) return
  mode.value = 'list'
}

// Consume only the literal intent once; query updates must not reset an in-progress form.
if (initialIntent === 'profile-correction' || initialIntent === 'payment-report') openCreate(initialIntent)

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

function removeAttachment() {
  attachment.value = null
  attachmentError.value = ''
  if (attachmentInput.value) attachmentInput.value.value = ''
}

async function onSubmit() {
  if (!canRouteRequest.value || submitting.value) return
  formErrors.title = form.title.trim() ? '' : 'Vui lòng nhập tiêu đề.'
  formErrors.description = form.description.trim() ? '' : 'Vui lòng mô tả yêu cầu.'
  if (isPaymentReport.value && form.description.trim() === baseline.value.description.trim() && !attachment.value) {
    formErrors.description = 'Bổ sung số tiền, thời gian chuyển hoặc chọn minh chứng để ban quản lý đối chiếu.'
  }
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
      : isPaymentReport.value ? 'Đã gửi yêu cầu đối chiếu. Số dư hóa đơn chưa thay đổi.'
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
        <div v-if="status === 'pending' && !requests.length" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
          <PortalCard v-for="request in requests" :key="request.id" interactive :aria-label="`Xem yêu cầu: ${request.title}`" @click="openDetail(request)">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="portal-type-heading line-clamp-2 break-words text-title">{{ request.title }}</p>
                <p class="portal-type-body mt-1 line-clamp-2 text-body">{{ request.description }}</p>
                <p v-if="request.publicResponse" class="portal-type-caption mt-2 font-medium text-theme">Ban quản lý đã phản hồi</p>
                <p class="portal-type-caption mt-2 text-body">{{ dateLabel(request.createdAt) }}</p>
                <span class="portal-type-label mt-3 inline-flex items-center gap-1 text-theme">Xem chi tiết <IconChevronRight class="h-4 w-4" aria-hidden="true" /></span>
              </div>
              <PortalStatusBadge :status="request.status" />
            </div>
          </PortalCard>
        </div>
        <div v-if="hasMore || loadMoreError" class="mt-5 space-y-3">
          <p v-if="loadMoreError" role="alert" class="portal-type-body text-portal-danger">{{ loadMoreError }}</p>
          <PortalButton variant="secondary" block :loading="loadingMore" @click="loadMore">Xem yêu cầu cũ hơn</PortalButton>
        </div>
      </div>
    </PortalPullToRefresh>

    <!-- Create mode -->
    <div v-else>
      <div v-if="!contract && (housingStatus === 'pending' || housingStatus === 'idle')" class="mx-auto max-w-2xl px-4 py-5 lg:px-8 lg:py-8">
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
        v-else-if="!contract"
        title="Chưa có nơi tiếp nhận"
        description="Hồ sơ chưa có nơi tiếp nhận yêu cầu. Vui lòng liên hệ trực tiếp ban quản lý"
        action-label="Quay lại yêu cầu"
        @action="cancelCreate"
      />
      <form v-else class="mx-auto w-full max-w-2xl space-y-5 px-4 py-5 lg:px-8 lg:py-8" @submit.prevent="onSubmit">
      <p v-if="isProfileCorrection" class="px-1 portal-type-body text-body">
        Mô tả thông tin cần chỉnh sửa để ban quản lý đối chiếu. Thông tin hồ sơ chỉ thay đổi sau khi ban quản lý đối chiếu và cập nhật.
      </p>
      <p v-else-if="isPaymentReport" class="px-1 portal-type-body text-body">Gửi số tiền, thời gian chuyển và minh chứng để ban quản lý đối chiếu. Yêu cầu này không tự xác nhận thanh toán; số dư chỉ cập nhật sau khi được kiểm tra và ghi nhận.</p>
      <section class="space-y-3">
        <h3 class="portal-type-heading px-1 text-title">Thông tin yêu cầu</h3>
        <PortalCard class="space-y-4">
          <PortalInput
            v-model="form.title"
            label="Tiêu đề"
            placeholder="Ví dụ: Vòi nước bị rò rỉ"
            :error="formErrors.title"
            :readonly="isProfileCorrection || isPaymentReport"
            :maxlength="200"
            :disabled="submitting"
            required
          />
          <PortalInput
            v-model="form.description"
            textarea
            label="Mô tả"
            :rows="4"
            :maxlength="5000"
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
            class="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border-light px-3 py-2 portal-type-body text-body focus-within:ring-2 focus-within:ring-theme/30"
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
          <PortalButton v-if="(attachment || attachmentError) && !submitting" variant="ghost" size="sm" class="mt-2" @click="removeAttachment">Bỏ tệp đã chọn</PortalButton>
          <div v-if="submitting && attachment" class="mt-3 space-y-1" role="status" aria-live="polite">
            <progress class="portal-progress" :value="progress" max="100" aria-label="Tiến độ tải tệp đính kèm">{{ progress }}%</progress>
            <p class="portal-type-caption text-body">{{ progress < 100 ? `Đang tải tệp ${progress}%` : 'Đã tải tệp, đang gửi yêu cầu…' }}</p>
          </div>
        </PortalCard>
      </section>

      <p v-if="apiError" role="alert" class="rounded-xl border border-portal-danger/25 bg-portal-danger/5 px-4 py-3 portal-type-body text-portal-danger">
        {{ apiError }}
      </p>
      <div class="flex gap-3">
        <PortalButton variant="secondary" block :disabled="submitting" @click="cancelCreate">Hủy</PortalButton>
        <PortalButton type="submit" block :loading="submitting" :disabled="!canRouteRequest">Gửi yêu cầu</PortalButton>
      </div>
      </form>
    </div>
    <PortalBottomSheet v-model="detailOpen" title="Chi tiết yêu cầu">
      <article v-if="selected" class="space-y-5 pb-2">
        <div class="space-y-2">
          <PortalStatusBadge :status="selected.status" />
          <h3 class="portal-type-heading break-words text-title">{{ selected.title }}</h3>
          <dl class="space-y-1 portal-type-caption text-body">
            <div><dt class="inline">Đã gửi: </dt><dd class="inline">{{ dateLabel(selected.createdAt) }}</dd></div>
            <div><dt class="inline">Cập nhật: </dt><dd class="inline">{{ dateLabel(selected.updatedAt) }}</dd></div>
          </dl>
        </div>
        <section class="space-y-2" aria-label="Nội dung đã gửi">
          <h3 class="portal-type-label text-title">Nội dung đã gửi</h3>
          <p class="whitespace-pre-wrap break-words portal-type-body text-body">{{ selected.description }}</p>
        </section>
        <section class="space-y-2 border-t border-border-light pt-4" aria-label="Phản hồi của ban quản lý">
          <h3 class="portal-type-label text-title">Phản hồi của ban quản lý</h3>
          <template v-if="selected.publicResponse">
            <p class="whitespace-pre-wrap break-words portal-type-body text-title">{{ selected.publicResponse }}</p>
            <p v-if="selected.respondedAt" class="portal-type-caption text-body">{{ dateLabel(selected.respondedAt) }}</p>
          </template>
          <p v-else class="portal-type-body text-body">Chưa có phản hồi. Bạn có thể quay lại đây để xem cập nhật.</p>
        </section>
        <a v-if="selected.attachmentSignedUrl" :href="selected.attachmentSignedUrl" target="_blank" rel="noopener noreferrer" class="inline-flex min-h-11 items-center gap-2 rounded-xl portal-type-label text-theme underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40"><IconDocumentText class="h-4 w-4 shrink-0" aria-hidden="true" />Mở tệp đính kèm</a>
        <p v-else-if="selected.attachmentUnavailable" class="portal-type-body text-body">Chưa mở được tệp đính kèm. Thử tải lại cập nhật; nội dung yêu cầu vẫn được lưu.</p>
        <p v-if="detailError" role="alert" class="portal-type-body text-portal-danger">{{ detailError }}</p>
        <PortalButton variant="secondary" block :loading="detailLoading" @click="refreshDetail">Tải lại cập nhật</PortalButton>
      </article>
    </PortalBottomSheet>
    <PortalBottomSheet :model-value="guard.discardOpen.value" title="Bỏ yêu cầu đang soạn?" @update:model-value="guard.onDiscardSheetUpdate">
      <p class="portal-type-body text-body">Nội dung và tệp đang chọn chưa được gửi. Rời trang sẽ bỏ bản nháp này.</p>
      <div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <PortalButton variant="secondary" block @click="guard.keepEditing">Tiếp tục soạn</PortalButton>
        <PortalButton block @click="guard.discardChanges">Bỏ bản nháp</PortalButton>
      </div>
    </PortalBottomSheet>
  </div>
</template>
