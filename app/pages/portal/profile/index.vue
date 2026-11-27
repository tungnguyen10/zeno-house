<script setup lang="ts">
import {
  TENANT_DOCUMENT_MAX_BYTES,
  TENANT_DOCUMENT_MIME_TYPES,
} from '~/utils/validators/tenant-portal'
import { getApiErrorMessage } from '~/utils/api-error'

definePageMeta({
  layout: 'tenant',
  pageTransition: { name: 'portal-page', mode: 'out-in' },
})

const { setChrome } = usePortalChrome()
setChrome({ title: 'Tài khoản', back: null })

const toast = usePortalToast()
const { logout } = useAuth()
const {
  profile,
  status: profileStatus,
  error: profileError,
  refresh: refreshProfile,
} = usePortalProfile()
const { contract } = usePortalContract()
const identity = usePortalIdentityImages()
const docs = usePortalDocuments()

const docInput = ref<HTMLInputElement | null>(null)
const loggingOut = ref(false)
const documentToRemove = ref<{ id: string; name: string } | null>(null)
const removingDocument = ref(false)
const sessionKey = usePortalSessionKey('profile-actions')
watch(sessionKey, () => {
  documentToRemove.value = null
  removingDocument.value = false
}, { flush: 'sync' })

function isCancelled(error: unknown) {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
}

function pickDocument() {
  docInput.value?.click()
}

async function onDocumentChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file) return
  const actor = sessionKey.value

  if (!TENANT_DOCUMENT_MIME_TYPES.includes(file.type as (typeof TENANT_DOCUMENT_MIME_TYPES)[number])) {
    toast.error('Tài liệu phải là JPEG, PNG, WebP hoặc PDF.')
    return
  }
  if (file.size > TENANT_DOCUMENT_MAX_BYTES) {
    toast.error('Tài liệu không được vượt quá 5MB.')
    return
  }

  try {
    await docs.upload(file)
    if (actor === sessionKey.value) toast.success('Đã tải tài liệu lên.')
  }
  catch (error) {
    if (actor === sessionKey.value && !isCancelled(error)) toast.error(getApiErrorMessage(error))
  }
}

