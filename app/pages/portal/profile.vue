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

const { profile, status: profileStatus, error: profileError, refresh: refreshProfile, save, saving, fieldErrors }
  = usePortalProfile()
const identity = usePortalIdentityImages()
const docs = usePortalDocuments()

/* ── Profile edit ─────────────────────────────────────────────── */
const editOpen = ref(false)
const form = reactive({
  phone: '',
  email: '' as string | null,
  emergency_contact_name: '' as string | null,
  emergency_contact_phone: '' as string | null,
  notes: '' as string | null,
})

function openEdit() {
  if (!profile.value) return
  form.phone = profile.value.phone ?? ''
  form.email = profile.value.email ?? ''
  form.emergency_contact_name = profile.value.emergencyContactName ?? ''
  form.emergency_contact_phone = profile.value.emergencyContactPhone ?? ''
  form.notes = profile.value.notes ?? ''
  editOpen.value = true
}

function normalize(value: string | null): string | null {
  const trimmed = (value ?? '').trim()
  return trimmed === '' ? null : trimmed
}

async function onSave() {
  const ok = await save({
    phone: form.phone.trim(),
    email: normalize(form.email),
    emergency_contact_name: normalize(form.emergency_contact_name),
    emergency_contact_phone: normalize(form.emergency_contact_phone),
    notes: normalize(form.notes),
  })
  if (ok) {
    editOpen.value = false
    toast.success('Đã cập nhật hồ sơ.')
  }
}

/* ── Identity images ──────────────────────────────────────────── */
async function onIdentitySelect(side: TenantIdentityImageSide, file: File) {
  try {
    await identity.upload(side, file)
    toast.success('Đã cập nhật ảnh định danh.')
  }
  catch (e) {
    toast.error(getApiErrorMessage(e))
  }
}

async function onIdentityRemove(side: TenantIdentityImageSide) {
  try {
    await identity.remove(side)
    toast.success('Đã xóa ảnh định danh.')
  }
  catch (e) {
    toast.error(getApiErrorMessage(e))
  }
}

/* ── Documents ────────────────────────────────────────────────── */
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
  catch (e) {
    toast.error(getApiErrorMessage(e))
  }
}

