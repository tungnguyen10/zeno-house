<script setup lang="ts">
import type { TenantIdentityImageSide } from '~/utils/validators/tenant-portal'
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
const identity = usePortalIdentityImages()
const docs = usePortalDocuments()

async function onIdentitySelect(side: TenantIdentityImageSide, file: File) {
  try {
    await identity.upload(side, file)
    toast.success('Đã cập nhật ảnh định danh.')
  }
  catch (error) {
    toast.error(getApiErrorMessage(error))
  }
}

async function onIdentityRemove(side: TenantIdentityImageSide) {
  try {
    await identity.remove(side)
    toast.success('Đã xóa ảnh định danh.')
  }
  catch (error) {
    toast.error(getApiErrorMessage(error))
  }
}

const docInput = ref<HTMLInputElement | null>(null)

function pickDocument() {
  docInput.value?.click()
}

async function onDocumentChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file) return

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
    toast.success('Đã tải tài liệu lên.')
  }
  catch (error) {
    toast.error(getApiErrorMessage(error))
  }
}

async function onDocumentRemove(id: string) {
  try {
    await docs.remove(id)
    toast.success('Đã xóa tài liệu.')
  }
  catch (error) {
    toast.error(getApiErrorMessage(error))
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function onLogout() {
  await logout()
}
</script>

<template>
  <div>
    <Teleport to="#portal-header-action">
      <NuxtLink
        v-if="profileStatus === 'success' && profile"
        to="/portal/profile/edit"
        class="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-theme px-3 text-sm font-semibold text-[color:var(--portal-bg)] transition-colors hover:bg-theme/90 active:bg-theme/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40 motion-reduce:transition-none"
      >
        <IconPencilSquare class="h-4 w-4" aria-hidden="true" />
        Chỉnh sửa
      </NuxtLink>
    </Teleport>

    <div class="mx-auto w-full max-w-2xl space-y-5 px-4 py-5 lg:px-8 lg:py-8">
      <div v-if="profileStatus === 'pending'" class="space-y-5">
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
        <PortalProfileDossier :profile="profile" />

        <section aria-labelledby="profile-identity-images-heading" class="space-y-3">
          <div class="px-1">
            <h2 id="profile-identity-images-heading" class="portal-type-heading text-title">
              Ảnh định danh
            </h2>
            <p class="mt-1 portal-type-caption text-body">
              Ảnh hai mặt CCCD/CMND dùng để đối chiếu hồ sơ.
            </p>
          </div>
          <PortalCard class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PortalIdentityImageSlot
              label="Mặt trước"
              :signed-url="identity.images.value.frontSignedUrl"
              :uploading="identity.uploading.value.front"
              :progress="identity.progress.value.front"
              @select="file => onIdentitySelect('front', file)"
              @remove="onIdentityRemove('front')"
              @error="toast.error"
            />
            <PortalIdentityImageSlot
              label="Mặt sau"
              :signed-url="identity.images.value.backSignedUrl"
              :uploading="identity.uploading.value.back"
              :progress="identity.progress.value.back"
              @select="file => onIdentitySelect('back', file)"
              @remove="onIdentityRemove('back')"
              @error="toast.error"
            />
          </PortalCard>
        </section>

        <section aria-labelledby="profile-documents-heading" class="space-y-3">
          <div class="flex items-center justify-between gap-3 px-1">
            <div class="min-w-0">
              <h2 id="profile-documents-heading" class="portal-type-heading text-title">
                Tài liệu
              </h2>
              <p class="mt-1 portal-type-caption text-body">
                JPEG, PNG, WebP hoặc PDF, tối đa 5MB.
              </p>
            </div>
            <PortalButton
              variant="ghost"
              size="sm"
              :loading="docs.uploading.value"
              @click="pickDocument"
            >
              <IconPlus class="h-4 w-4" aria-hidden="true" />
              Tải lên
            </PortalButton>
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
                  @click="onDocumentRemove(document.id)"
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

        <div class="border-t border-border-light pt-5">
          <PortalButton variant="secondary" block @click="onLogout">
            <IconLogOut class="h-4 w-4 text-portal-danger" aria-hidden="true" />
            Đăng xuất
          </PortalButton>
        </div>
      </template>
    </div>
  </div>
</template>