async function onDocumentRemove(id: string) {
  if (removingDocument.value) return
  const actor = sessionKey.value
  removingDocument.value = true
  try {
    await docs.remove(id)
    if (actor !== sessionKey.value) return
    documentToRemove.value = null
    toast.success('Đã xóa tài liệu.')
  }
  catch (error) {
    if (actor === sessionKey.value && !isCancelled(error)) toast.error(getApiErrorMessage(error))
  }
  finally { if (actor === sessionKey.value) removingDocument.value = false }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function onLogout() {
  if (loggingOut.value) return
  loggingOut.value = true
  try { await logout() }
  catch (error) { toast.error(getApiErrorMessage(error, 'Chưa đăng xuất được. Vui lòng thử lại.')) }
  finally { loggingOut.value = false }
}
</script>

<template>
  <div>
    <div class="mx-auto w-full max-w-2xl space-y-5 px-4 py-5 lg:px-8 lg:py-8">
      <div v-if="profileStatus === 'pending' && !profile" class="space-y-5">
        <PortalSkeleton variant="statement" class="h-40" />
        <PortalSkeleton variant="card" class="h-64" />
        <PortalSkeleton variant="card" class="h-32" />
      </div>

      <PortalEmptyState
        v-else-if="profileError || !profile"
        tone="error"
        title="Không tải được hồ sơ"
        description="Hãy kiểm tra kết nối và thử tải lại hồ sơ."
        action-label="Thử lại"
        @action="refreshProfile"
      />

      <template v-else>
        <PortalProfileDossier
          :profile="profile"
          :room-number="contract?.roomNumber ?? null"
          :building-name="contract?.buildingName ?? null"
        />

        <section aria-labelledby="profile-identity-images-heading" class="space-y-3">
          <div class="flex items-start gap-2 px-1">
            <IconShield class="mt-0.5 h-5 w-5 shrink-0 text-theme" aria-hidden="true" />
            <div class="min-w-0">
              <h2 id="profile-identity-images-heading" class="portal-type-heading text-title">
                Ảnh định danh (CCCD)
              </h2>
              <p class="mt-1 portal-type-caption text-body">
                Ảnh định danh trong hồ sơ. Nếu thông tin chưa đúng, hãy gửi yêu cầu chỉnh sửa để ban quản lý đối chiếu.
              </p>
            </div>
          </div>
          <PortalSkeleton v-if="identity.status.value === 'pending'" variant="card" class="h-48" />
          <PortalEmptyState
            v-else-if="identity.error.value"
            tone="error"
            title="Không tải được ảnh định danh"
            description="Chưa kiểm tra được ảnh trong hồ sơ. Hãy thử tải lại."
            action-label="Thử lại"
            @action="identity.refresh"
          />
          <PortalCard v-else class="grid w-full gap-4 md:grid-cols-2">
            <PortalIdentityImageSlot
              label="Mặt trước"
              :signed-url="identity.images.value.frontSignedUrl"
              :editable="false"
              @retry="identity.refresh"
            />
            <PortalIdentityImageSlot
              label="Mặt sau"
              :signed-url="identity.images.value.backSignedUrl"
              :editable="false"
              @retry="identity.refresh"
            />
          </PortalCard>
        </section>

        <section aria-labelledby="profile-security-heading" class="space-y-3">
          <div class="flex items-center gap-2 px-1">
            <IconLock class="h-5 w-5 shrink-0 text-theme" aria-hidden="true" />
            <h2 id="profile-security-heading" class="portal-type-heading text-title">
              Bảo mật
            </h2>
          </div>
          <PortalCard :padded="false">
            <NuxtLink
              to="/portal/profile/password"
              class="flex min-h-16 items-center gap-3 rounded-2xl px-4 py-3 transition-colors hover:bg-smoke focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-theme/40 motion-reduce:transition-none"
            >
              <span
                class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-smoke-blue text-theme"
                aria-hidden="true"
              >
                <IconLock class="h-5 w-5" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block portal-type-body font-semibold text-title">
                  Đổi mật khẩu
                </span>
                <span class="mt-0.5 block portal-type-caption text-body">
                  Cập nhật mật khẩu đăng nhập của bạn.
                </span>
              </span>
              <IconChevronRight class="h-5 w-5 shrink-0 text-body" aria-hidden="true" />
            </NuxtLink>
          </PortalCard>
        </section>

        <section aria-labelledby="profile-documents-heading" class="space-y-3">
          <div class="flex items-start gap-2 px-1">
            <IconDocument class="mt-0.5 h-5 w-5 shrink-0 text-theme" aria-hidden="true" />
            <div class="min-w-0">
              <h2 id="profile-documents-heading" class="portal-type-heading text-title">
                Tài liệu
              </h2>
              <p class="mt-1 portal-type-caption text-body">
                JPEG, PNG, WebP hoặc PDF, tối đa 5MB.
              </p>
            </div>
          </div>

          <div v-if="docs.uploading.value" class="px-1">
            <progress
              class="portal-progress"
              :value="docs.progress.value"
              max="100"
            >
              {{ docs.progress.value }}%
            </progress>
            <p class="mt-1 portal-type-caption text-body">
              Đang tải lên {{ docs.progress.value }}%
            </p>
          </div>

          <PortalButton
            variant="secondary"
            block
            :loading="docs.uploading.value"
            @click="pickDocument"
          >
            <IconPlus class="h-4 w-4" aria-hidden="true" />
            Tải tài liệu
          </PortalButton>

          <PortalSkeleton
            v-if="docs.status.value === 'pending'"
            variant="card"
            class="h-20"
          />
          <PortalEmptyState
            v-else-if="docs.error.value"
            tone="error"
            title="Không tải được tài liệu"
            description="Hãy kiểm tra kết nối và thử lại."
            action-label="Thử lại"
            @action="docs.refresh"
          />
          <PortalCard v-else-if="docs.documents.value.length === 0">
            <p class="portal-type-body text-body">
              Chưa có tài liệu nào.
            </p>
          </PortalCard>
          <PortalCard v-else :padded="false">
            <ul class="divide-y divide-border-light">
              <li
                v-for="document in docs.documents.value"
                :key="document.id"
                class="flex min-h-16 items-center gap-3 px-4 py-3"
              >
                <span
                  class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-smoke-blue text-theme"
                  aria-hidden="true"
                >
                  <IconDocumentText class="h-5 w-5" />
                </span>
                <a
                  :href="document.signedUrl"
                  target="_blank"
                  rel="noopener"
                  class="min-w-0 flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40"
                >
                  <p class="truncate portal-type-body font-medium text-title">
                    {{ document.name }}
                  </p>
                  <p class="portal-type-caption text-body">
                    {{ formatBytes(document.size) }}
                  </p>
                </a>
                <button
                  type="button"
                  class="flex size-11 shrink-0 items-center justify-center rounded-full text-body transition-colors hover:bg-portal-danger/10 hover:text-portal-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-danger/40"
                  aria-label="Xóa tài liệu"
                  @click="documentToRemove = { id: document.id, name: document.name }"
                >
                  <IconTrash class="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            </ul>
          </PortalCard>

          <input
            ref="docInput"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            class="hidden"
            @change="onDocumentChange"
          >
        </section>

      </template>

        <div class="pt-1">
          <div class="rounded-xl bg-smoke-blue">
            <PortalButton variant="ghost" block :loading="loggingOut" @click="onLogout">
              <IconLogOut class="h-4 w-4" aria-hidden="true" />
              Đăng xuất
            </PortalButton>
          </div>
        </div>
    </div>
    <PortalBottomSheet
      :model-value="Boolean(documentToRemove)"
      title="Xóa tài liệu?"
      @update:model-value="open => { if (!open && !removingDocument) documentToRemove = null }"
    >
      <p class="portal-type-body break-words text-title">{{ documentToRemove?.name }}</p>
      <p class="portal-type-body mt-2 text-body">Tài liệu sẽ được xóa khỏi hồ sơ. Bạn cần tải lại tệp nếu muốn sử dụng sau này.</p>
      <div class="mt-5 grid grid-cols-2 gap-3">
        <PortalButton variant="secondary" :disabled="removingDocument" @click="documentToRemove = null">Giữ tài liệu</PortalButton>
        <PortalButton variant="danger" :loading="removingDocument" @click="documentToRemove && onDocumentRemove(documentToRemove.id)">Xóa tài liệu</PortalButton>
      </div>
    </PortalBottomSheet>
  </div>
</template>