async function onDocumentRemove(id: string) {
  try {
    await docs.remove(id)
    toast.success('Đã xóa tài liệu.')
  }
  catch (e) {
    toast.error(getApiErrorMessage(e))
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
      <PortalButton v-if="profile" variant="ghost" size="sm" @click="openEdit">Sửa</PortalButton>
    </Teleport>

    <div class="mx-auto w-full max-w-2xl space-y-5 px-4 py-5 lg:px-8 lg:py-8">
      <!-- Profile -->
      <section class="space-y-2">
        <PortalSkeleton v-if="profileStatus === 'pending'" variant="statement" class="h-40" />
        <PortalEmptyState
          v-else-if="profileError || !profile"
          tone="error"
          title="Không tải được hồ sơ"
          action-label="Thử lại"
          @action="refreshProfile"
        />
        <PortalCard v-else>
          <div class="flex items-center gap-3">
            <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-smoke-blue text-theme">
              <IconUser class="h-7 w-7" aria-hidden="true" />
            </span>
            <div class="min-w-0">
              <p class="portal-type-heading truncate text-title">{{ profile.fullName }}</p>
              <p class="portal-type-caption truncate text-body">Mã: {{ profile.code }}</p>
            </div>
          </div>
          <dl class="mt-4 divide-y divide-border-light border-t border-border-light">
            <div class="flex items-center justify-between gap-3 py-3">
              <dt class="portal-type-body text-body">Số điện thoại</dt>
              <dd class="portal-type-body text-right font-medium text-title">{{ profile.phone || '—' }}</dd>
            </div>
            <div class="flex items-center justify-between gap-3 py-3">
              <dt class="portal-type-body text-body">Email</dt>
              <dd class="portal-type-body min-w-0 truncate text-right font-medium text-title">{{ profile.email || '—' }}</dd>
            </div>
            <div class="flex items-center justify-between gap-3 py-3">
              <dt class="portal-type-body text-body">Liên hệ khẩn cấp</dt>
              <dd class="portal-type-body min-w-0 truncate text-right font-medium text-title">{{ profile.emergencyContactName || '—' }}</dd>
            </div>
            <div class="flex items-center justify-between gap-3 py-3">
              <dt class="portal-type-body text-body">SĐT khẩn cấp</dt>
              <dd class="portal-type-body text-right font-medium text-title">{{ profile.emergencyContactPhone || '—' }}</dd>
            </div>
            <div v-if="profile.notes" class="py-3">
              <dt class="portal-type-body text-body">Ghi chú</dt>
              <dd class="portal-type-body mt-1 whitespace-pre-line text-title">{{ profile.notes }}</dd>
            </div>
          </dl>
        </PortalCard>
      </section>

      <!-- Identity images -->
      <section class="space-y-3">
        <h3 class="portal-type-heading px-1 text-title">Ảnh định danh (CCCD)</h3>
        <PortalCard class="grid grid-cols-1 gap-4">
          <PortalIdentityImageSlot
            label="Mặt trước"
            :signed-url="identity.images.value.frontSignedUrl"
            :uploading="identity.uploading.value.front"
            :progress="identity.progress.value.front"
            @select="(file) => onIdentitySelect('front', file)"
            @remove="onIdentityRemove('front')"
            @error="toast.error"
          />
          <PortalIdentityImageSlot
            label="Mặt sau"
            :signed-url="identity.images.value.backSignedUrl"
            :uploading="identity.uploading.value.back"
            :progress="identity.progress.value.back"
            @select="(file) => onIdentitySelect('back', file)"
            @remove="onIdentityRemove('back')"
            @error="toast.error"
          />
        </PortalCard>
      </section>

      <!-- Documents -->
      <section class="space-y-3">
        <div class="flex items-center justify-between px-1">
          <h3 class="portal-type-heading text-title">Tài liệu</h3>
          <PortalButton variant="ghost" size="sm" :loading="docs.uploading.value" @click="pickDocument">
            <IconPlus class="h-4 w-4" aria-hidden="true" />
            Tải lên
          </PortalButton>
        </div>

        <div v-if="docs.uploading.value" class="px-1">
          <progress class="portal-progress" :value="docs.progress.value" max="100">
            {{ docs.progress.value }}%
          </progress>
          <p class="portal-type-caption mt-1 text-body">Đang tải lên {{ docs.progress.value }}%</p>
        </div>

        <PortalSkeleton v-if="docs.status.value === 'pending'" variant="card" class="h-20" />
        <PortalEmptyState
          v-else-if="docs.error.value"
          tone="error"
          title="Không tải được tài liệu"
          action-label="Thử lại"
          @action="docs.refresh"
        />
        <PortalCard v-else-if="docs.documents.value.length === 0">
          <p class="portal-type-body text-body">Chưa có tài liệu nào.</p>
        </PortalCard>
        <PortalCard v-else :padded="false">
          <ul class="divide-y divide-border-light">
            <li
              v-for="document in docs.documents.value"
              :key="document.id"
              class="flex items-center gap-3 px-4 py-3"
            >
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-smoke-blue text-theme">
                <IconDocumentText class="h-5 w-5" aria-hidden="true" />
              </span>
              <a
                :href="document.signedUrl"
                target="_blank"
                rel="noopener"
                class="min-w-0 flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40"
              >
                <p class="portal-type-body truncate font-medium text-title">{{ document.name }}</p>
                <p class="portal-type-caption text-body">{{ formatBytes(document.size) }}</p>
              </a>
              <button
                type="button"
                class="flex h-11 w-11 items-center justify-center rounded-full text-body transition-colors hover:bg-portal-danger/10 hover:text-portal-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-danger/40"
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

      <!-- Logout -->
      <PortalButton variant="secondary" block @click="onLogout">
        <IconLogOut class="h-4 w-4" aria-hidden="true" />
        Đăng xuất
      </PortalButton>
    </div>

    <!-- Edit sheet -->
    <PortalBottomSheet v-model="editOpen" title="Chỉnh sửa hồ sơ">
      <form class="space-y-4 py-1" @submit.prevent="onSave">
        <PortalTextField
          v-model="form.phone"
          label="Số điện thoại"
          type="tel"
          inputmode="tel"
          :error="fieldErrors.phone?.[0]"
        />
        <PortalTextField
          v-model="form.email"
          label="Email"
          type="email"
          inputmode="email"
          :error="fieldErrors.email?.[0]"
        />
        <PortalTextField
          v-model="form.emergency_contact_name"
          label="Người liên hệ khẩn cấp"
          :error="fieldErrors.emergency_contact_name?.[0]"
        />
        <PortalTextField
          v-model="form.emergency_contact_phone"
          label="SĐT khẩn cấp"
          type="tel"
          inputmode="tel"
          :error="fieldErrors.emergency_contact_phone?.[0]"
        />
        <PortalTextField
          v-model="form.notes"
          label="Ghi chú"
          textarea
          :rows="3"
          :error="fieldErrors.notes?.[0]"
        />
        <PortalButton type="submit" block size="lg" :loading="saving">Lưu thay đổi</PortalButton>
      </form>
    </PortalBottomSheet>
  </div>
</template>
