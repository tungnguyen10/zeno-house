<script setup lang="ts">
import type { TenantGender } from '~/types/tenant-portal'
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

const GENDER_OPTIONS: { value: TenantGender, label: string }[] = [
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
  { value: 'other', label: 'Khác' },
]

const STATUS_LABELS: Record<string, string> = {
  active: 'Đang thuê',
  archived: 'Đã lưu trữ',
}

function genderLabel(value: TenantGender | null | undefined): string {
  return GENDER_OPTIONS.find(option => option.value === value)?.label ?? '—'
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

function statusLabel(value: string | null | undefined): string {
  return value ? (STATUS_LABELS[value] ?? value) : '—'
}

/* ── View sections ────────────────────────────────────────────── */
const detailSections = computed(() => {
  const current = profile.value
  if (!current) return []
  return [
    {
      key: 'personal',
      title: 'Thông tin cá nhân',
      icon: 'IconUser',
      rows: [
        { label: 'Giới tính', value: genderLabel(current.gender) },
        { label: 'Ngày sinh', value: formatDate(current.dateOfBirth) },
        { label: 'Nghề nghiệp', value: current.occupation || '—' },
      ],
    },
    {
      key: 'contact',
      title: 'Liên hệ',
      icon: 'IconPhone',
      rows: [
        { label: 'Số điện thoại', value: current.phone || '—' },
        { label: 'Email', value: current.email || '—' },
        { label: 'Địa chỉ thường trú', value: current.permanentAddress || '—' },
      ],
    },
    {
      key: 'identity',
      title: 'Giấy tờ tùy thân',
      icon: 'IconDocumentText',
      rows: [
        { label: 'Số CCCD/CMND', value: current.idNumber || '—' },
        { label: 'Ngày cấp', value: formatDate(current.idIssuedDate) },
        { label: 'Nơi cấp', value: current.idIssuedPlace || '—' },
      ],
    },
    {
      key: 'emergency',
      title: 'Liên hệ khẩn cấp',
      icon: 'IconShield',
      rows: [
        { label: 'Người liên hệ', value: current.emergencyContactName || '—' },
        { label: 'Số điện thoại', value: current.emergencyContactPhone || '—' },
      ],
    },
  ]
})

/* ── Profile edit ─────────────────────────────────────────────── */
const mode = ref<'view' | 'edit'>('view')
const form = reactive({
  full_name: '',
  phone: '',
  email: '' as string | null,
  gender: null as TenantGender | null,
  date_of_birth: '' as string | null,
  occupation: '' as string | null,
  permanent_address: '' as string | null,
  id_number: '' as string | null,
  id_issued_date: '' as string | null,
  id_issued_place: '' as string | null,
  emergency_contact_name: '' as string | null,
  emergency_contact_phone: '' as string | null,
  notes: '' as string | null,
})

function openEdit() {
  const current = profile.value
  if (!current) return
  form.full_name = current.fullName ?? ''
  form.phone = current.phone ?? ''
  form.email = current.email ?? ''
  form.gender = current.gender ?? null
  form.date_of_birth = current.dateOfBirth ?? ''
  form.occupation = current.occupation ?? ''
  form.permanent_address = current.permanentAddress ?? ''
  form.id_number = current.idNumber ?? ''
  form.id_issued_date = current.idIssuedDate ?? ''
  form.id_issued_place = current.idIssuedPlace ?? ''
  form.emergency_contact_name = current.emergencyContactName ?? ''
  form.emergency_contact_phone = current.emergencyContactPhone ?? ''
  form.notes = current.notes ?? ''
  mode.value = 'edit'
}

function cancelEdit() {
  mode.value = 'view'
}

function toggleGender(value: TenantGender) {
  form.gender = form.gender === value ? null : value
}

function normalize(value: string | null): string | null {
  const trimmed = (value ?? '').trim()
  return trimmed === '' ? null : trimmed
}

async function onSave() {
  const ok = await save({
    full_name: form.full_name.trim(),
    phone: form.phone.trim(),
    email: normalize(form.email),
    gender: form.gender,
    date_of_birth: normalize(form.date_of_birth),
    occupation: normalize(form.occupation),
    permanent_address: normalize(form.permanent_address),
    id_number: normalize(form.id_number),
    id_issued_date: normalize(form.id_issued_date),
    id_issued_place: normalize(form.id_issued_place),
    emergency_contact_name: normalize(form.emergency_contact_name),
    emergency_contact_phone: normalize(form.emergency_contact_phone),
    notes: normalize(form.notes),
  })
  if (ok) {
    mode.value = 'view'
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

const initials = computed(() => {
  const name = profile.value?.fullName?.trim() ?? ''
  if (!name) return '?'
  const parts = name.split(/\s+/)
  if (parts.length === 1) return (parts[0]?.[0] ?? '').toUpperCase()
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
})

const statusColor = computed(() => {
  if (profile.value?.status === 'active') return 'text-portal-positive-ink'
  return 'text-body'
})
</script>

<template>
  <div>
    <div class="mx-auto w-full max-w-2xl space-y-5 px-4 py-5 lg:px-8 lg:py-8">
      <PortalSkeleton v-if="profileStatus === 'pending'" variant="statement" class="h-40" />
      <PortalEmptyState
        v-else-if="profileError || !profile"
        tone="error"
        title="Không tải được hồ sơ"
        action-label="Thử lại"
        @action="refreshProfile"
      />

      <template v-else>
        <!-- Identity header -->
        <PortalCard>
          <div class="relative flex flex-col items-center py-2 text-center">
            <!-- Edit icon (top-right, view mode only) -->
            <button
              v-if="mode === 'view'"
              type="button"
              class="absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-lg text-body transition-colors hover:bg-smoke hover:text-title focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40"
              aria-label="Sửa hồ sơ"
              @click="openEdit"
            >
              <IconPencilSquare class="h-4 w-4" aria-hidden="true" />
            </button>

            <!-- Avatar -->
            <span class="flex h-20 w-20 items-center justify-center rounded-full bg-smoke-blue portal-type-display font-bold text-theme">
              {{ initials }}
            </span>

            <!-- Name -->
            <p class="portal-type-display mt-4 text-title">{{ profile.fullName }}</p>

            <!-- Code + status -->
            <div class="mt-1.5 flex items-center gap-2">
              <p class="portal-type-caption text-body">{{ profile.code }}</p>
              <span class="inline-block h-1 w-1 rounded-full bg-border-light" aria-hidden="true" />
              <p class="portal-type-caption" :class="statusColor">{{ statusLabel(profile.status) }}</p>
            </div>
          </div>
        </PortalCard>

        <!-- ── View mode ─────────────────────────────────────── -->
        <template v-if="mode === 'view'">
          <section v-for="section in detailSections" :key="section.key" class="space-y-2">
            <div class="flex items-center gap-2 px-1">
              <component :is="section.icon" class="h-4 w-4 text-theme" aria-hidden="true" />
              <h3 class="portal-type-heading text-title">{{ section.title }}</h3>
            </div>
            <PortalCard>
              <dl class="divide-y divide-border-light">
                <div
                  v-for="row in section.rows"
                  :key="row.label"
                  class="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <dt class="portal-type-body shrink-0 text-body">{{ row.label }}</dt>
                  <dd class="portal-type-body min-w-0 break-words text-right font-medium text-title">{{ row.value }}</dd>
                </div>
              </dl>
            </PortalCard>
          </section>

          <!-- Notes -->
          <section class="space-y-2">
            <h3 class="portal-type-heading px-1 text-title">Ghi chú</h3>
            <PortalCard>
              <p v-if="profile.notes" class="portal-type-body whitespace-pre-line text-title">{{ profile.notes }}</p>
              <p v-else class="portal-type-body text-body">Chưa có ghi chú.</p>
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
        </template>

        <!-- ── Edit mode ─────────────────────────────────────── -->
        <form v-else class="space-y-5" @submit.prevent="onSave">
          <!-- Personal -->
          <section class="space-y-3">
            <h3 class="portal-type-heading px-1 text-title">Thông tin cá nhân</h3>
            <PortalCard class="space-y-4">
              <PortalTextField
                v-model="form.full_name"
                label="Họ và tên"
                autocomplete="name"
                :error="fieldErrors.full_name?.[0]"
              />
              <div class="space-y-1.5">
                <span class="block text-sm font-medium text-title">Giới tính</span>
                <div class="grid grid-cols-3 gap-2">
                  <button
                    v-for="option in GENDER_OPTIONS"
                    :key="option.value"
                    type="button"
                    class="min-h-[44px] rounded-xl border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40"
                    :class="form.gender === option.value
                      ? 'border-theme bg-smoke-blue text-theme'
                      : 'border-border-light text-body hover:bg-smoke'"
                    :aria-pressed="form.gender === option.value"
                    @click="toggleGender(option.value)"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </div>
              <PortalTextField
                v-model="form.date_of_birth"
                label="Ngày sinh"
                type="date"
                :error="fieldErrors.date_of_birth?.[0]"
              />
              <PortalTextField
                v-model="form.occupation"
                label="Nghề nghiệp"
                :error="fieldErrors.occupation?.[0]"
              />
            </PortalCard>
          </section>

          <!-- Contact -->
          <section class="space-y-3">
            <h3 class="portal-type-heading px-1 text-title">Liên hệ</h3>
            <PortalCard class="space-y-4">
              <PortalTextField
                v-model="form.phone"
                label="Số điện thoại"
                type="tel"
                inputmode="tel"
                autocomplete="tel"
                :error="fieldErrors.phone?.[0]"
              />
              <PortalTextField
                v-model="form.email"
                label="Email"
                type="email"
                inputmode="email"
                autocomplete="email"
                :error="fieldErrors.email?.[0]"
              />
              <PortalTextField
                v-model="form.permanent_address"
                label="Địa chỉ thường trú"
                textarea
                :rows="2"
                :error="fieldErrors.permanent_address?.[0]"
              />
            </PortalCard>
          </section>

          <!-- Identity -->
          <section class="space-y-3">
            <h3 class="portal-type-heading px-1 text-title">Giấy tờ tùy thân</h3>
            <PortalCard class="space-y-4">
              <PortalTextField
                v-model="form.id_number"
                label="Số CCCD/CMND"
                inputmode="numeric"
                :error="fieldErrors.id_number?.[0]"
              />
              <PortalTextField
                v-model="form.id_issued_date"
                label="Ngày cấp"
                type="date"
                :error="fieldErrors.id_issued_date?.[0]"
              />
              <PortalTextField
                v-model="form.id_issued_place"
                label="Nơi cấp"
                :error="fieldErrors.id_issued_place?.[0]"
              />
            </PortalCard>
          </section>

          <!-- Emergency -->
          <section class="space-y-3">
            <h3 class="portal-type-heading px-1 text-title">Liên hệ khẩn cấp</h3>
            <PortalCard class="space-y-4">
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
            </PortalCard>
          </section>

          <!-- Notes -->
          <section class="space-y-3">
            <h3 class="portal-type-heading px-1 text-title">Ghi chú</h3>
            <PortalCard>
              <PortalTextField
                v-model="form.notes"
                label="Ghi chú"
                textarea
                :rows="3"
                :error="fieldErrors.notes?.[0]"
              />
            </PortalCard>
          </section>

          <div class="flex gap-3">
            <PortalButton variant="secondary" block :disabled="saving" @click="cancelEdit">Hủy</PortalButton>
            <PortalButton type="submit" block :loading="saving">Lưu thay đổi</PortalButton>
          </div>
        </form>
      </template>
    </div>
  </div>
</template>
